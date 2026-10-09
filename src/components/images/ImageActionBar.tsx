import { useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { bridge } from '../../lib/tauri-bridge';
import { useLightboxStore } from '../shared/ImageLightbox';
import { useImageStore, type GeneratedImage } from '../../stores/imageStore';

interface Props {
  image: GeneratedImage;
}

export function ImageActionBar({ image }: Props) {
  const toggleFavorite = useImageStore((s) => s.toggleFavorite);
  const setAsWallpaper = useImageStore((s) => s.setAsWallpaper);
  const ensureImageDataUrl = useImageStore((s) => s.ensureImageDataUrl);

  const [wallpaperLoading, setWallpaperLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 1. 全屏放大看图
  const handleOpenLightbox = async () => {
    const dataUrl = await ensureImageDataUrl(image);
    useLightboxStore.getState().open(dataUrl, image.filePath, image.prompt);
  };

  // 2. 设为客户端壁纸
  const handleSetWallpaper = async () => {
    setWallpaperLoading(true);
    const ok = await setAsWallpaper(image);
    setWallpaperLoading(false);
    if (ok) {
      showToast('已成功设为 TOKENICODE 客户端壁纸！');
    } else {
      showToast('设置壁纸失败，请重试');
    }
  };

  // 3. 另存为
  const handleSaveAs = async () => {
    try {
      const defaultName = `tokenicode_${image.createdAt}.png`;
      const targetPath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'PNG 图像', extensions: ['png'] }],
      });
      if (typeof targetPath === 'string' && targetPath.trim()) {
        await bridge.copyFile(image.filePath, targetPath);
        showToast('图片已保存到本地！');
      }
    } catch (e) {
      console.error('另存为失败:', e);
      showToast('保存失败');
    }
  };

  // 4. 复制图片到剪贴板
  const handleCopyImage = async () => {
    try {
      const dataUrl = await ensureImageDataUrl(image);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || 'image/png']: blob }),
      ]);
      showToast('图片已复制到剪贴板！');
    } catch {
      // 剪贴板图像 API 失败时，回退为复制提示词
      try {
        await navigator.clipboard.writeText(image.prompt);
        showToast('已复制提示词到剪贴板');
      } catch {
        showToast('复制失败');
      }
    }
  };

  // 5. 在文件夹中高亮定位
  const handleRevealInFinder = async () => {
    try {
      await bridge.revealInFinder(image.filePath);
    } catch (e) {
      console.error('定位文件失败:', e);
    }
  };

  return (
    <div className="relative">
      {/* 提示小气泡 */}
      {toastMessage && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-accent text-white text-[11px] font-medium shadow-md whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 z-30">
          {toastMessage}
        </div>
      )}

      <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-card/90 backdrop-blur-md border border-border-subtle shadow-md">
        {/* 全屏放大 */}
        <button
          type="button"
          onClick={handleOpenLightbox}
          className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="全屏放大沉浸式看图"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
          </svg>
        </button>

        {/* 一键设为壁纸 */}
        <button
          type="button"
          onClick={handleSetWallpaper}
          disabled={wallpaperLoading}
          className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-accent transition-colors"
          title="一键设为客户端壁纸"
        >
          {wallpaperLoading ? (
            <svg className="animate-spin h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="2" width="12" height="10" rx="1.5" />
              <path d="M5 14h6M8 12v2" />
            </svg>
          )}
        </button>

        {/* 另存为 */}
        <button
          type="button"
          onClick={handleSaveAs}
          className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="另存为本地图片文件"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M14 10v3H2v-3M8 2v8M5 7l3 3 3-3" />
          </svg>
        </button>

        {/* 复制 */}
        <button
          type="button"
          onClick={handleCopyImage}
          className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="复制图片到剪贴板"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="5" y="5" width="9" height="9" rx="1.5" />
            <path d="M3 11V3a1 1 0 011-1h8" />
          </svg>
        </button>

        {/* 定位本地文件 */}
        <button
          type="button"
          onClick={handleRevealInFinder}
          className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="在文件夹中显示原始文件"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 3a1 1 0 011-1h3.5l1.5 2H13a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" />
          </svg>
        </button>

        {/* 收藏 */}
        <button
          type="button"
          onClick={() => toggleFavorite(image.id)}
          className={`p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors ${
            image.isFavorite ? 'text-red-500 fill-red-500' : 'text-text-secondary hover:text-red-400'
          }`}
          title={image.isFavorite ? '取消收藏' : '收藏这幅画作'}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill={image.isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M8 13.5l-5.3-5.3a3.5 3.5 0 015-5L8 3.5l.3-.3a3.5 3.5 0 015 5L8 13.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
