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
  const [copiedPrompt, setCopiedPrompt] = useState(false);

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

  const handleCopyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // 忽略
    }
  };

  const samplePrompts = [
    { title: '赛博朋克雨夜', prompt: '未来赛博朋克雨夜街道，霓虹灯光倒影在湿润的水泥路面，悬浮飞车穿梭，8k超清壁纸，电影级质感' },
    { title: '日系治愈少女', prompt: '盛夏晴空下的日系唯美少女，微风吹拂发丝，远处是蔚蓝的大海与灯塔，新海诚唯美治愈画风' },
    { title: '神秘星际深空', prompt: '宏伟的星际深空母舰，穿梭在璀璨的星云与流星雨中，虚幻引擎5渲染，超高细节' },
  ];

  // 空状态
  if (!currentImage) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center p-6 rounded-2xl bg-bg-card/40 border border-border-subtle/80 border-dashed text-center min-h-[300px]">
        <div className="w-12 h-12 rounded-2xl bg-bg-tertiary/70 border border-border-subtle flex items-center justify-center mb-2.5 text-text-tertiary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
        <h3 className="text-[13px] font-semibold text-text-primary mb-1">AI 原生生图工作台</h3>
        <p className="text-[11px] text-text-muted max-w-sm leading-relaxed mb-4">
          在上方输入画面描述词并点击生成，即可调用自定义模型绘制精美画作
        </p>

        {/* 灵感试用小卡片 */}
        <div className="w-full max-w-sm flex flex-col gap-1.5 text-left mb-3">
          <span className="text-[10px] text-text-tertiary px-1 font-medium">灵感速递（点击立即填入）：</span>
          {samplePrompts.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setPrompt(s.prompt)}
              className="px-2.5 py-1.5 rounded-lg bg-bg-card hover:bg-bg-tertiary border border-border-subtle hover:border-accent/40 text-left transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-[11px] font-medium text-text-secondary group-hover:text-accent truncate">
                  {s.title}
                </span>
                <span className="text-[10px] text-text-tertiary truncate">
                  {s.prompt}
                </span>
              </div>
              <span className="text-[10px] text-text-tertiary group-hover:text-accent font-mono flex-shrink-0">
                试用 ➔
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-text-tertiary font-mono">
          <span className="px-2 py-0.5 rounded bg-bg-tertiary border border-border-subtle">
            提供商: {activeConfig.name}
          </span>
          <span className="px-2 py-0.5 rounded bg-bg-tertiary border border-border-subtle">
            模型: {activeConfig.model.split('/').pop()}
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
            className="w-full h-full object-contain cursor-zoom-in max-h-[440px] select-none transition-transform duration-300 group-hover:scale-[1.01] animate-in fade-in"
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
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleCopyPrompt(currentImage.prompt)}
              className="px-2 py-1 rounded text-[10px] bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer"
              title="复制提示词到剪贴板"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="5" width="9" height="9" rx="1.5" />
                <path d="M3 11V3a1 1 0 011-1h8" />
              </svg>
              <span>{copiedPrompt ? '已复制' : '复制词'}</span>
            </button>
            <button
              type="button"
              onClick={() => setPrompt(currentImage.prompt)}
              className="px-2 py-1 rounded text-[10px] bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer"
              title="应用此提示词到输入框重新生成"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 8a6 6 0 1011.3-2.8M14 2v4h-4" />
              </svg>
              <span>复用词</span>
            </button>
          </div>
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
