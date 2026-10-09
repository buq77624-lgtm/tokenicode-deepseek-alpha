use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;
use crate::{build_smart_http_client, is_proxy_reachable, ConnectionTestResult, StepResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateImageParams {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub prompt: String,
    pub size: Option<String>,
    pub quality: Option<String>,
    pub style: Option<String>,
    pub n: Option<u32>,
    pub response_format: Option<String>,
    pub proxy_url: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedImageItem {
    pub file_path: String,
    pub data_url: String,
    pub revised_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateImageResult {
    pub success: bool,
    pub images: Vec<GeneratedImageItem>,
    pub model: String,
    pub prompt: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestImageConnectionParams {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub proxy_url: Option<String>,
}

/// 标准化生成图片的端点路径
fn resolve_image_endpoint(base_url: &str) -> String {
    let base = base_url.trim().trim_end_matches('/');
    if base.ends_with("/images/generations") {
        base.to_string()
    } else if base.ends_with("/v1") || base.ends_with("/v4") {
        format!("{}/images/generations", base)
    } else {
        format!("{}/v1/images/generations", base)
    }
}

/// 解析或创建本地存储目录
fn resolve_output_dir(cwd: Option<&str>) -> Result<PathBuf, String> {
    let target_dir = if let Some(cwd_str) = cwd {
        let p = Path::new(cwd_str);
        if p.exists() && p.is_dir() {
            let dir = p.join(".tokenicode").join("images");
            // 确保 .gitignore 忽略此目录
            let gitignore = p.join(".tokenicode").join(".gitignore");
            if !gitignore.exists() {
                if let Some(parent) = gitignore.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(&gitignore, "images/\n");
            }
            dir
        } else {
            fallback_app_images_dir()?
        }
    } else {
        fallback_app_images_dir()?
    };

    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("无法创建图片存储目录: {}", e))?;

    Ok(target_dir)
}

fn fallback_app_images_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home.join(".tokenicode").join("images"))
}

/// 构建适配生图请求的 HTTP 客户端（180s 超时）
async fn build_image_http_client(proxy_url: Option<&str>) -> reqwest::Client {
    if let Some(purl) = proxy_url {
        let purl = purl.trim();
        if !purl.is_empty() {
            if let Ok(proxy) = reqwest::Proxy::all(purl) {
                if is_proxy_reachable(purl).await {
                    if let Ok(client) = reqwest::Client::builder()
                        .connect_timeout(Duration::from_secs(15))
                        .timeout(Duration::from_secs(180))
                        .no_proxy()
                        .proxy(proxy)
                        .build()
                    {
                        return client;
                    }
                }
            }
        }
    }

    build_smart_http_client(Duration::from_secs(15), Duration::from_secs(180)).await
}

/// 执行 AI 图像生成并自动双通道落盘
#[tauri::command]
pub async fn generate_image(params: GenerateImageParams) -> Result<GenerateImageResult, String> {
    let prompt = params.prompt.trim();
    if prompt.is_empty() {
        return Err("提示词 (Prompt) 不能为空".into());
    }

    let model = params.model.trim();
    if model.is_empty() {
        return Err("必须指定生图模型 (Model)".into());
    }

    let endpoint = resolve_image_endpoint(&params.base_url);
    let client = build_image_http_client(params.proxy_url.as_deref()).await;

    let mut body = serde_json::json!({
        "model": model,
        "prompt": prompt,
    });

    if let Some(n) = params.n {
        body["n"] = serde_json::json!(n);
    }
    if let Some(ref size) = params.size {
        if !size.trim().is_empty() {
            body["size"] = serde_json::json!(size.trim());
        }
    }
    if let Some(ref quality) = params.quality {
        if !quality.trim().is_empty() {
            body["quality"] = serde_json::json!(quality.trim());
        }
    }
    if let Some(ref style) = params.style {
        if !style.trim().is_empty() {
            body["style"] = serde_json::json!(style.trim());
        }
    }

    // 默认请求 b64_json，但部分接口强制返回 url，后续支持双通道降级兼容
    let req_format = params.response_format.as_deref().unwrap_or("b64_json");
    body["response_format"] = serde_json::json!(req_format);

    let mut req = client.post(&endpoint).json(&body);
    let api_key = params.api_key.trim();
    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("生图网络请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        if let Ok(err_val) = serde_json::from_str::<serde_json::Value>(&err_text) {
            if let Some(msg) = err_val
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
            {
                return Err(format!("接口返回错误 ({}): {}", status, msg));
            }
        }
        return Err(format!("接口返回状态异常 ({}): {}", status, err_text));
    }

    let resp_json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析 API 响应数据失败: {}", e))?;

    let data_array = resp_json
        .get("data")
        .and_then(|d| d.as_array())
        .ok_or_else(|| "响应中未包含有效的 data 图片列表".to_string())?;

    if data_array.is_empty() {
        return Err("API 返回了空的图片列表".into());
    }

    let output_dir = resolve_output_dir(params.cwd.as_deref())?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let mut generated_items: Vec<GeneratedImageItem> = Vec::new();

    for (index, item) in data_array.iter().enumerate() {
        let revised_prompt = item
            .get("revised_prompt")
            .and_then(|p| p.as_str())
            .map(|s| s.to_string());

        let file_name = format!("img_{}_{}_{}.png", timestamp, index, uuid::Uuid::new_v4().simple());
        let file_path = output_dir.join(&file_name);

        let (image_bytes, b64_str) = if let Some(b64) = item.get("b64_json").and_then(|b| b.as_str()) {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(b64)
                .map_err(|e| format!("Base64 解码失败: {}", e))?;
            (bytes, b64.to_string())
        } else if let Some(url_str) = item.get("url").and_then(|u| u.as_str()) {
            // 双通道容错：拉取远程临时 URL 并落盘保存，防止 CDN 链接过期
            let img_resp = client
                .get(url_str)
                .send()
                .await
                .map_err(|e| format!("下载图片 URL 失败 ({}): {}", url_str, e))?;

            if !img_resp.status().is_success() {
                return Err(format!("下载图片失败，状态码: {}", img_resp.status()));
            }

            let bytes = img_resp
                .bytes()
                .await
                .map_err(|e| format!("读取图片流失败: {}", e))?
                .to_vec();

            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            (bytes, b64)
        } else {
            return Err("响应项中既不包含 b64_json 也不包含 url".into());
        };

        std::fs::write(&file_path, &image_bytes)
            .map_err(|e| format!("写入本地图片失败: {}", e))?;

        let canonical_path = file_path.to_string_lossy().to_string();
        let data_url = format!("data:image/png;base64,{}", b64_str);

        generated_items.push(GeneratedImageItem {
            file_path: canonical_path,
            data_url,
            revised_prompt,
        });
    }

    Ok(GenerateImageResult {
        success: true,
        images: generated_items,
        model: model.to_string(),
        prompt: prompt.to_string(),
        created_at: timestamp,
    })
}

