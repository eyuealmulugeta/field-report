// Photos are kept on the phone in IndexedDB (too big for localStorage), each one shrunk to at most
// 1600 px on its long side. The report holds only their id, time, zone, caption and the work item they show.

const DB = 'fr2-photos', STORE = 'photos', MAX = 1600;

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((ok, fail) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
  }
  return dbp;
}

const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((ok, fail) => {
    const t = d.transaction(STORE, mode), r = fn(t.objectStore(STORE));
    t.oncomplete = () => ok(r && r.result);
    t.onerror = () => fail(t.error);
  });
};

export const putPhoto = (id, blob) => tx('readwrite', s => s.put(blob, id));
export const getPhoto = id => tx('readonly', s => s.get(id));
export const deletePhoto = id => tx('readwrite', s => s.delete(id));

/**
 * 2.51.0 (owner, 5 Nov): the camera original, full size and quality, for Drive. A JPEG from the camera is kept byte for
 * byte; another picture type becomes a full-size JPEG at 95%. Kept as 'o_<id>' until it is in Drive.
 */
export const ORIG = id => `o_${id}`, SCREEN_MAX = 2560;
export async function original(file) {
  if (file.type === 'image/jpeg') return file;
  return reduce(file, 1e9, 0.95);
}
/** The screen copy for Central Hub: at most 2560 px, JPEG 92% (looks the same as the original on a screen). */
export const screenCopy = blob => reduce(blob, SCREEN_MAX, 0.92);
async function reduce(file, max, q) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  const src = bmp || await new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = URL.createObjectURL(file); });
  const k = Math.min(1, max / Math.max(src.width, src.height)), c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', q));
}

/** A camera picture shrunk to a JPEG of at most 1600 px (kept on the phone for the report and its PDF). */
export async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  const src = bmp || await new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = URL.createObjectURL(file); });
  const w = src.width, h = src.height, k = Math.min(1, MAX / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82));
}

/** Object URLs for thumbnails, made once per photo. */
const urls = new Map();
export async function photoUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const b = await getPhoto(id);
  const u = b ? URL.createObjectURL(b) : '';
  urls.set(id, u);
  return u;
}
export const cachedUrl = id => urls.get(id) || '';
