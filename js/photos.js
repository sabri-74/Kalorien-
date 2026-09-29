// Fotos verkleinern und als kleine Vorschaubilder in IndexedDB ablegen,
// damit der Hauptspeicher (localStorage) schlank bleibt.

const DB_NAME = 'kalorien-photos';
const STORE = 'photos';
const memory = new Map();
let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function putPhoto(id, dataUrl) {
  memory.set(id, dataUrl);
  await tx('readwrite', (s) => s.put(dataUrl, id));
}

export async function getPhoto(id) {
  if (memory.has(id)) return memory.get(id);
  const v = await tx('readonly', (s) => s.get(id));
  if (v) memory.set(id, v);
  return v;
}

export async function deletePhoto(id) {
  memory.delete(id);
  await tx('readwrite', (s) => s.delete(id));
}

/** Setzt die Bildquelle aller <img data-photo="id"> in `root`. */
export async function hydratePhotos(root = document) {
  const imgs = [...root.querySelectorAll('img[data-photo]')];
  await Promise.all(
    imgs.map(async (img) => {
      const src = await getPhoto(img.dataset.photo);
      if (src) img.src = src;
      else img.closest('.thumb')?.classList.add('thumb-missing');
    }),
  );
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* Fallback unten, z. B. für ältere Browser */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function draw(bitmap, maxSide, square) {
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement('canvas');
  if (square) {
    const side = Math.min(w, h);
    canvas.width = canvas.height = Math.min(maxSide, side);
    canvas.getContext('2d').drawImage(bitmap, (w - side) / 2, (h - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  } else {
    const k = Math.min(1, maxSide / Math.max(w, h));
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

/**
 * Bereitet ein Foto auf: `blob` (max. 1280 px, JPEG) für die KI und
 * `thumb` (quadratisch, 240 px) als Data-URL für die Anzeige.
 */
export async function prepareImage(file) {
  const bitmap = await loadBitmap(file);
  const big = draw(bitmap, 1280, false);
  const blob = await new Promise((r) => big.toBlob(r, 'image/jpeg', 0.84));
  const thumb = draw(bitmap, 240, true).toDataURL('image/jpeg', 0.72);
  bitmap.close?.();
  return { blob, thumb };
}