/// 非计费/非扣费的快速生图接口连通性测试
#[tauri::command]
pub async fn test_image_connection(params: TestImageConnectionParams) -> Result<ConnectionTestResult, String> {
    let client = build_image_http_client(params.proxy_url.as_deref()).await;
    let endpoint = resolve_image_endpoint(&params.base_url);
    let base_trimmed = params.base_url.trim().trim_end_matches('/');
    let api_key = params.api_key.trim();

    // 1. 网络连通性测试 (Connectivity)
    let conn_res = match client
        .head(base_trimmed)
        .timeout(Duration::from_secs(8))
        .send()
        .await
    {
        Ok(_) => StepResult {
            ok: true,
            message: "网络通道畅通".into(),
        },
        Err(_) => {
            // 某些服务器对 HEAD 返回 405/404，回退使用 GET
            match client.get(base_trimmed).timeout(Duration::from_secs(8)).send().await {
                Ok(_) => StepResult {
                    ok: true,
                    message: "网络通道畅通".into(),
                },
                Err(e) => StepResult {
                    ok: false,
                    message: format!("网络连接超时或无法访问: {}", e),
                },
            }
        }
    };

    if !conn_res.ok {
        return Ok(ConnectionTestResult {
            connectivity: conn_res.clone(),
            auth: StepResult {
                ok: false,
                message: "由于网络不通跳过认证".into(),
            },
            model: StepResult {
                ok: false,
                message: "由于网络不通跳过模型检测".into(),
            },
        });
    }

    // 2. 鉴权与模型探测
    // 优先尝试查询 /models 接口以验证 API Key
    let models_endpoint = if base_trimmed.ends_with("/v1") || base_trimmed.ends_with("/v4") {
        format!("{}/models", base_trimmed)
    } else {
        format!("{}/v1/models", base_trimmed)
    };

    let (auth_step, model_step);

    let mut model_req = client.get(&models_endpoint);
    if !api_key.is_empty() {
        model_req = model_req.header("Authorization", format!("Bearer {}", api_key));
    }

    if let Ok(m_resp) = model_req.timeout(Duration::from_secs(10)).send().await {
        let status = m_resp.status();
        if status.is_success() {
            auth_step = StepResult {
                ok: true,
                message: "API Key 鉴权通过".into(),
            };
            if let Ok(m_json) = m_resp.json::<serde_json::Value>().await {
                let model_input = params.model.trim();
                let found = m_json
                    .get("data")
                    .and_then(|d| d.as_array())
                    .map(|arr| {
                        arr.iter().any(|item| {
                            item.get("id")
                                .and_then(|id| id.as_str())
                                .map(|s| s.eq_ignore_ascii_case(model_input))
                                .unwrap_or(false)
                        })
                    })
                    .unwrap_or(false);

                if found {
                    model_step = StepResult {
                        ok: true,
                        message: format!("模型 '{}' 存在且可用", model_input),
                    };
                } else {
                    model_step = StepResult {
                        ok: true,
                        message: format!("已连接 (模型名 '{}' 未在公开列表出现，可直接调用)", model_input),
                    };
                }
            } else {
                model_step = StepResult {
                    ok: true,
                    message: "模型端点就绪".into(),
                };
            }

            return Ok(ConnectionTestResult {
                connectivity: conn_res,
                auth: auth_step,
                model: model_step,
            });
        } else if status.as_u16() == 401 {
            return Ok(ConnectionTestResult {
                connectivity: conn_res,
                auth: StepResult {
                    ok: false,
                    message: "API Key 无效或鉴权失败 (401)".into(),
                },
                model: StepResult {
                    ok: false,
                    message: "由于鉴权失败未检测模型".into(),
                },
            });
        }
    }

    // 若 /models 不支持（如部分专考生图网关），使用生图接口发送空参数探针测试
    let mut probe_req = client.post(&endpoint).json(&serde_json::json!({
        "model": params.model.trim(),
        "prompt": ""
    }));
    if !api_key.is_empty() {
        probe_req = probe_req.header("Authorization", format!("Bearer {}", api_key));
    }

    match probe_req.timeout(Duration::from_secs(10)).send().await {
        Ok(probe_resp) => {
            let status = probe_resp.status();
            if status.as_u16() == 401 {
                auth_step = StepResult {
                    ok: false,
                    message: "API Key 鉴权失败 (401 Unauthorized)".into(),
                };
                model_step = StepResult {
                    ok: false,
                    message: "鉴权失败".into(),
                };
            } else if status.as_u16() == 400 {
                // 400 代表成功通过鉴权进入了业务逻辑校验（如提示词为空），证明 Key 有效且路由正确
                auth_step = StepResult {
                    ok: true,
                    message: "API Key 有效且端点正常".into(),
                };
                model_step = StepResult {
                    ok: true,
                    message: format!("模型 '{}' 接口就绪", params.model.trim()),
                };
            } else if status.is_success() {
                auth_step = StepResult {
                    ok: true,
                    message: "API Key 验证通过".into(),
                };
                model_step = StepResult {
                    ok: true,
                    message: "接口与模型就绪".into(),
                };
            } else {
                auth_step = StepResult {
                    ok: true,
                    message: format!("服务响应状态码: {}", status),
                };
                model_step = StepResult {
                    ok: true,
                    message: "端点连通可用".into(),
                };
            }
        }
        Err(e) => {
            auth_step = StepResult {
                ok: false,
                message: format!("接口请求失败: {}", e),
            };
            model_step = StepResult {
                ok: false,
                message: "无法确认模型状态".into(),
            };
        }
    }

    Ok(ConnectionTestResult {
        connectivity: conn_res,
        auth: auth_step,
        model: model_step,
    })
}
