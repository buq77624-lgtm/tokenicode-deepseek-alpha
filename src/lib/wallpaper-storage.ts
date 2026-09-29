/**
 * Wallpaper storage.
 *
 * The image is kept as a Blob in IndexedDB and handed to CSS as an object URL,
 * so the base64 text never has to live in the JS heap or in localStorage.
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

/** Save wallpaper blob to IndexedDB */
export async function saveWallpaperToDb(blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ id: WALLPAPER_KEY, blob, updatedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Load active wallpaper blob from IndexedDB with safety timeout */
export async function loadWallpaperFromDb(): Promise<Blob | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(null), 2500);
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(WALLPAPER_KEY);
      req.onsuccess = () => {
        clearTimeout(timer);
        const record = req.result;
        if (record?.blob) {
          resolve(record.blob);
        } else if (record?.dataUrl) {
          const migrated = dataUrlToBlob(record.dataUrl);
          saveWallpaperToDb(migrated).catch(() => {});
          resolve(migrated);
        } else {
          resolve(null);
        }
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

/** Convert a legacy data URL into a blob so it can be stored in the new format */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = /:(.*?);/.exec(meta)?.[1] || 'image/webp';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
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

interface OptimizeResult {
  blob: Blob;
  originalSize: number;
  optimizedSize: number;
  width: number;
  height: number;
}

/** The wallpaper only ever covers the window, so never decode more than the display can show. */
function maxWallpaperSize() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  return {
    width: Math.min(2560, Math.round(Math.max(window.innerWidth, screen.width) * dpr)),
    height: Math.min(1440, Math.round(Math.max(window.innerHeight, screen.height) * dpr)),
  };
}

/**
 * Resize and re-encode a user-selected wallpaper.
 * Large source files are handled without ever materialising a base64 copy of the result.
 */
export async function optimizeWallpaperImage(file: File): Promise<OptimizeResult> {
  const originalSize = file.size;
  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('图片格式不受支持或已损坏'));
      img.src = sourceUrl;
    });

    const cap = maxWallpaperSize();
    let { width, height } = img;
    if (width > cap.width || height > cap.height) {
      const ratio = Math.min(cap.width / width, cap.height / height);
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

    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const supportsWebp = probe.toDataURL('image/webp').startsWith('data:image/webp');
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, supportsWebp ? 'image/webp' : 'image/jpeg', 0.85),
    );
    if (!blob) {
      throw new Error('图片编码失败');
    }

    return { blob, originalSize, optimizedSize: blob.size, width, height };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
