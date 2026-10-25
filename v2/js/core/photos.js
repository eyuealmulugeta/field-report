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

/** A camera picture shrunk to a JPEG of at most 1600 px. */
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
