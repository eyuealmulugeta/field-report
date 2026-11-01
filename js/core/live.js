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
  return [f.pdf, { status, version: f.version || 1, comments: Array.isArray(f.comments) ? f.comments : [], history: Array.isArray(f.history) ? f.history : [], checked: now, live: true }];
}

let fb = null;          // { auth, db, F } once loaded
let pid = '';           // 2.13.0: the Central Hub project listened to
let stops = [];
let state = 'off';      // off | connecting | on | error
let why = '';           // 2.12.1: the reason of the last failure, shown on Me
export const liveState = () => state;
export const liveWhy = () => why;
let last = null;        // 2.12.3: the last change received { at, what }, shown on Me
export const liveLast = () => last;
const fail = (e, where) => { state = 'error'; why = `${where}: ${String(e?.code || e?.message || e).replace(/^auth\/|^firestore\//, '').slice(0, 80)}`; };

async function load() {
  if (fb) return fb;
  const sdk = name => import(`https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-${name}.js`);
  const [A, U, F, N] = await Promise.all([sdk('app'), sdk('auth'), sdk('firestore'), sdk('functions')]);
  const app = A.initializeApp(CONFIG, 'field');
  fb = { A, U, F, N, app, auth: U.getAuth(app), db: F.getFirestore(app) };
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
  state = 'off'; pid = '';
  if (fb) await fb.U.signOut(fb.auth).catch(() => {});
}

/**
 * Listens to the reports of the project `code` for the signed-in email. onKnown(entries) gets [[name, known], ...]
 * whenever Central Hub changes one. Returns the state: 'on', 'signin' (Firebase sign-in needed), 'none' or 'error'.
 */
export async function listen({ code, email, onKnown, onChange = () => {}, onPing = () => {}, onTeam = () => {}, onPhotos = () => {}, onRequests = () => {}, today = new Date() }) {
  stops.forEach(f => f()); stops = [];
  try {
    const { F, auth, db } = await load();
    await auth.authStateReady();
    const u = auth.currentUser;
    if (!u || String(u.email || '').toLowerCase() !== String(email || '').toLowerCase()) { state = 'off'; if (state !== 'error') why = ''; return 'signin'; }
    const acc = await F.getDoc(F.doc(db, 'fieldAccess', u.email.toLowerCase()));
    pid = acc.exists() ? (acc.data().codes || {})[String(code).toUpperCase()] : '';
    if (!pid) { state = 'off'; why = `no Central Hub project for ${String(code).toUpperCase()} on ${u.email}`; return 'none'; }
    const since = new Date(today.getTime() - DAYS * 864e5).toISOString().slice(0, 10);
    const q = F.query(F.collection(db, 'projects', pid, 'reports'), F.where('date', '>=', since));
    state = 'connecting';
    stops.push(F.onSnapshot(q, snap => {
      state = 'on';
      const list = snap.docChanges().map(c => knownOf(c.doc.data())).filter(Boolean);
      if (list.length && !snap.metadata.fromCache) last = { at: new Date(), what: list.map(([n, k]) => `${n.slice(0, 10)} ${k.status}`).slice(-1)[0], n: list.length };
      if (list.length) onKnown(list);
      onChange(state);
    }, e => { fail(e, 'Reports'); onChange(state); }));
    // 2.13.0: Central Hub's "something changed" signals, the team (names, trades, taken off) and the crew photos
    stops.push(F.onSnapshot(F.doc(db, 'fieldPing', pid), d => onPing(d.data() || {}), () => {}));
    stops.push(F.onSnapshot(F.collection(db, 'projects', pid, 'team'), snap => onTeam(snap.docs.map(x => ({ id: x.id, ...pick(x.data()) }))), () => {}));
    stops.push(F.onSnapshot(F.doc(db, 'fieldPhotos', pid), d => onPhotos((d.data() || {}).m || {}), () => {}));
    // 2.14.0: the project's site requests, drafts included, from every phone
    stops.push(F.onSnapshot(F.query(F.collection(db, 'projects', pid, 'requests'), F.where('site', '==', true)), snap => onRequests(snap.docs.map(x => x.data())), () => {}));
    return 'on';
  } catch (e) { fail(e, 'Access'); return 'error'; }
}

/** 2.13.0: only what a phone needs of a team member (no wages or levels). */
const pick = m => ({ name: m.name || '', role: m.role || '', active: m.active !== false, fromSite: !!m.fromSite });
const signedIn = () => fb && fb.auth.currentUser && pid;

