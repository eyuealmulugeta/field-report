// 2.58.0 (owner, 7 Nov, Phase G2): this phone's sessions in Central Hub's sign-in history (signlog/<id>), the same
// shape as Central Hub's engine/signlog.js. A session starts when the app is in front and signed in, is kept fresh
// every minute, and a new one starts after the app was away more than 3 minutes. Signing out ends it.

export const BEAT_MS = 60 * 1000;
export const STALE_MS = 3 * 60 * 1000;

const rand = () => Math.random().toString(36).slice(2, 8);

export function newEntry({ email, name = '', position = '', projects = [], device = '', mode = '', now = Date.now() }) {
  return {
    id: `FR_${now.toString(36)}_${rand()}`, app: 'FR', email: String(email || '').toLowerCase(), name: String(name || '').slice(0, 80), position: String(position || '').slice(0, 60),
    projects: (projects || []).map(String).slice(0, 20), device: String(device || '').slice(0, 80), mode: mode === 'app' || mode === 'browser' ? mode : '',
    start: now, last: now, end: 0, how: '',
  };
}

/** io: { create(entry), touch(id, last), close(id, end), place(id) } (each may fail quietly). */
export function presence(make, io) {
  let cur = null;
  const quiet = p => Promise.resolve(p).catch(() => {});
  return {
    tick(now = Date.now()) {
      const e = !cur || now - cur.last > STALE_MS ? make(now) : null;
      if (e) { cur = e; quiet(Promise.resolve(io.create(e)).then(() => io.place(e.id))); }
      else if (now - cur.last >= BEAT_MS - 5000) { cur.last = now; quiet(io.touch(cur.id, now)); }
    },
    hide(now = Date.now()) { if (cur && now - cur.last <= STALE_MS) { cur.last = now; quiet(io.touch(cur.id, now)); } },
    async signOut(now = Date.now()) { const c = cur; cur = null; if (c) await quiet(io.close(c.id, now)); },
    current: () => cur,
  };
}
