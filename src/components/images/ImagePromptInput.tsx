import React, { useRef, useEffect, useState } from 'react';
import { useImageStore } from '../../stores/imageStore';

const INSPIRATION_TAGS = [
  '8k超清壁纸',
  '二次元唯美',
  '赛博朋克雨夜',
  '日系清新治愈',
  '概念艺术插画',
  '电影级光影',
  '微距景深摄影',
];

export function ImagePromptInput() {
  const prompt = useImageStore((s) => s.prompt);
  const setPrompt = useImageStore((s) => s.setPrompt);
  const isGenerating = useImageStore((s) => s.isGenerating);
  const generationSeconds = useImageStore((s) => s.generationSeconds);
  const errorMessage = useImageStore((s) => s.errorMessage);
  const generate = useImageStore((s) => s.generate);
  const activeConfig = useImageStore((s) => s.getActiveConfig());
  const setConfigModalOpen = useImageStore((s) => s.setConfigModalOpen);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/macintosh|mac os x/i.test(navigator.userAgent));
  }, []);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isGenerating && prompt.trim()) {
        generate();
      }
    }
  };

  const handleAppendTag = (tag: string) => {
    if (isGenerating) return;
    const current = prompt.trim();
    if (!current) {
      setPrompt(tag);
    } else if (current.includes(tag)) {
      // 已经包含则不重复添加
      return;
    } else {
      setPrompt(`${current}, ${tag}`);
    }
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 错误提示条 */}
      {errorMessage && (
        <div className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] leading-relaxed animate-in fade-in">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="flex-shrink-0 mt-0.5 text-red-400"
            >
              <circle cx="8" cy="8" r="7" />
              <path d="M8 5v4M8 12h.01" />
            </svg>
            <span className="break-words">{errorMessage}</span>
          </div>
          {errorMessage.includes('API Key') && (
            <button
              type="button"
              onClick={() => setConfigModalOpen(true)}
              className="px-2 py-0.5 text-[11px] font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              前往配置
            </button>
          )}
        </div>
      )}

      {/* 文本输入框容器 */}
      <div className="relative rounded-xl border border-border-subtle bg-bg-card focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30 transition-all shadow-sm">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          rows={2}
          placeholder="输入画面描述 (Prompt)，支持中英文，如：未来赛博朋克风的程序员桌面，全息投影，雨夜霓虹，8k壁纸..."
          className="w-full px-3 pt-2.5 pb-8 text-[13px] leading-relaxed bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none"
        />

        {/* 输入框右下角辅助操作 */}
        <div className="absolute right-2 bottom-2 flex items-center gap-1.5 text-text-tertiary">
          {prompt && !isGenerating && (
            <button
              type="button"
              onClick={() => setPrompt('')}
              className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
              title="清空提示词"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
          <span className="text-[10px] text-text-muted select-none">
            {prompt.length > 0 ? `${prompt.length} 字` : `${isMac ? '⌘' : 'Ctrl'} + ↵ 生成`}
          </span>
        </div>
      </div>

      {/* 灵感快捷标签 */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
        <span className="text-[10px] text-text-tertiary flex-shrink-0 select-none mr-0.5">灵感:</span>
        {INSPIRATION_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleAppendTag(tag)}
            className="px-2 py-0.5 rounded-full text-[10px] bg-bg-card hover:bg-bg-tertiary border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary transition-colors flex-shrink-0 cursor-pointer"
          >
            + {tag}
          </button>
        ))}
      </div>

      {/* 生成大按钮 */}
      <button
        type="button"
        onClick={() => generate()}
        disabled={isGenerating || !prompt.trim()}
        className={`w-full py-2.5 px-4 rounded-xl font-medium text-[13px] flex items-center justify-center gap-2 transition-all shadow-sm ${
          isGenerating
            ? 'bg-accent/70 text-white cursor-wait animate-pulse'
            : !prompt.trim()
            ? 'bg-bg-tertiary text-text-muted border border-border-subtle cursor-not-allowed'
            : 'bg-accent hover:opacity-90 active:scale-[0.99] text-white cursor-pointer'
        }`}
      >
        {isGenerating ? (
          <>
            <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>AI 正在绘制中... ({generationSeconds}s)</span>
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2l2 2-8 8-3 1 1-3 8-8z" />
              <path d="M10 4l2 2" />
              <path d="M2 14h12" />
            </svg>
            <span>立即生成图像 ({activeConfig.model.split('/').pop()})</span>
          </>
        )}
      </button>
    </div>
  );
}
