// 2.12.0 (Phase E1, Central Hub docs/plan-one-database.md): live reads from Central Hub's database.
// Only when the Admin set the data route to "read" (public/fieldRoute). The phone signs in to Firebase with the
// same Google sign-in it makes for the script, then listens to its project's reports: an approval or a comment in
// Central Hub shows at once. Everything is still sent through the script. Any failure here leaves the phone on the
// script, as before.

export const FIREBASE = '10.12.2';
const CONFIG = { apiKey: 'AIzaSyCnm4E4PubEs6pqC30AWYDFi55s-qX-y5w', authDomain: 'amistad-ops.firebaseapp.com', projectId: 'amistad-ops' };
const ROUTE_URL = `https://firestore.googleapis.com/v1/projects/${CONFIG.projectId}/databases/(default)/documents/public/fieldRoute?key=${CONFIG.apiKey}`;
const DAYS = 21;   // the reports listened to: the last three weeks

/** The route the Admin set: 'script' (default, also when it cannot be read) or 'read'. */
export async function routeOf(get = fetch) {
  try {
    const r = await get(ROUTE_URL, { cache: 'no-store' });
    if (!r.ok) return 'script';
    const d = await r.json();
    return d?.fields?.route?.stringValue === 'read' ? 'read' : 'script';
  } catch { return 'script'; }
}

/**
 * What a Central Hub report record says for the phone's `known` list, keyed by the report file name.
 * An approval made in Central Hub and not yet passed to the script (review done, status still submitted) shows as approved.
 */
export function knownOf(rec, now = Date.now()) {
  const f = rec?.field;
  if (!f || !f.pdf || rec.source !== 'field') return null;
  const status = rec.review === 'done' && (!f.status || f.status === 'submitted') ? 'approved' : f.status || 'submitted';
  return [f.pdf, { status, version: f.version || 1, comments: Array.isArray(f.comments) ? f.comments : [], checked: now, live: true }];
}

let fb = null;          // { auth, db, F } once loaded
let stops = [];
let state = 'off';      // off | connecting | on | error
let why = '';           // 2.12.1: the reason of the last failure, shown on Me
export const liveState = () => state;
export const liveWhy = () => why;
const fail = (e, where) => { state = 'error'; why = `${where}: ${String(e?.code || e?.message || e).replace(/^auth\/|^firestore\//, '').slice(0, 80)}`; };

async function load() {
  if (fb) return fb;
  const sdk = name => import(`https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-${name}.js`);
  const [A, U, F] = await Promise.all([sdk('app'), sdk('auth'), sdk('firestore')]);
  const app = A.initializeApp(CONFIG, 'field');
  fb = { A, U, F, auth: U.getAuth(app), db: F.getFirestore(app) };
  return fb;
}

/** Firebase sign-in with the Google access token of the script sign-in just made. Quietly does nothing on failure. */
export async function connect(accessToken) {
  if (!accessToken) return false;
  try {
    const { U, auth } = await load();
    await U.signInWithCredential(auth, U.GoogleAuthProvider.credential(null, accessToken));
    return true;
  } catch (e) { fail(e, 'Sign-in'); return false; }
}

/** Stops listening and signs out of Firebase (the phone's own sign-out, or the route back to Script). */
export async function stop() {
  stops.forEach(f => { try { f(); } catch { /* gone */ } }); stops = [];
  state = 'off';
  if (fb) await fb.U.signOut(fb.auth).catch(() => {});
}

/**
 * Listens to the reports of the project `code` for the signed-in email. onKnown(entries) gets [[name, known], ...]
 * whenever Central Hub changes one. Returns the state: 'on', 'signin' (Firebase sign-in needed), 'none' or 'error'.
 */
export async function listen({ code, email, onKnown, onChange = () => {}, today = new Date() }) {
  stops.forEach(f => f()); stops = [];
  try {
    const { F, auth, db } = await load();
    await auth.authStateReady();
    const u = auth.currentUser;
    if (!u || String(u.email || '').toLowerCase() !== String(email || '').toLowerCase()) { state = 'off'; if (state !== 'error') why = ''; return 'signin'; }
    const acc = await F.getDoc(F.doc(db, 'fieldAccess', u.email.toLowerCase()));
    const pid = acc.exists() ? (acc.data().codes || {})[String(code).toUpperCase()] : '';
    if (!pid) { state = 'off'; why = `no Central Hub project for ${String(code).toUpperCase()} on ${u.email}`; return 'none'; }
    const since = new Date(today.getTime() - DAYS * 864e5).toISOString().slice(0, 10);
    const q = F.query(F.collection(db, 'projects', pid, 'reports'), F.where('date', '>=', since));
    state = 'connecting';
    stops.push(F.onSnapshot(q, snap => {
      state = 'on';
      const list = snap.docChanges().map(c => knownOf(c.doc.data())).filter(Boolean);
      if (list.length) onKnown(list);
      onChange(state);
    }, e => { fail(e, 'Reports'); onChange(state); }));
    return 'on';
  } catch (e) { fail(e, 'Access'); return 'error'; }
}
