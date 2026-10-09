import React, { useState, useEffect } from 'react';
import { useImageStore, type GeneratedImage } from '../../stores/imageStore';

function ThumbnailItem({
  image,
  isSelected,
  onClick,
  onDelete,
}: {
  image: GeneratedImage;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const ensureImageDataUrl = useImageStore((s) => s.ensureImageDataUrl);
  const [src, setSrc] = useState(image.dataUrl);

  useEffect(() => {
    let active = true;
    if (!src || src.length < 50) {
      ensureImageDataUrl(image).then((url) => {
        if (active) setSrc(url);
      });
    }
    return () => {
      active = false;
    };
  }, [image, ensureImageDataUrl, src]);

  return (
    <div
      onClick={onClick}
      className={`relative group flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden cursor-pointer border transition-all ${
        isSelected
          ? 'border-accent ring-2 ring-accent/30 scale-105 shadow-sm'
          : 'border-border-subtle hover:border-text-tertiary opacity-80 hover:opacity-100'
      }`}
      title={image.prompt}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover select-none" />
      ) : (
        <div className="w-full h-full bg-bg-card flex items-center justify-center text-[9px] text-text-tertiary">
          ...
        </div>
      )}

      {/* 收藏小角标 */}
      {image.isFavorite && (
        <div className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
      )}

      {/* 悬停快捷删除按钮 */}
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all shadow-sm"
        title="删除此记录"
      >
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
    </div>
  );
}

export function ImageHistoryGallery() {
  const history = useImageStore((s) => s.history);
  const currentImage = useImageStore((s) => s.currentImage);
  const setCurrentImage = useImageStore((s) => s.setCurrentImage);
  const deleteHistoryItem = useImageStore((s) => s.deleteHistoryItem);
  const clearHistory = useImageStore((s) => s.clearHistory);

  const [onlyFavorites, setOnlyFavorites] = useState(false);

  if (history.length === 0) {
    return null;
  }

  const filteredHistory = onlyFavorites ? history.filter((h) => h.isFavorite) : history;

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-border-subtle/50">
      <div className="flex items-center justify-between text-[11px] text-text-tertiary">
        <div className="flex items-center gap-2">
          <span>历史图库 ({history.length})</span>
          <button
            type="button"
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors flex items-center gap-1 ${
              onlyFavorites
                ? 'bg-red-500/15 text-red-400 font-medium'
                : 'bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-muted hover:text-text-secondary'
            }`}
          >
            <span>♥ 收藏</span>
            {onlyFavorites && <span>({history.filter((h) => h.isFavorite).length})</span>}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (window.confirm('确定要清空全部生图历史吗？本地文件依然会保留在磁盘中。')) {
              clearHistory();
            }
          }}
          className="text-[10px] text-text-muted hover:text-red-400 transition-colors"
        >
          清空列表
        </button>
      </div>

      {/* 横向滚动列表 */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
        {filteredHistory.map((item) => (
          <ThumbnailItem
            key={item.id}
            image={item}
            isSelected={currentImage?.id === item.id}
            onClick={() => setCurrentImage(item)}
            onDelete={(e) => {
              e.stopPropagation();
              deleteHistoryItem(item.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
