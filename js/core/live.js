// 2.12.0 (Phase E1, Central Hub docs/plan-one-database.md): live reads from Central Hub's database.
// Only when the Admin set the data route to "read" (public/fieldRoute). The phone signs in to Firebase with the
// same Google sign-in it makes for the script, then listens to its project's reports: an approval or a comment in
// Central Hub shows at once. Everything is still sent through the script. Any failure here leaves the phone on the
// script, as before.

export const FIREBASE = '10.12.2';
const CONFIG = { apiKey: 'AIzaSyCnm4E4PubEs6pqC30AWYDFi55s-qX-y5w', authDomain: 'amistad-ops.firebaseapp.com', projectId: 'amistad-ops' };
const ROUTE_URL = `https://firestore.googleapis.com/v1/projects/${CONFIG.projectId}/databases/(default)/documents/public/fieldRoute?key=${CONFIG.apiKey}`;
const DAYS = 21;   // the reports listened to: the last three weeks

/**
 * 2.23.0 (CH 20b): the whole report for the database, so Central Hub draws the same PDF (its copy of pdf.js) and
 * edits it later. Photos stay in Drive: only their ids, times and captions travel; any picture data is left out.
 * `project` and `profile` carry only what pdf.js prints. Under 700 kB, or null.
 */
export function reportFull(r, project = {}, profile = {}, signedAt = '') {
  const drop = v => (typeof v === 'string' && v.startsWith('data:') && v.length > 2048 ? undefined : v);
  const clean = x => (Array.isArray(x) ? x.map(clean).filter(v => v !== undefined)
    : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, clean(v)]).filter(([, v]) => v !== undefined))
    : drop(x));
  const sig = r.signed && typeof profile.sig === 'string' && profile.sig.startsWith('data:image/') && profile.sig.length < 200000 ? profile.sig : '';
  const full = {
    r: clean(JSON.parse(JSON.stringify(r))),
    project: { code: project.code || '', name: project.name || '', client: project.client || '', pn: project.pn || '', cc: project.cc || '' },
    profile: { name: profile.name || '', position: profile.position || '' }, sig, signedAt: String(signedAt || ''),
  };
  return JSON.stringify(full).length < 700000 ? full : null;
}

/** The route the Admin set: 'script' (default, also when it cannot be read) or 'read'. */
/** 2.19.0: the routes that read live. */
export const LIVE = new Set(['read', 'both']);
/** 2.19.0: what the database keeps of a report (E3a): its figures, not its text or photos. */
export const reportLite = m => ({ hash: m.hash || '', preparedBy: m.preparedBy || '', manpower: { head: (m.manpower || {}).head || 0, manHours: (m.manpower || {}).manHours || 0 }, items: (m.items || []).map(() => 1), photos: m.photos || 0, attention: m.attention || [], rating: m.rating || null });

