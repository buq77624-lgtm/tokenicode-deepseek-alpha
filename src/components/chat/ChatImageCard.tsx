import { useState, useEffect } from 'react';
import type { ChatMessage } from '../../stores/chatStore';
import { useChatStore } from '../../stores/chatStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useImageStore } from '../../stores/imageStore';
import { useLightboxStore } from '../shared/ImageLightbox';
import { bridge } from '../../lib/tauri-bridge';
import { save } from '@tauri-apps/plugin-dialog';

interface Props {
  message: ChatMessage;
}

export function ChatImageCard({ message }: Props) {
  const data = message.imageGenerationData;
  const setAsWallpaper = useImageStore((s) => s.setAsWallpaper);
  const generateDirectly = useImageStore((s) => s.generateDirectly);
  const openLightbox = useLightboxStore((s) => s.open);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettingWallpaper, setIsSettingWallpaper] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const isGenerating = data?.status === 'generating';
  const isSuccess = data?.status === 'success';
  const isError = data?.status === 'error';

  // 动态计时器
  useEffect(() => {
    if (!isGenerating || !data?.startedAt) return;
    const updateElapsed = () => {
      setElapsedSeconds(Math.max(1, Math.floor((Date.now() - data.startedAt) / 1000)));
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [isGenerating, data?.startedAt]);

  // 显示提示
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 设为客户端壁纸
  const handleSetWallpaper = async () => {
    if (!data?.dataUrl && !data?.filePath) return;
    setIsSettingWallpaper(true);
    try {
      const ok = await setAsWallpaper({
        dataUrl: data.dataUrl,
        filePath: data.filePath,
      });
      if (ok) {
        showToast('已成功设为客户端壁纸！');
      } else {
        showToast('设置壁纸失败');
      }
    } catch {
      showToast('设置壁纸失败');
    } finally {
      setIsSettingWallpaper(false);
    }
  };

  // 另存为
  const handleSaveAs = async () => {
    if (!data?.dataUrl && !data?.filePath) return;
    try {
      const savePath = await save({
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
        defaultPath: `tokenicode_${Date.now()}.png`,
      });
      if (savePath) {
        if (data.filePath) {
          await bridge.copyFile(data.filePath, savePath);
          showToast('图片已导出保存');
        } else if (data.dataUrl) {
          const base64Data = data.dataUrl.split(',')[1] || data.dataUrl;
          await bridge.writeFileContent(savePath, base64Data);
          showToast('图片已导出保存');
        }
      }
    } catch {
      showToast('导出图片失败');
    }
  };

  // 复制图片
  const handleCopy = async () => {
    if (!data?.dataUrl) return;
    try {
      const res = await fetch(data.dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || 'image/png']: blob }),
      ]);
      showToast('图片已复制到剪贴板');
    } catch {
      showToast('复制图片失败');
    }
  };

  // 在文件夹中显示
  const handleRevealInFinder = async () => {
    if (data?.filePath) {
      try {
        await bridge.revealInFinder(data.filePath);
      } catch {
        showToast('打开文件位置失败');
      }
    }
  };

  // 重试生成
  const handleRetry = async () => {
    if (!data?.prompt) return;
    setIsRetrying(true);
    const tabId = useSessionStore.getState().selectedSessionId;
    if (!tabId) return;

    // 更新消息状态为 generating
    useChatStore.getState().updateMessage(tabId, message.id, {
      imageGenerationData: {
        ...data,
        status: 'generating',
        startedAt: Date.now(),
        error: undefined,
      },
    });

    try {
      const result = await generateDirectly({
        prompt: data.prompt,
        model: data.model,
      });

      useChatStore.getState().updateMessage(tabId, message.id, {
        imageGenerationData: {
          ...data,
          status: 'success',
          filePath: result.filePath,
          dataUrl: result.dataUrl,
          durationMs: Date.now() - (data.startedAt || Date.now()),
        },
      });
    } catch (err: any) {
      useChatStore.getState().updateMessage(tabId, message.id, {
        imageGenerationData: {
          ...data,
          status: 'error',
          error: err?.message || String(err),
        },
      });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="w-full max-w-xl my-2 rounded-2xl border border-border-subtle bg-bg-card shadow-sm overflow-hidden animate-fade-in text-text-primary">
      {/* 顶部状态与模型信息 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-secondary/40 border-b border-border-subtle text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span className="font-semibold text-text-primary">AI 原生生图</span>
          {data?.model && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent/15 text-accent border border-accent/20">
              {data.model}
            </span>
          )}
        </div>
        <div className="text-[11px] text-text-tertiary">
          {isGenerating && `绘制中 (${elapsedSeconds}s)`}
          {isSuccess && data?.durationMs && `耗时 ${(data.durationMs / 1000).toFixed(1)}s`}
        </div>
      </div>

      {/* 提示词区域 */}
      {data?.prompt && (
        <div className="px-4 py-2 bg-bg-secondary/20 border-b border-border-subtle/50 text-xs text-text-secondary leading-relaxed">
          <span className="text-text-tertiary mr-1 font-mono">Prompt:</span>
          {data.prompt}
        </div>
      )}

      {/* 核心内容区 */}
      <div className="relative p-4 flex flex-col items-center justify-center min-h-[200px]">
        {/* Toast 提示浮层 */}
        {toastMessage && (
          <div className="absolute top-6 z-30 px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs shadow-lg animate-in fade-in duration-200">
            {toastMessage}
          </div>
        )}

        {/* 生成中状态 */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="relative w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center animate-pulse">
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent animate-spin">
                <circle cx="8" cy="8" r="6" strokeDasharray="30" strokeDashoffset="10" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-text-primary">正在调用模型生成高精度图像...</div>
              <div className="text-[11px] text-text-tertiary mt-0.5">
                已耗时 {elapsedSeconds} 秒，请稍候
              </div>
            </div>
          </div>
        )}

        {/* 成功状态 */}
        {isSuccess && data?.dataUrl && (
          <div className="w-full flex flex-col items-center">
            <div
              className="relative group rounded-xl overflow-hidden border border-border-subtle shadow-md max-h-[460px] cursor-zoom-in"
              onClick={() => openLightbox(data.dataUrl!, data.filePath, data.prompt)}
            >
              <img
                src={data.dataUrl}
                alt={data.prompt}
                className="w-full h-auto object-contain max-h-[460px] transition-transform duration-300 group-hover:scale-[1.01]"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="7" cy="7" r="4.5" />
                    <path d="M10.5 10.5L14 14" />
                  </svg>
                  点击全屏放大
                </span>
              </div>
            </div>

            {/* 操作工具栏 */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-2 w-full border-t border-border-subtle/50">
              <button
                type="button"
                onClick={() => openLightbox(data.dataUrl!, data.filePath, data.prompt)}
                className="px-2.5 py-1.5 rounded-lg bg-bg-secondary hover:bg-bg-tertiary text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
                title="全屏放大查看"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5L14 14" />
                </svg>
                放大
              </button>

              <button
                type="button"
                onClick={handleSetWallpaper}
                disabled={isSettingWallpaper}
                className="px-2.5 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 text-xs text-accent font-medium transition-colors flex items-center gap-1"
                title="一键设为客户端壁纸"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="12" height="12" rx="2" />
                  <circle cx="5.5" cy="5.5" r="1.5" />
                  <path d="M14 10l-4-4-6 6" />
                </svg>
                设为壁纸
              </button>

              <button
                type="button"
                onClick={handleSaveAs}
                className="px-2.5 py-1.5 rounded-lg bg-bg-secondary hover:bg-bg-tertiary text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
                title="导出另存为"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 2v9M4 7l4 4 4-4M2 13h12" />
                </svg>
                另存为
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1.5 rounded-lg bg-bg-secondary hover:bg-bg-tertiary text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
                title="复制到剪贴板"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="5" width="8" height="8" rx="1.5" />
                  <path d="M3 11V3h8" />
                </svg>
                复制
              </button>

              {data.filePath && (
                <button
                  type="button"
                  onClick={handleRevealInFinder}
                  className="px-2.5 py-1.5 rounded-lg bg-bg-secondary hover:bg-bg-tertiary text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
                  title="在资源管理器中定位"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 4h4l1.5 2H14v7a1 1 0 0 1-1 1H2V4z" />
                  </svg>
                  定位
                </button>
              )}
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v4M8 11h.01" />
              </svg>
            </div>
            <div className="text-xs text-red-500 max-w-md px-4 break-words">
              {data?.error || '生成失败，请检查 API 配置或网络'}
            </div>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-3 py-1.5 rounded-lg bg-accent text-text-inverse hover:bg-accent-hover text-xs font-medium transition-colors"
            >
              {isRetrying ? '重试中...' : '重新生成'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
