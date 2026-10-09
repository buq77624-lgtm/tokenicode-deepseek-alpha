import { useState, useRef, useEffect } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface Props {
  isImageMode: boolean;
  onToggleImageMode: () => void;
  disabled?: boolean;
}

export function ImageChatModelSelector({ isImageMode, onToggleImageMode, disabled = false }: Props) {
  const configs = useImageStore((s) => s.configs);
  const activeConfigId = useImageStore((s) => s.activeConfigId);
  const selectModel = useImageStore((s) => s.selectModel);
  const toggleSettings = useSettingsStore((s) => s.toggleSettings);

  const [openDropdown, setOpenDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeConfig =
    configs.find((c) => c.id === activeConfigId) || configs[0] || {
      id: 'custom_default',
      name: '自定义 API',
      baseUrl: '',
      apiKey: '',
      model: 'dall-e-3',
      availableModels: ['dall-e-3'],
    };

  const currentModel = activeConfig.model || 'dall-e-3';
  const availableModels = activeConfig.availableModels && activeConfig.availableModels.length > 0
    ? activeConfig.availableModels
    : [currentModel];

  // 点击外部关闭下拉
  useEffect(() => {
    if (!openDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openDropdown]);

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* 生图模式切换主按钮 */}
      <button
        type="button"
        onClick={onToggleImageMode}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
          isImageMode
            ? 'border-accent bg-accent/15 text-accent shadow-xs'
            : 'border-border-subtle bg-bg-secondary/40 text-text-muted hover:text-text-primary hover:bg-bg-secondary'
        }`}
        title={isImageMode ? '退出生图模式，切回常规对话' : '开启对话流原生 AI 生图模式'}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="5.5" cy="5.5" r="1.5" />
          <path d="M14 10l-4-4-6 6" />
          <rect x="2" y="2" width="12" height="12" rx="2" />
        </svg>
        <span>生图模式</span>
        {isImageMode && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
      </button>

      {/* 当处于生图模式时，紧挨着显示多模型选择器药丸 */}
      {isImageMode && (
        <button
          type="button"
          onClick={() => setOpenDropdown(!openDropdown)}
          disabled={disabled}
          className="ml-1.5 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer"
          title="切换当前生图调用的模型"
        >
          <span className="max-w-[120px] truncate">{currentModel.split('/').pop()}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform duration-150 ${openDropdown ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      )}

      {/* 模型选择下拉浮层 */}
      {openDropdown && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-56 rounded-xl border border-border-subtle bg-bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 p-1.5 space-y-1">
          <div className="px-2 py-1 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center justify-between">
            <span>选择生图模型</span>
            <span className="text-[10px] text-accent font-normal">{activeConfig.name}</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {availableModels.map((m) => {
              const isSelected = currentModel === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    selectModel(m);
                    setOpenDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors ${
                    isSelected
                      ? 'bg-accent/15 text-accent font-semibold'
                      : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                  }`}
                >
                  <span className="truncate">{m}</span>
                  {isSelected && <span className="text-accent text-xs">✓</span>}
                </button>
              );
            })}
          </div>

          {/* 底部跳转设置添加更多模型 */}
          <div className="pt-1 mt-1 border-t border-border-subtle/60">
            <button
              type="button"
              onClick={() => {
                setOpenDropdown(false);
                toggleSettings();
              }}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-text-tertiary hover:text-accent hover:bg-bg-secondary transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="2.5" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
              </svg>
              <span>配置/添加更多模型...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