export async function routeOf(get = fetch) {
  try {
    const r = await get(ROUTE_URL, { cache: 'no-store' });
    if (!r.ok) return 'script';
    const d = await r.json();
    const v = d?.fields?.route?.stringValue;
    return v === 'read' || v === 'both' ? v : 'script';   // 2.19.0: Both (E3a): reads live and writes each report to the database too
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
let gen = 0;   // 2.19.2: only the newest listen() subscribes
let state = 'off';      // off | connecting | on | error
let why = '';           // 2.12.1: the reason of the last failure, shown on Me
export const liveState = () => state;
export const liveWhy = () => why;
let last = null;        // 2.12.3: the last change received { at, what }, shown on Me
export const liveLast = () => last;
let from = '';           // 2.42.0: when this person joined the open project (Central Hub's fieldAccess since / joined)
export const liveFrom = () => from;
/** 2.42.0: written on or after the joining (a date or a time); everything when the joining is not known. */
export const seenFrom = (at, f = from) => !f || String(at || '') >= (String(at || '').length <= 10 ? f.slice(0, 10) : f);
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

/** 2.58.0 (G2): this phone's sessions in Central Hub's sign-in history (signlog/<id>), once signed in to Firebase. */
export const logReady = () => !!(fb && fb.auth.currentUser && fb.auth.currentUser.email);
export const logEmail = () => (logReady() ? fb.auth.currentUser.email.toLowerCase() : '');
export const logIO = {
  create: e => fb.F.setDoc(fb.F.doc(fb.db, 'signlog', e.id), e),
  touch: (id, last, act) => fb.F.setDoc(fb.F.doc(fb.db, 'signlog', id), act != null ? { last, act } : { last }, { merge: true }),   // 2.65.0: active minutes
  close: (id, end) => fb.F.setDoc(fb.F.doc(fb.db, 'signlog', id), { last: end, end, how: 'signout' }, { merge: true }),
  place: id => fb.N.httpsCallable(fb.N.getFunctions(fb.app, 'europe-west1'), 'signPlace')({ id }).catch(() => {}),
};

/** 2.59.0 (G1): one line of Central Hub's activity record (activity/<id>), in this account's name. */
export function logAct(rec) {
  if (!logReady() || !rec) return;
  fb.F.setDoc(fb.F.doc(fb.db, 'activity', rec.id), { ...rec, email: logEmail() }).catch(() => {});
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
export async function listen({ code, email, onKnown, onChange = () => {}, onPing = () => {}, onPingTrades = () => {}, onTeam = () => {}, onPhotos = () => {}, onRequests = () => {}, onDay = () => {}, onFixes = () => {}, onDays = () => {}, onReqAll = () => {}, onUrgent = () => {}, onPenalties = () => {}, onStore = () => {}, onPOs = () => {}, onShots = () => {}, onChat = () => {}, onDirect = () => {}, all = false, day = '', today = new Date() }) {
  stops.forEach(f => f()); stops = [];
  const mine = ++gen;
  try {
    const { F, auth, db } = await load();
    await auth.authStateReady();
    const u = auth.currentUser;
    if (!u || String(u.email || '').toLowerCase() !== String(email || '').toLowerCase()) { state = 'off'; if (state !== 'error') why = ''; return 'signin'; }
    const acc = await F.getDoc(F.doc(db, 'fieldAccess', u.email.toLowerCase()));
    // 2.19.2: a newer call (another project, a second start) took over while this one waited: two sets of listeners
    // made the lists of two projects take turns (requests shown, then gone)
    if (mine !== gen) return 'stale';
    stops.forEach(f => f()); stops = [];
    pid = acc.exists() ? (acc.data().codes || {})[String(code).toUpperCase()] : '';
    // 2.42.0 (owner): someone who joined later sees the posts and logs from their joining on ('' = all of them)
    from = acc.exists() ? String((acc.data().joined || {})[String(code).toUpperCase()] || acc.data().since || '') : '';
    if (!pid) { state = 'off'; why = `no Central Hub project for ${String(code).toUpperCase()} on ${u.email}`; return 'none'; }
    const since = new Date(today.getTime() - DAYS * 864e5).toISOString().slice(0, 10);
    const q = F.query(F.collection(db, 'projects', pid, 'reports'), F.where('date', '>=', since));
    state = 'connecting';
    stops.push(F.onSnapshot(q, snap => {
      state = 'on';
      const list = snap.docChanges().map(c => knownOf(c.doc.data())).filter(Boolean);
      if (list.length && !snap.metadata.fromCache) last = { at: new Date(), what: list.map(([n, k]) => `${n.slice(0, 10)} ${k.status}`).slice(-1)[0], n: list.length };
      if (list.length) onKnown(list);
      onDays(String(code).toUpperCase(), snap.docs.map(x => dayOf(x.data())).filter(Boolean));   // 2.17.0
      onChange(state);
    }, e => { fail(e, 'Reports'); onChange(state); }));
    // 2.17.0: the GM's "All projects": the reports and requests of every project on the account
    if (all) for (const [c2, p2] of Object.entries(acc.data().codes || {})) {
      if (p2 === pid) continue;
      stops.push(F.onSnapshot(F.query(F.collection(db, 'projects', p2, 'reports'), F.where('date', '>=', since)), snap => {
        const list = snap.docChanges().map(x => knownOf(x.doc.data())).filter(Boolean);
        if (list.length) onKnown(list);
        onDays(c2, snap.docs.map(x => dayOf(x.data())).filter(Boolean));
      }, () => {}));
      stops.push(F.onSnapshot(F.query(F.collection(db, 'projects', p2, 'requests'), F.where('site', '==', true)), snap => onReqAll(c2, snap.docs.map(x => x.data())), () => {}));
    }
    // 2.13.0: Central Hub's "something changed" signals, the team (names, trades, taken off) and the crew photos
    stops.push(F.onSnapshot(F.doc(db, 'fieldPing', pid), d => { const v = d.data() || {}; onPing(v); if (Array.isArray(v.trades) && v.trades.length) onPingTrades(v.trades.map(String)); }, () => {}));   // 2.54.0: and the trade list
    stops.push(F.onSnapshot(F.collection(db, 'projects', pid, 'team'), snap => onTeam(snap.docs.map(x => ({ id: x.id, ...pick(x.data()) }))), () => {}));
    stops.push(F.onSnapshot(F.doc(db, 'fieldPhotos', pid), d => onPhotos((d.data() || {}).m || {}), () => {}));
    // 2.15.0: today's attendance marks from every phone and computer of the project
    // 2.34.0: urgent notices from the GM sent to this account (Central Hub, urgent/<id>)
    urgMe = u.email.toLowerCase();
    stops.push(F.onSnapshot(F.query(F.collection(db, 'urgent'), F.where('emails', 'array-contains', urgMe)), snap => onUrgent(snap.docs.map(x => x.data())), () => {}));
    if (day) stops.push(F.onSnapshot(F.doc(db, 'projects', pid, 'fieldDay', day), d => onDay((d.data() || {}).rows || {}, (d.data() || {}).confirmed || null), () => {}));   // 2.33.0: and the reporter's check
    // 2.14.0: the project's site requests, drafts included, from every phone
    stops.push(F.onSnapshot(F.query(F.collection(db, 'projects', pid, 'requests'), F.where('site', '==', true)), snap => onRequests(snap.docs.map(x => x.data())), () => {}));
    // 2.57.0: the project's penalties (given on site, approved by the PE or GM)
    stops.push(F.onSnapshot(F.collection(db, 'projects', pid, 'penalties'), snap => onPenalties(snap.docs.map(x => x.data())), () => {}));
    // 2.61.0 (R5): the project's store movements and its keeper
    stops.push(F.onSnapshot(F.collection(db, 'projects', pid, 'storeMoves'), snap => onStore(snap.docs.map(x => x.data())), () => {}));
    stops.push(F.onSnapshot(F.collection(db, 'projects', pid, 'poOpen'), snap => onPOs(snap.docs.map(x => x.data())), () => {}));   // 2.62.0 (R6)
    stops.push(F.onSnapshot(F.collection(db, 'projects', pid, 'workShots'), snap => onShots(snap.docs.map(x => x.data())), () => {}));   // 2.66.0
    // 2.73.0 (owner, R4): Discuss: the project's channel and this person's one-to-one chats, as on Central Hub
    stops.push(F.onSnapshot(F.query(F.collection(db, 'company', 'main', 'messages'), F.where('channel', '==', pid)), snap => onChat(snap.docs.map(x => x.data())), () => {}));
    stops.push(F.onSnapshot(F.query(F.collection(db, 'company', 'main', 'direct'), F.where('members', 'array-contains', u.email.toLowerCase())), snap => onDirect(snap.docs.map(x => x.data())), () => {}));
    // 2.16.0: Central Hub's attendance corrections (the office's, and the site's waiting for review)
    stops.push(F.onSnapshot(F.collection(db, 'projects', pid, 'attendance'), snap => onFixes(snap.docs.map(x => x.data())), () => {}));
    return 'on';
  } catch (e) { fail(e, 'Access'); return 'error'; }
}

/** 2.13.0: only what a phone needs of a team member (no wages or levels); 2.17.0 a delete asked. */
const pick = m => ({ name: m.name || '', role: m.role || '', active: m.active !== false, fromSite: !!m.fromSite, dropAsk: m.dropAsk || null, dropOk: m.dropOk || null });

/** 2.17.0: one report of the project for the Reports list, from Central Hub: the same status as Review, with its times. */
export function dayOf(rec) {
  const k = knownOf(rec);
  if (!k || !rec.date) return null;
  const f = rec.field;
  return { date: rec.date, no: f.no || '', name: f.pdf, by: rec.by || '', status: k[1].status, version: k[1].version, at: f.receivedAt || f.pressedAt || '', history: k[1].history, live: true };
}
const signedIn = () => fb && fb.auth.currentUser && pid;

/**
 * 2.19.1: the person's signature, the same in Field Report and Central Hub on every device: Central Hub's prefs/<email>
 * (items of { k, v as JSON }), keys sf:mysig (the PNG) and sf:mysigAt (when it was made). Only that person reads or writes it.
 */
const SIG = 'sf:mysig', SIG_AT = 'sf:mysigAt';
const prefsRef = () => fb.F.doc(fb.db, 'prefs', fb.auth.currentUser.email.toLowerCase());
const itemOf = (items, k) => { const it = items.find(i => i && i.k === k); try { return it ? JSON.parse(it.v) : null; } catch { return null; } };
export async function sigPull() {
  if (!signedIn()) return null;
  const s = await fb.F.getDoc(prefsRef()), items = (s.exists() && s.data().items) || [];
  const sig = itemOf(items, SIG);
  return typeof sig === 'string' && sig.startsWith('data:image/png') ? { sig, at: Number(itemOf(items, SIG_AT)) || 0 } : null;
}
export async function sigPush(sig, at) {
  if (!signedIn() || !sig) return false;
  const ref = prefsRef(), s = await fb.F.getDoc(ref);
  const items = ((s.exists() && s.data().items) || []).filter(i => i && i.k !== SIG && i.k !== SIG_AT);
  await fb.F.setDoc(ref, { items: [...items, { k: SIG, v: JSON.stringify(sig) }, { k: SIG_AT, v: JSON.stringify(at) }], at: Date.now() });
  return true;
}

/**
 * 2.13.0 (Phase E2): asks the server to act now instead of on its next 2-minute run (Central Hub functions/fieldnow.js):
 * 'reports' (a report sent or answered), 'crew' (crew sent for approval), 'crewDrop' { id } (take one off the waiting list).
 * Returns the answer, or null when not connected or it failed (the 2-minute run still does it).
 */
export async function now(action, body = {}) {
  if (!signedIn()) return null;
  try { return (await fb.N.httpsCallable(fb.N.getFunctions(fb.app, 'europe-west1'), 'fieldNow')({ action, ...body })).data; }
  catch (e) {
    if (['crewDrop', 'crewOff', 'crewPerson', 'crewSave'].includes(action)) throw e;
    if (action === 'report' && e && e.code && String(e.code).includes('permission-denied')) return { ok: false, refused: String(e.message || '') };   // 2.69.0
    return null;
  }
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

/**
 * 2.16.0: Crew attendance: what Central Hub's attendance sheet is made of, read once: the project (pay period,
 * calendar), its reports of the period `periodOf(project)` gives, its corrections and its team.
 */
export async function sheetData(periodOf) {
  if (!signedIn()) throw new Error('Live updates are off.');
  const { F, db } = fb;
  const pd = await F.getDoc(F.doc(db, 'projects', pid));
  const project = { id: pid, ...(pd.data() || {}) }, { from, to } = periodOf(project);
  const [reps, att, team] = await Promise.all([
    F.getDocs(F.query(F.collection(db, 'projects', pid, 'reports'), F.where('date', '>=', from), F.where('date', '<=', to))),
    F.getDocs(F.collection(db, 'projects', pid, 'attendance')),
    F.getDocs(F.collection(db, 'projects', pid, 'team')),
  ]);
  return { project, ws: { reports: reps.docs.map(x => x.data()), attendance: att.docs.map(x => x.data()), team: team.docs.map(x => ({ id: x.id, ...pick(x.data()) })) } };
}

/** 2.16.0: a site correction of the attendance sheet; it counts once the office accepts it (Central Hub v0.42.0). */
export async function siteFix(rec) {
  if (!signedIn()) throw new Error('Live updates are off.');
  const { F, db, auth } = fb;
  await F.setDoc(F.doc(db, 'projects', pid, 'attendance', rec.id), { ...rec, byEmail: auth.currentUser.email.toLowerCase() });
}

/** 2.16.0: Employee data: a 12-hour link of this project for the crew form filled in on this device (kind 'site'). */
export async function siteLink({ projectName = '', byName = '', now: t = Date.now() } = {}) {
  if (!signedIn()) throw new Error('Live updates are off.');
  const { F, db, auth } = fb;
  const id = [...crypto.getRandomValues(new Uint8Array(20))].map(b => b.toString(16).padStart(2, '0')).join('');
  const until = t + 12 * 36e5;
  await F.setDoc(F.doc(db, 'company', 'main', 'crewlinks', id), { id, kind: 'site', name: '', email: '', projectId: pid, projectName, by: auth.currentUser.email.toLowerCase(), byName, at: new Date(t).toISOString(), untilMs: until, status: 'open' });
  return { id, until, url: `https://hub.amistadprefab.com/crew.html?l=${id}` };
}

/** 2.14.0: live writes are possible (signed in to Central Hub, project found). */
export const liveOn = () => !!signedIn();
const KIND = { Material: 'material', Manpower: 'manpower', Equipment: 'equipment', Expense: 'expense' };
const COST = { Material: 'material', Labour: 'labor', Equipment: 'equipment', Subcontract: 'subcontract', Transport: 'transport', Overhead: 'overhead' };

/**
 * 2.14.0: a request written on this phone, shared as a draft with the project's other phones and Central Hub
 * (projects/<id>/requests/fr_<id>, Central Hub's own request shape). It goes to the office when the day's report is sent.
 */
export async function saveRequest(q, { date, byName = '' }) {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase(), at = new Date().toISOString(), id = `fr_${q.id}`;
  const ref = F.doc(db, 'projects', pid, 'requests', id), old = await F.getDoc(ref);
  // 2.40.0 (owner): an asked request is changed too, and stays asked, until the office acts on it
  const asked = old.exists() && old.data().status === 'requested';
  if (old.exists() && !asked && old.data().status !== 'draft') throw new Error('the office has it already; ask them to change it');
  const fr = { id: q.id, at: q.at || '', date, category: q.category || 'Material', text: String(q.text || '').trim(), qty: q.qty ?? null, unit: q.unit || '', neededBy: q.neededBy || '', priority: q.priority || 'Normal', location: q.location || '' };
  const base = { id, kind: KIND[fr.category] || 'material', priority: fr.priority === 'Urgent' ? 'urgent' : 'normal', status: asked ? 'requested' : 'draft', date, neededBy: fr.neededBy, taskId: '',
    purpose: fr.location ? `Where on site: ${fr.location}` : '', lines: [{ id: `${id}_1`, description: fr.text, qty: Number(fr.qty) || 0, unit: fr.unit, note: '' }],
    projectId: pid, site: true, fr, editedBy: byName || email, editedAt: at };
  // 2.29.0: an expense carries its amount, currency, Ledger category, who was paid and the receipt photo (Central Hub's shape)
  if (fr.category === 'Expense') Object.assign(base, { amount: Number(q.amount) || 0, currency: q.currency === 'USD' ? 'USD' : 'ETB', category: COST[q.cost] || 'material', vendor: String(q.vendor || '').trim(), receipt: q.receipt || '', lines: [{ id: `${id}_1`, description: fr.text, qty: 1, unit: '', note: '' }] });
  const entry = { at, by: email, byName: byName || email, status: asked ? 'requested' : 'draft', note: old.exists() ? 'Changed on site' : 'Written on site' };
  if (old.exists()) await F.updateDoc(ref, { ...base, log: F.arrayUnion(entry) });
  else await F.setDoc(ref, { ...base, number: `SITE-${String(q.id).slice(-4).toUpperCase()}`, by: email, byName: byName || email, byTitle: 'Field Report', log: [entry] });
  return true;
}

/** 2.57.0: a penalty given on site, waiting for the PE or GM (projects/<id>/penalties/<id>). */
export async function savePenalty(make) {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase(), at = new Date().toISOString();
  const id = `pen_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await F.setDoc(F.doc(db, 'projects', pid, 'penalties', id), make({ email, at, pid, id }));
  return true;
}
/** 2.57.0: approved or rejected (PE or GM), or cancelled by the one who gave it; who and when are kept. */
export async function penaltyStatus(id, status, byName = '') {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase(), at = new Date().toISOString();
  const by = byName || email;
  await F.updateDoc(F.doc(db, 'projects', pid, 'penalties', id), { status, ...(status === 'cancelled' ? {} : { decidedBy: email, decidedByName: by, decidedAt: at }), log: F.arrayUnion({ at, by: email, byName: by, status, note: 'On Field Report' }) });
  return true;
}

/** 2.73.0 (owner, R4): a Discuss message. make({ email, pid }) returns { sec: 'messages' | 'direct', rec }. */
export async function chatSend(make) {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, { sec, rec } = make({ email: auth.currentUser.email.toLowerCase(), pid });
  await F.setDoc(F.doc(db, 'company', 'main', sec, rec.id), rec);
  return true;
}
/** 2.73.0: correct (within 30 seconds) or take back one's own message. */
export async function chatEdit(sec, id, patch) {
  if (!signedIn()) return false;
  await fb.F.updateDoc(fb.F.doc(fb.db, 'company', 'main', sec, id), patch);
  return true;
}

/** 2.66.0: a technician's work photos, waiting for the SE / PE (projects/<id>/workShots/<id>). */
export async function saveShot(make) {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase(), at = new Date().toISOString();
  const id = `ws_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await F.setDoc(F.doc(db, 'projects', pid, 'workShots', id), make({ email, at, pid, id }));
  return true;
}
/** 2.66.0: approved, or rejected with a reason, by the SE, PE, GM or Admin. */
export async function shotStatus(id, status, byName = '', reason = '') {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase(), at = new Date().toISOString();
  await F.updateDoc(F.doc(db, 'projects', pid, 'workShots', id), { status, reason: status === 'rejected' ? reason || 'other' : '', decidedBy: email, decidedByName: byName || email, decidedAt: at });
  return true;
}

/** 2.61.0 (R5): a store movement, waiting for the PE (projects/<id>/storeMoves/<id>). */
export async function saveMove(make) {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase(), at = new Date().toISOString();
  const id = `sm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await F.setDoc(F.doc(db, 'projects', pid, 'storeMoves', id), make({ email, at, pid, id }));
  return true;
}
/** 2.61.0: approved or rejected by the PE (or GM), or cancelled by the one who recorded it. */
export async function moveStatus(id, status, byName = '') {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase(), at = new Date().toISOString(), by = byName || email;
  await F.updateDoc(F.doc(db, 'projects', pid, 'storeMoves', id), { status, ...(status === 'cancelled' ? {} : { decidedBy: email, decidedByName: by, decidedAt: at }), log: F.arrayUnion({ at, by: email, byName: by, status, note: 'On Field Report' }) });
  return true;
}
/** 2.61.0: the store's keeper (or the person delegated) and the items' minimums, set by the PE or GM. */
export async function setKeeper({ keeper = '', keeperName = '', mins = {}, byName = '' }) {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase();
  await F.setDoc(F.doc(db, 'projects', pid, 'storeMoves', 'keeper'), { id: 'keeper', keeper: String(keeper).trim().toLowerCase(), keeperName, mins, by: email, byName: byName || email, at: new Date().toISOString() });
  return true;
}

/** 2.14.0: a request deleted (draft), sent with the report (requested) or withdrawn (cancelled), with who and when. */
export async function requestStatus(qid, status, { byName = '', note = '' } = {}) {
  if (!signedIn()) return false;
  const { F, db, auth } = fb, email = auth.currentUser.email.toLowerCase(), at = new Date().toISOString();
  await F.updateDoc(F.doc(db, 'projects', pid, 'requests', `fr_${qid}`), { status, editedBy: byName || email, editedAt: at, log: F.arrayUnion({ at, by: email, byName: byName || email, status, note }) });
  return true;
}

/** 2.15.0: attendance marks shared with the project's other phones and computers (projects/<id>/fieldDay/<date>). */
export async function shareMarks(day, marks) {
  if (!signedIn() || !day || !Object.keys(marks).length) return false;
  const { F, db } = fb;
  await F.setDoc(F.doc(db, 'projects', pid, 'fieldDay', day), { rows: marks, date: day, at: new Date().toISOString() }, { merge: true });
  return true;
}

let urgMe = '';
/** 2.34.0: this account's answer to an urgent notice: { kind: 'read' | 'reply', text, at, name }. */
export async function answerUrgent(id, ans) {
  if (!signedIn() || !urgMe || !id) throw new Error('offline');
  const { F, db } = fb;
  await F.setDoc(F.doc(db, 'urgent', id), { answers: { [urgMe]: ans } }, { merge: true });
  return true;
}

/** 2.33.0: the reporter confirms the day's attendance is correct (Central Hub shows it on its sheet). */
export async function confirmDay(day, by) {
  if (!signedIn() || !day) return false;
  const { F, db } = fb;
  await F.setDoc(F.doc(db, 'projects', pid, 'fieldDay', day), { date: day, confirmed: { by: by || '', at: Date.now() } }, { merge: true });
  return true;
}
