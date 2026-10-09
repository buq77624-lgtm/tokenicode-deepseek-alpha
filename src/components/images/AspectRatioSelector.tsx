import { useImageStore } from '../../stores/imageStore';
import { resolveResolution, type ImageAspectRatio } from '../../lib/image-presets';

interface Option {
  ratio: ImageAspectRatio;
  label: string;
  sub: string;
  iconWidth: number;
  iconHeight: number;
}

const OPTIONS: Option[] = [
  { ratio: '1:1', label: '1:1', sub: '头像/方形', iconWidth: 14, iconHeight: 14 },
  { ratio: '16:9', label: '16:9', sub: '桌面壁纸/横幅', iconWidth: 18, iconHeight: 10 },
  { ratio: '9:16', label: '9:16', sub: '手机竖屏', iconWidth: 10, iconHeight: 18 },
  { ratio: '4:3', label: '4:3', sub: '经典横幅', iconWidth: 16, iconHeight: 12 },
  { ratio: '3:4', label: '3:4', sub: '经典竖幅', iconWidth: 12, iconHeight: 16 },
];

export function AspectRatioSelector() {
  const currentRatio = useImageStore((s) => s.aspectRatio);
  const setRatio = useImageStore((s) => s.setAspectRatio);
  const activeConfig = useImageStore((s) => s.getActiveConfig());

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px] text-text-tertiary">
        <span>画布比例与分辨率</span>
        <span className="font-mono text-[10px] text-text-muted">
          {resolveResolution(activeConfig.model, currentRatio)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {OPTIONS.map((opt) => {
          const isSelected = currentRatio === opt.ratio;
          return (
            <button
              key={opt.ratio}
              type="button"
              onClick={() => setRatio(opt.ratio)}
              className={`flex-1 min-w-[56px] py-1.5 px-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                isSelected
                  ? 'border-accent bg-accent/15 text-accent shadow-sm'
                  : 'border-border-subtle bg-bg-card hover:bg-bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
              title={`${opt.label} (${opt.sub})`}
            >
              <div className="h-5 flex items-center justify-center">
                <div
                  className={`rounded-sm border ${
                    isSelected ? 'border-accent bg-accent/30' : 'border-text-tertiary/60 bg-transparent'
                  }`}
                  style={{ width: `${opt.iconWidth}px`, height: `${opt.iconHeight}px` }}
                />
              </div>
              <span className="text-[11px] font-medium leading-none font-mono">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
