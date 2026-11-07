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

const s = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const ACTIONS = ['generate', 'print', 'share', 'email', 'download', 'save', 'view', 'send'];
/** 2.59.0 (G1): a line of the activity record, the shape Central Hub's rules accept (engine/activity.js there). */
export function actEntry(e, who, now = Date.now()) {
  return {
    id: `FR_${now.toString(36)}_${rand()}`, app: 'FR', email: s(who.email, 120).toLowerCase(), name: s(who.name, 80), position: s(who.position, 60),
    project: s(who.project, 60), projectName: s(who.projectName, 80), page: s(e.page, 60), action: ACTIONS.includes(e.action) ? e.action : 'save',
    channel: s(e.channel, 40), doc: s(e.doc, 120), no: s(e.no, 40), to: s(e.to, 160), at: now,
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
