/**
 * Wallpaper Storage and Optimization Module
 *
 * Solves the browser localStorage quota exceeded problem by:
 * 1. Intelligently scaling and compressing ultra-large images (e.g. 10MB - 100MB 4K/8K images)
 *    into crisp, lightweight WebP/JPEG format using offscreen canvas.
 * 2. Persisting full-resolution wallpaper assets in IndexedDB (which has no 5MB limit).
 */

const DB_NAME = 'tokenicode_assets';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';
const WALLPAPER_KEY = 'active_wallpaper';

/** Open or initialize the IndexedDB database */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const timer = setTimeout(() => {
      reject(new Error('IndexedDB open timeout'));
    }, 2500);

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onblocked = () => {
      clearTimeout(timer);
      console.warn('[wallpaper-storage] IndexedDB open blocked');
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
  });
}

/** Save wallpaper Data URL to IndexedDB */
export async function saveWallpaperToDb(dataUrl: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ id: WALLPAPER_KEY, dataUrl, updatedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Load active wallpaper Data URL from IndexedDB with safety timeout */
export async function loadWallpaperFromDb(): Promise<string | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(null), 2500);
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(WALLPAPER_KEY);
      req.onsuccess = () => {
        clearTimeout(timer);
        resolve(req.result?.dataUrl || null);
      };
      req.onerror = () => {
        clearTimeout(timer);
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('[wallpaper-storage] failed to load from IndexedDB:', err);
    return null;
  }
}

/** Clear active wallpaper from IndexedDB */
export async function clearWallpaperFromDb(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(WALLPAPER_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[wallpaper-storage] failed to clear from IndexedDB:', err);
  }
}

export interface OptimizeResult {
  dataUrl: string;
  originalSize: number;
  optimizedSize: number;
  width: number;
  height: number;
}

/**
 * Intelligently compress and resize user-selected wallpaper image.
 * Safely processes images of any size (even 50MB+) by drawing them onto an offscreen canvas
 * at optimal resolution (max 2560x1440 or 3840x2160) and encoding as high-quality WebP.
 */
export async function optimizeWallpaperImage(file: File): Promise<OptimizeResult> {
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('无法读取文件'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片格式不受支持或已损坏'));
      img.onload = () => {
        try {
          let { width, height } = img;

          // Max bounds for crisp display without wasteful memory consumption (QHD max 2560x1440)
          const MAX_W = 2560;
          const MAX_H = 1440;

          if (width > MAX_W || height > MAX_H) {
            const ratio = Math.min(MAX_W / width, MAX_H / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('无法创建 Canvas 上下文');
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // WebP format offers superior compression with high visual fidelity
          let dataUrl = canvas.toDataURL('image/webp', 0.85);
          if (!dataUrl.startsWith('data:image/webp')) {
            // Fallback for browsers that don't support WebP export
            dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          }

          // Approximate size in bytes from base64 string
          const optimizedSize = Math.round((dataUrl.length * 3) / 4);

          resolve({
            dataUrl,
            originalSize,
            optimizedSize,
            width,
            height,
          });
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
