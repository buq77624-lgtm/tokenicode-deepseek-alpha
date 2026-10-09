import { useState, useEffect } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { ImageActionBar } from './ImageActionBar';
import { useLightboxStore } from '../shared/ImageLightbox';

export function ImageDetailView() {
  const currentImage = useImageStore((s) => s.currentImage);
  const isGenerating = useImageStore((s) => s.isGenerating);
  const generationSeconds = useImageStore((s) => s.generationSeconds);
  const aspectRatio = useImageStore((s) => s.aspectRatio);
  const activeConfig = useImageStore((s) => s.getActiveConfig());
  const ensureImageDataUrl = useImageStore((s) => s.ensureImageDataUrl);
  const setPrompt = useImageStore((s) => s.setPrompt);

  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (currentImage) {
      if (currentImage.dataUrl && currentImage.dataUrl.length > 50) {
        setDataUrl(currentImage.dataUrl);
      } else {
        ensureImageDataUrl(currentImage).then((url) => {
          if (active) setDataUrl(url);
        });
      }
    } else {
      setDataUrl('');
    }
    return () => {
      active = false;
    };
  }, [currentImage, ensureImageDataUrl]);

  // 生成中骨架屏
  if (isGenerating) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center p-6 rounded-2xl bg-bg-card/60 border border-border-subtle relative overflow-hidden min-h-[300px]">
        {/* 动态微光光晕 */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />

        <div className="flex flex-col items-center gap-3 z-10 text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-accent animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-accent text-white text-[9px] font-mono font-bold">
              {generationSeconds}s
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold text-text-primary">AI 正在精心构思并绘制中...</span>
            <span className="text-[12px] text-text-tertiary">
              模型: {activeConfig.model.split('/').pop()} · 画布: {aspectRatio}
            </span>
          </div>

          <span className="text-[11px] text-text-muted mt-2 max-w-xs">
            生成高画质图像可能需要 10 ~ 30 秒，请稍候片刻
          </span>
        </div>
      </div>
    );
  }

  // 空状态
  if (!currentImage) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center p-8 rounded-2xl bg-bg-card/40 border border-border-subtle/80 border-dashed text-center min-h-[280px]">
        <div className="w-14 h-14 rounded-2xl bg-bg-tertiary/70 border border-border-subtle flex items-center justify-center mb-3 text-text-tertiary">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
        <h3 className="text-[14px] font-medium text-text-secondary mb-1">AI 原生生图工作台</h3>
        <p className="text-[12px] text-text-muted max-w-sm leading-relaxed mb-4">
          在上方输入描述词并点击生成，即可调用 FLUX、DALL-E 3、SD3 等模型进行绘制
        </p>
        <div className="flex items-center gap-2 text-[11px] text-text-tertiary font-mono">
          <span className="px-2 py-0.5 rounded bg-bg-tertiary border border-border-subtle">
            当前提供商: {activeConfig.name}
          </span>
          <span className="px-2 py-0.5 rounded bg-bg-tertiary border border-border-subtle">
            {activeConfig.model.split('/').pop()}
          </span>
        </div>
      </div>
    );
  }

  // 展示大图
  return (
    <div className="flex-1 w-full flex flex-col gap-3 min-h-0">
      {/* 图像容器 */}
      <div className="relative group rounded-2xl overflow-hidden border border-border-subtle bg-bg-card/80 flex items-center justify-center max-h-[460px] min-h-[220px]">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={currentImage.prompt}
            onClick={() => useLightboxStore.getState().open(dataUrl, currentImage.filePath, currentImage.prompt)}
            className="w-full h-full object-contain cursor-zoom-in max-h-[440px] select-none transition-transform duration-300 group-hover:scale-[1.01]"
          />
        ) : (
          <div className="flex items-center justify-center h-48 text-text-tertiary text-[12px]">
            正在从本地磁盘加载图片...
          </div>
        )}

        {/* 浮动操作栏（右上角） */}
        <div className="absolute top-2.5 right-2.5 z-20">
          <ImageActionBar image={currentImage} />
        </div>

        {/* 左上角规格角标 */}
        <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg bg-bg-card/85 backdrop-blur-md border border-border-subtle text-[10px] font-mono text-text-tertiary pointer-events-none flex items-center gap-1.5 shadow-sm">
          <span>{currentImage.size}</span>
          <span>·</span>
          <span>{currentImage.aspectRatio}</span>
        </div>
      </div>

      {/* 提示词与详情信息 */}
      <div className="p-3 rounded-xl bg-bg-card/50 border border-border-subtle flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] leading-relaxed text-text-primary line-clamp-3 select-text font-normal">
            {currentImage.prompt}
          </p>
          <button
            type="button"
            onClick={() => setPrompt(currentImage.prompt)}
            className="px-2 py-1 rounded text-[10px] bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 flex-shrink-0"
            title="应用此提示词到输入框重新生成"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 8a6 6 0 1011.3-2.8M14 2v4h-4" />
            </svg>
            <span>复用词</span>
          </button>
        </div>

        {/* DALL-E 3 润色提示词（若有） */}
        {currentImage.revisedPrompt && (
          <details className="text-[11px] text-text-tertiary cursor-pointer group">
            <summary className="hover:text-text-secondary select-none">
              查看 AI 自动润色提示词 (Revised Prompt)
            </summary>
            <p className="mt-1.5 p-2 rounded bg-bg-tertiary/40 border border-border-subtle/50 text-text-secondary leading-relaxed font-sans text-[11px] select-text">
              {currentImage.revisedPrompt}
            </p>
          </details>
        )}

        <div className="flex items-center justify-between text-[10px] text-text-muted font-mono pt-1 border-t border-border-subtle/40">
          <span>
            {currentImage.providerName} · {currentImage.model.split('/').pop()}
          </span>
          <span>{new Date(currentImage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}
