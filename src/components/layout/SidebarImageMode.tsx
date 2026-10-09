import { useState, useRef, useEffect } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { useSettingsStore } from '../../stores/settingsStore';

export function SidebarImageMode() {
  const isImageMode = useImageStore((s) => s.isImageMode);
  const toggleImageMode = useImageStore((s) => s.toggleImageMode);
  const configs = useImageStore((s) => s.configs);
  const activeConfigId = useImageStore((s) => s.activeConfigId);
  const selectModel = useImageStore((s) => s.selectModel);
  const openSettingsTab = useSettingsStore((s) => s.openSettingsTab);

  const [openPopover, setOpenPopover] = useState(false);
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
  const availableModels =
    activeConfig.availableModels && activeConfig.availableModels.length > 0
      ? activeConfig.availableModels
      : [currentModel];

  // 点击外部关闭弹层
  useEffect(() => {
    if (!openPopover) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPopover(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPopover]);

  const handleOpenSettingsImages = () => {
    setOpenPopover(false);
    openSettingsTab('images');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 侧栏常驻按钮 */}
      <button
        type="button"
        onClick={() => setOpenPopover(!openPopover)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-smooth cursor-pointer ${
          isImageMode
            ? 'bg-accent/15 text-accent font-medium border border-accent/25 shadow-xs'
            : 'text-text-muted hover:bg-bg-secondary hover:text-text-primary'
        }`}
        title={isImageMode ? '生图模式生效中：点击配置模型或切换' : '点击开启生图模式或选择生图模型'}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              <circle cx="5.5" cy="5.5" r="1.5" />
              <path d="M14 10l-4-4-6 6" />
              <rect x="2" y="2" width="12" height="12" rx="2" />
            </svg>
            {isImageMode && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
            )}
          </div>
          <span className="truncate">生图模式</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-card/70 text-text-secondary border border-border-subtle/60 max-w-[84px] truncate">
            {currentModel.split('/').pop()}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className={`transition-transform duration-150 ${openPopover ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </button>

      {/* 弹出的生图配置与模型切换控制卡片 */}
      {openPopover && (
        <div className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl border border-border-subtle bg-bg-card shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 space-y-3">
          {/* 顶部标题与接口说明 */}
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs font-semibold text-text-primary">AI 原生生图</span>
            </div>
            <span className="text-[10px] text-accent font-medium px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 truncate max-w-[120px]">
              {activeConfig.name}
            </span>
          </div>

          {/* 生图模式总开关行 */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-bg-secondary/40 border border-border-subtle/50">
            <div className="flex flex-col pr-2">
              <span className="text-xs font-medium text-text-primary">
                {isImageMode ? '生图模式已开启' : '生图模式已关闭'}
              </span>
              <span className="text-[10px] text-text-tertiary leading-tight mt-0.5">
                {isImageMode
                  ? '输入框发送内容将直接生成图片'
                  : '对话中说「帮我画一张...」会自动调用'}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleImageMode}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isImageMode ? 'bg-accent' : 'bg-bg-tertiary'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isImageMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 当前可用模型列表 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-medium text-text-secondary px-1">
              <span>调用模型</span>
              <span className="text-[10px] text-text-tertiary">点击切换</span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-0.5 pr-0.5">
              {availableModels.map((m) => {
                const isSelected = currentModel === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      selectModel(m);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-accent/15 text-accent font-medium border border-accent/20'
                        : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                    }`}
                  >
                    <span className="truncate mr-2">{m}</span>
                    {isSelected && <span className="text-accent text-xs font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 底部跳转设置 */}
          <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between">
            <button
              type="button"
              onClick={handleOpenSettingsImages}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-accent hover:bg-bg-secondary transition-colors cursor-pointer"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="2.5" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
              </svg>
              <span>配置接口与添加模型...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