/**
 * 2.13.0 (Phase E2): asks the server to act now instead of on its next 2-minute run (Central Hub functions/fieldnow.js):
 * 'reports' (a report sent or answered), 'crew' (crew sent for approval), 'crewDrop' { id } (take one off the waiting list).
 * Returns the answer, or null when not connected or it failed (the 2-minute run still does it).
 */
export async function now(action, body = {}) {
  if (!signedIn()) return null;
  try { return (await fb.N.httpsCallable(fb.N.getFunctions(fb.app, 'europe-west1'), 'fieldNow')({ action, ...body })).data; }
  catch (e) { if (action === 'crewDrop') throw e; return null; }
}

/** 2.13.0: corrects or takes off a crew member the site added (Central Hub's rules allow name, trade, phone, active only). */
export async function editTeam(id, changes) {
  if (!signedIn()) throw new Error('Live updates are off. Ask the office.');
  const { F, db, auth } = fb;
  await F.updateDoc(F.doc(db, 'projects', pid, 'team', id), { ...changes, editedBy: auth.currentUser.email.toLowerCase(), editedAt: new Date().toISOString() });
}

/** 2.13.0: a crew form link of this project, made on the phone (3 days, Central Hub crew.html; no sign-in to fill it). */
export async function crewLink({ projectName = '', byName = '', now: t = Date.now() } = {}) {
  if (!signedIn()) throw new Error('Live updates are off. Ask the office for the link.');
  const { F, db, auth } = fb;
  const id = [...crypto.getRandomValues(new Uint8Array(20))].map(b => b.toString(16).padStart(2, '0')).join('');
  const by = auth.currentUser.email.toLowerCase();
  await F.setDoc(F.doc(db, 'company', 'main', 'crewlinks', id), { id, kind: 'crew', name: '', email: '', projectId: pid, projectName, by, byName, at: new Date(t).toISOString(), untilMs: t + 3 * 864e5, status: 'open' });
  return `https://hub.amistadprefab.com/crew.html?l=${id}`;
}

/** 2.14.0: live writes are possible (signed in to Central Hub, project found). */
export const liveOn = () => !!signedIn();
const KIND = { Material: 'material', Manpower: 'manpower', Equipment: 'equipment' };

/**
 * 2.14.0: a request written on this phone, shared as a draft with the project's other phones and Central Hub
 * (projects/<id>/requests/fr_<id>, Central Hub's own request shape). It goes to the office when the day's report is sent.
 */
export async function saveRequest(q, { date, byName = '' }) {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase(), at = new Date().toISOString(), id = `fr_${q.id}`;
  const ref = F.doc(db, 'projects', pid, 'requests', id), old = await F.getDoc(ref);
  if (old.exists() && old.data().status !== 'draft') throw new Error('the office has it already; ask them to change it');
  const fr = { id: q.id, at: q.at || '', date, category: q.category || 'Material', text: String(q.text || '').trim(), qty: q.qty ?? null, unit: q.unit || '', neededBy: q.neededBy || '', priority: q.priority || 'Normal', location: q.location || '' };
  const base = { id, kind: KIND[fr.category] || 'material', priority: fr.priority === 'Urgent' ? 'urgent' : 'normal', status: 'draft', date, neededBy: fr.neededBy, taskId: '',
    purpose: fr.location ? `Where on site: ${fr.location}` : '', lines: [{ id: `${id}_1`, description: fr.text, qty: Number(fr.qty) || 0, unit: fr.unit, note: '' }],
    projectId: pid, site: true, fr, editedBy: byName || email, editedAt: at };
  const entry = { at, by: email, byName: byName || email, status: 'draft', note: old.exists() ? 'Changed on site' : 'Written on site' };
  if (old.exists()) await F.updateDoc(ref, { ...base, log: F.arrayUnion(entry) });
  else await F.setDoc(ref, { ...base, number: `SITE-${String(q.id).slice(-4).toUpperCase()}`, by: email, byName: byName || email, byTitle: 'Field Report', log: [entry] });
  return true;
}

/** 2.14.0: a request deleted (draft), sent with the report (requested) or withdrawn (cancelled), with who and when. */
export async function requestStatus(qid, status, { byName = '', note = '' } = {}) {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase(), at = new Date().toISOString();
  await F.updateDoc(F.doc(db, 'projects', pid, 'requests', `fr_${qid}`), { status, editedBy: byName || email, editedAt: at, log: F.arrayUnion({ at, by: email, byName: byName || email, status, note }) });
  return true;
}
