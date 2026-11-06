// Everything the app holds, saved on the phone after every change.

const KEY = 'fr2.v1';

const blank = () => ({
  auth: null,          // { token, who, role, email, name }
  profile: { name: '', position: '' },
  projects: [],        // from getconfig + myProjects
  proj: '',            // the project in use
  drafts: {},          // 'MJO|2026-10-20' -> report
  outbox: [],          // [{ action, body, at }] waiting for a connection
  lastNo: {},          // 'MJO' -> last report number used
  siteZones: {},       // 'MJO' -> zones the site added to the office's list
  known: {},           // file name -> the office's answer { status, version, comments, checked }
  gone: {},            // 2.42.0: project code -> ids of the crew deleted in Central Hub (kept out before the team arrives)
  others: {},          // 2.9.0: project code -> the reports sent from any phone [{ date, no, status, version, by, name }]
  knownAt: 0,          // when the office was last asked
  dev: '',             // this phone's id, so a draft saved here is not offered back to it
  seenNew: '',         // the version whose "What's new" was seen
  remindedOn: '',      // the day the 17:00 reminder went out
  inbox: [],           // 2.0.1: the last notifications sent to this person [{ t, h, m, c, f }] (script 7.29.0)
  inboxSeen: '',       // 2.0.1: notifications up to this time were cleared from Today
  pushAppId: '',       // 2.0.1: the OneSignal app id, kept after the first ask
  reqQueue: [],        // 2.25.0: requests for another day not shared yet [{ code, date, q }], shared when the connection is back
  spots: [],           // 2.7.0: Spotlight notes made on this phone, newest first; sent ones are kept as a short list
  videos: [],          // 2.50.0: report videos [{ id, proj, date, time, type, sent }], the file in the photo store until sent
});

/** 2.53.0: a smaller copy when the phone's storage is full: receipt pictures of sent reports (they are in the database),
 *  then sent reports older than 30 days (they are in Drive and Central Hub). */
export function slim(state, now = Date.now()) {
  const drafts = {};
  for (const [k, r] of Object.entries(state.drafts || {})) {
    if (!r) continue;
    if (r.sentAt && now - r.sentAt > 30 * 864e5) continue;
    drafts[k] = r.sentAt && (r.requests || []).some(q => q.receipt) ? { ...r, requests: r.requests.map(q => (q.receipt ? { ...q, receipt: '' } : q)) } : r;
  }
  return { ...state, drafts, inbox: (state.inbox || []).slice(0, 30), spots: (state.spots || []).slice(0, 20) };
}

function load(storage) {
  try { return { ...blank(), ...JSON.parse(storage.getItem(KEY) || '{}') }; } catch { return blank(); }
}

export function createStore(storage = globalThis.localStorage, onFull = () => {}) {
  let state = load(storage);
  const subs = new Set();
  // 2.53.0: a full phone used to drop every change silently (a draft came back empty after the app closed)
  const save = () => {
    try { storage.setItem(KEY, JSON.stringify(state)); return; } catch { /* full: try a smaller copy */ }
    try { state = slim(state); storage.setItem(KEY, JSON.stringify(state)); } catch { onFull(); }
  };
  return {
    get: () => state,
    /** set(patch) or set(state => patch) */
    set(patch) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      save();
      subs.forEach(fn => fn(state));
    },
    /** Saves without redrawing (typing in a field). */
    quiet(patch) { state = { ...state, ...patch }; save(); },
    reset() { state = { ...blank(), profile: state.profile }; save(); subs.forEach(fn => fn(state)); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

/** Same interface as localStorage, kept in memory (tests and demo mode). */
export function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}
