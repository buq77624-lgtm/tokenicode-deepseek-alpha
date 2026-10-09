import { useImageStore } from '../../stores/imageStore';
import { ImagePromptInput } from './ImagePromptInput';
import { AspectRatioSelector } from './AspectRatioSelector';
import { ImageDetailView } from './ImageDetailView';
import { ImageHistoryGallery } from './ImageHistoryGallery';
import { ImageConfigModal } from './ImageConfigModal';

export function ImageWorkbench() {
  const activeConfig = useImageStore((s) => s.getActiveConfig());
  const setConfigModalOpen = useImageStore((s) => s.setConfigModalOpen);

  return (
    <div className="flex flex-col h-full bg-bg-primary text-text-primary overflow-hidden">
      {/* 顶部小标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-bg-card/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-accent/15 flex items-center justify-center text-accent">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <circle cx="5.5" cy="5.5" r="1.5" />
              <path d="M14 10l-4-4-6 6" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold text-text-primary">AI 原生生图</span>

          {/* 活跃提供商与模型胶囊 */}
          <button
            type="button"
            onClick={() => setConfigModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-tertiary hover:bg-bg-tertiary/80 border border-border-subtle text-[11px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer ml-1"
            title="点击切换或配置模型与 API"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="max-w-[120px] truncate font-medium">{activeConfig.name}</span>
            <span className="text-text-tertiary">/</span>
            <span className="max-w-[110px] truncate text-text-tertiary font-mono">
              {activeConfig.model.split('/').pop()}
            </span>
          </button>
        </div>

        {/* 右侧设置齿轮 */}
        <button
          type="button"
          onClick={() => setConfigModalOpen(true)}
          className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-accent transition-colors"
          title="模型与 API 配置"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M13.5 8c0-.3-.03-.6-.08-.9l1.4-1.1c.13-.1.16-.3.08-.45l-1.3-2.3c-.08-.14-.26-.2-.4-.14l-1.6.6c-.4-.3-.8-.5-1.3-.7L10.1 1.4c-.03-.16-.17-.28-.34-.28H7.2c-.17 0-.3.12-.34.28L6.6 3.1c-.5.2-.9.4-1.3.7l-1.6-.6c-.15-.06-.32 0-.4.14l-1.3 2.3c-.08.15-.05.35.08.45l1.4 1.1c-.05.3-.08.6-.08.9s.03.6.08.9l-1.4 1.1c-.13.1-.16.3-.08.45l1.3 2.3c.08.14.26.2.4.14l1.6-.6c.4.3.8.5 1.3.7l.26 1.7c.03.16.17.28.34.28h2.6c.17 0 .3-.12.34-.28l.26-1.7c.5-.2.9-.4 1.3-.7l1.6.6c.15.06.32 0 .4-.14l1.3-2.3c.08-.15.05-.35-.08-.45l-1.4-1.1c.05-.3.08-.6.08-.9z" />
          </svg>
        </button>
      </div>

      {/* 滚动工作区 */}
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 min-h-0">
        {/* 提示词输入区 */}
        <ImagePromptInput />

        {/* 比例与分辨率切换 */}
        <AspectRatioSelector />

        {/* 主画板大图展示 */}
        <ImageDetailView />

        {/* 底栏历史缩略图图库 */}
        <ImageHistoryGallery />
      </div>

      {/* 配置弹窗 */}
      <ImageConfigModal />
    </div>
  );
}
