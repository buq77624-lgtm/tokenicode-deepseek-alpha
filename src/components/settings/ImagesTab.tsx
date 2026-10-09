import { useState } from 'react';
import { useImageStore, type ImageApiConfig } from '../../stores/imageStore';
import { bridge, type ConnectionTestResult } from '../../lib/tauri-bridge';

export function ImagesTab() {
  const configs = useImageStore((s) => s.configs);
  const activeConfigId = useImageStore((s) => s.activeConfigId);
  const setActiveConfigId = useImageStore((s) => s.setActiveConfigId);
  const updateConfig = useImageStore((s) => s.updateConfig);
  const addConfig = useImageStore((s) => s.addConfig);
  const deleteConfig = useImageStore((s) => s.deleteConfig);
  const addModelToConfig = useImageStore((s) => s.addModelToConfig);
  const removeModelFromConfig = useImageStore((s) => s.removeModelFromConfig);

  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [newModelName, setNewModelName] = useState('');

  const currentConfig: ImageApiConfig =
    configs.find((c) => c.id === activeConfigId) || configs[0] || {
      id: 'custom_default',
      name: '自定义 API',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'dall-e-3',
      availableModels: ['dall-e-3'],
      defaultAspectRatio: '1:1',
      defaultQuality: 'standard',
    };

  // 添加新模型
  const handleAddModel = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = newModelName.trim();
    if (!trimmed) return;
    addModelToConfig(currentConfig.id, trimmed);
    setNewModelName('');
  };

  // 新建自定义接口
  const handleCreateNewEndpoint = () => {
    const newId = addConfig({
      name: `自定义接口 ${configs.length + 1}`,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'dall-e-3',
      availableModels: ['dall-e-3'],
      defaultAspectRatio: '1:1',
      defaultQuality: 'standard',
    });
    setActiveConfigId(newId);
    setTestResult(null);
  };

  // 连通性测试
  const handleTestConnection = async () => {
    if (!currentConfig || !currentConfig.baseUrl) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await bridge.testImageConnection({
        base_url: currentConfig.baseUrl,
        api_key: currentConfig.apiKey,
        model: currentConfig.model,
        proxy_url: currentConfig.proxyUrl,
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        connectivity: { ok: false, message: e?.message || '网络连接失败' },
        auth: { ok: false, message: '未执行' },
        model: { ok: false, message: '未执行' },
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      {/* 顶部标题与说明 */}
      <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
        <div>
          <h3 className="text-base font-semibold text-text-primary">自定义 AI 生图接口</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            完全由您自由配置 API 端点与模型（支持直接在聊天中调用与生成图像）
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateNewEndpoint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-xs font-medium transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10" />
          </svg>
          新建自定义端点
        </button>
      </div>

      {/* 接口选择 Tab 栏（如果用户配置了多个端点） */}
      {configs.length > 1 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-text-tertiary">端点列表:</span>
          {configs.map((cfg) => (
            <div
              key={cfg.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                cfg.id === currentConfig.id
                  ? 'border-accent bg-accent/10 text-accent font-medium'
                  : 'border-border-subtle bg-bg-card hover:bg-bg-tertiary text-text-secondary cursor-pointer'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveConfigId(cfg.id);
                  setTestResult(null);
                }}
              >
                {cfg.name || '未命名端点'}
              </button>
              {configs.length > 1 && (
                <button
                  type="button"
                  onClick={() => deleteConfig(cfg.id)}
                  className="hover:text-red-500 opacity-60 hover:opacity-100 p-0.5 ml-1"
                  title="删除此接口"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* API 核心配置表单 */}
      <div className="space-y-4 p-4 rounded-xl border border-border-subtle bg-bg-secondary/40">
        {/* 接口名称 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">
            接口别名 (Name)
          </label>
          <input
            type="text"
            value={currentConfig.name}
            onChange={(e) => updateConfig(currentConfig.id, { name: e.target.value })}
            placeholder="如：自建中转 API / FLUX 专属端点"
            className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-accent"
          />
        </div>

        {/* Base URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">
            Base URL（API 接口地址）
          </label>
          <input
            type="text"
            value={currentConfig.baseUrl}
            onChange={(e) => updateConfig(currentConfig.id, { baseUrl: e.target.value.trim() })}
            placeholder="https://api.openai.com/v1 或您的自定义代理网关"
            className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border-subtle text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
          />
          <span className="text-[11px] text-text-muted">
            遵循标准 OpenAI 规范，客户端将请求 <code className="font-mono text-accent">POST {currentConfig.baseUrl || '...'}/images/generations</code>
          </span>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">
            API Key（密钥）
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={currentConfig.apiKey}
              onChange={(e) => updateConfig(currentConfig.id, { apiKey: e.target.value.trim() })}
              placeholder="sk-..."
              className="w-full pl-3 pr-10 py-2 rounded-lg bg-bg-card border border-border-subtle text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary text-xs"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        {/* 重点：多模型管理与切换 */}
        <div className="space-y-2 pt-2 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">
              配置模型列表（支持多个模型自由切换）
            </label>
            <span className="text-[11px] text-text-muted">
              当前调用模型: <span className="font-mono text-accent font-semibold">{currentConfig.model}</span>
            </span>
          </div>

          {/* 已配置的模型药丸列表 */}
          <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-lg bg-bg-card border border-border-subtle">
            {currentConfig.availableModels && currentConfig.availableModels.length > 0 ? (
              currentConfig.availableModels.map((m) => {
                const isSelected = currentConfig.model === m;
                return (
                  <div
                    key={m}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono border transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/15 text-accent font-semibold shadow-xs'
                        : 'border-border-subtle bg-bg-secondary hover:bg-bg-tertiary text-text-secondary'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => updateConfig(currentConfig.id, { model: m })}
                      className="cursor-pointer"
                      title="点击设为当前生图模型"
                    >
                      {isSelected && <span className="mr-1 text-accent">●</span>}
                      {m}
                    </button>
                    {currentConfig.availableModels.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeModelFromConfig(currentConfig.id, m);
                        }}
                        className="ml-1 opacity-50 hover:opacity-100 hover:text-red-500 transition-opacity"
                        title="移除此模型"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-text-muted">暂无模型，请在下方添加</span>
            )}
          </div>

          {/* 添加新模型输入框 */}
          <form onSubmit={handleAddModel} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="输入要调用的模型名（如 FLUX.1-schnell、dall-e-3、sd3.5）"
              className="flex-1 px-3 py-1.5 rounded-lg bg-bg-card border border-border-subtle text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!newModelName.trim()}
              className="px-3 py-1.5 rounded-lg bg-accent text-text-inverse hover:bg-accent-hover text-xs font-medium transition-smooth disabled:opacity-40"
            >
              添加模型
            </button>
          </form>
        </div>
      </div>

      {/* 连通性测试 */}
      <div className="p-4 rounded-xl border border-border-subtle bg-bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-text-primary">API 接口连通性测试</div>
            <div className="text-[11px] text-text-muted">探测自定义端点与鉴权可用性（免扣费检测）</div>
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !currentConfig.baseUrl}
            className="px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/80 border border-border-subtle text-xs font-medium text-text-primary transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isTesting && (
              <svg className="animate-spin h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isTesting ? '正在探测...' : '测试连接'}
          </button>
        </div>

        {testResult && (
          <div className="p-3 rounded-lg bg-bg-secondary/60 border border-border-subtle space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">网络连通性：</span>
              <span className={testResult.connectivity.ok ? 'text-emerald-500 font-medium' : 'text-red-500 font-medium'}>
                {testResult.connectivity.message}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">鉴权与接口探测：</span>
              <span className={testResult.auth.ok ? 'text-emerald-500 font-medium' : 'text-red-500 font-medium'}>
                {testResult.auth.message}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">响应时延：</span>
              <span className={testResult.model.ok ? 'text-emerald-500 font-medium' : 'text-text-muted'}>
                {testResult.model.message}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
