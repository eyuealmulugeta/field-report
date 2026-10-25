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
  knownAt: 0,          // when the office was last asked
  dev: '',             // this phone's id, so a draft saved here is not offered back to it
  seenNew: '',         // the version whose "What's new" was seen
  remindedOn: '',      // the day the 17:00 reminder went out
});

function load(storage) {
  try { return { ...blank(), ...JSON.parse(storage.getItem(KEY) || '{}') }; } catch { return blank(); }
}

export function createStore(storage = globalThis.localStorage) {
  let state = load(storage);
  const subs = new Set();
  const save = () => { try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* full or blocked: keep going in memory */ } };
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
