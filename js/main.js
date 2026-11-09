// Starts the app: picks the screen from the address (#today, #start, #crew…), draws it, and handles taps and typing.

import { post, signIn, signInReturn, signUp, useFake, isDemo, ApiError, APP_VERSION, deviceId, deviceRestore, deviceUa, deviceMode, takeGoogleToken, SCRIPT } from './core/api.js';
import * as L from './core/live.js';
import * as P from './ui/parts.js';
import { partOf, slotOf } from './model/rating.js';   // 2.18.0   // 2.16.1
import { html } from './core/dom.js';
import { createStore, memoryStorage } from './core/store.js';
import { todayIn, timeIn, num, weekday, uid } from './core/util.js';
import { codesOf, pdfName } from './core/names.js';
import { newReport, draftKey, STEPS, weatherTerm, stepOfScreen, doneCount, dbWaiting } from './model/report.js';
import { mergeStaff, attendanceRows, crewPhotoState, crewCloses, CREW_ST_WORD, withTeam, normTrade, markKey, applyMarks } from './model/crew.js';
import { demoServer, demoDrafts, demoToday, loadSim } from './demo.js';
import { newItem, itemFromPlan, parseSpeech, zonesOf } from './model/items.js';
import { putPhoto, getPhoto, deletePhoto, shrink, photoUrl, original, screenCopy, tileCopy, ORIG } from './core/photos.js';
import { listen } from './core/voice.js';
import * as S from './ui/screens.js';
import * as W from './ui/work.js';
import * as D from './ui/desk.js';
import * as Y from './ui/day.js';
import { newEquipment, newReceived, newDelay } from './model/day.js';
import * as E from './ui/end.js';
import { newRequest, newPlanLine, unfinishedWork, reportMeta, fromLive, mergeRequests } from './model/end.js';
import { buildPdf, loadPdfLib, photoCaption, weatherFile } from './pdf.js';
import { forecastUrl, forecastOf } from './model/forecast.js';   // 2.64.0 (R8)

import * as F from './ui/follow.js';
import { monthDays, needsYou, toCheck, draftChoice, unsharedRequests } from './model/follow.js';
import * as FM from './model/follow.js';   // 2.80.0: Reports by month
import { nav } from './ui/parts.js';
import * as R from './ui/review.js';
import * as SP from './ui/spot.js';
import { newSpot, spotMissing, mediaKind, SPOT_MAX, VIDEO_AIM, VIDEO_SECONDS, aboutList } from './model/spot.js';
import { newVisit, visitMissing, visitRecord, VISIT_PHOTOS, PURPOSES } from './model/visit.js';
import { shrinkVideo } from './core/video.js';
import { openLiveCam } from './ui/livecam.js';   // 2.76.0
import { videoWaiting, videoAdd } from './model/video.js';
import { kindOf, crewWages } from './model/review.js';
import * as V from './ui/view.js';
import * as Q from './ui/quick.js';
import { presence, BEAT_MS, newEntry as newLog, actEntry, inputClock } from './core/signlog.js';   // 2.58.0 (G2)
import * as PN from './ui/penalty.js';   // 2.57.0 (R3)
import * as SM from './ui/store.js';   // 2.61.0 (R5)
import * as CHAT from './ui/chat.js';   // 2.73.0 (R4): Discuss
import { messageOf, freshOf, mayEdit, takeBackOk, threadOf } from './model/chat.js';
import * as SH from './ui/share.js';   // 2.66.0: technicians' work photos
import { qualityOf, shotProblem, shotRecord, MAX_PHOTOS, PHOTO_CHARS } from './model/shots.js';
import { cleanRules, has as ruleHas, screenOk, actOk, firstOk, hideOff, setOff, screenOffOnly, actOffOnly } from './model/rules.js';   // 2.60.0 (G6)
import { penaltyProblem, penaltyRecord } from './model/penalty.js';
import { moveProblem, moveRecord, bookOf, itemsOf, moveLine, itemKey } from './model/store.js';   // 2.61.0 (R5)
import { openPad } from './ui/sigpad.js';
import * as MD from './ui/media.js';   // 2.54.0: the GM's Dashboard
import { onSwipe } from './core/swipe.js';
import { offerInstall } from './core/install.js';   // 2.32.0
import { showUrgent } from './ui/urgent.js';   // 2.34.0

const demo = new URLSearchParams(location.search).has('demo');
if (demo) useFake(demoServer);
if (demo && new URLSearchParams(location.search).has('sim')) await loadSim();   // 2.46.0: the project simulation (test mode only)
// 2.53.0: when even the smaller copy does not fit, say so instead of losing the work
const store = createStore(demo ? memoryStorage() : localStorage, () => { if (Date.now() - (window.fullAt || 0) > 60e3) { window.fullAt = Date.now(); setTimeout(() => toast('The phone storage for Field Report is full: send your report now, then remove old photos or videos.'), 0); } });
if (demo) store.set({ drafts: demoDrafts() });

await deviceRestore().catch(() => '');   // 2.56.0: the device id back from IndexedDB or its cache before any request
const ui = { busy: false, error: '', sheet: '', toast: '', attTab: (() => { try { return ['', 'crew', 'emp'].includes(localStorage.getItem('fr2_attTab')) ? localStorage.getItem('fr2_attTab') : ''; } catch { return ''; } })() };
const realToday = () => (demo ? demoToday() : todayIn());
/** The day being reported: today, or an earlier day opened from Reports to write or correct. */
const today = () => ui.date || realToday();
const now = () => timeIn();

try { setOff(JSON.parse(localStorage.getItem('fr2_off') || '[]')); } catch { /* private mode */ }   // 2.74.0: what Central Hub switched off, offline too
const SCREENS = {
  today: S.today, start: S.start, crew: S.crew, att: S.att, me: S.me, work: W.work, item: W.item, photo: W.photo,
  equipment: Y.equipment, materials: Y.materials, delivery: Y.delivery, safety: Y.safety, delay: Y.delay, photos: Y.photos,
  end: E.end, request: E.request, send: E.send,
  // 2.55.0 (owner): Reports and Requests are the two tabs inside Review
  reports: c => { const v = F.reports(c); return { ...v, head: v.head, body: html`${P.reviewTabs('reports')}${v.body}` }; },
  penalties: PN.penalties,   // 2.57.0
  store: SM.store,   // 2.61.0 (R5)
  share: SH.share, shots: SH.shots,   // 2.66.0
  requests: c => { const v = F.requests(c); return { ...v, body: html`${P.reviewTabs('requests')}${v.body}` }; },
  view: V.view,
  review: R.review, rev: R.rev, crewrev: R.crewrev,   // 2.6.0: reviewer accounts
  spot: SP.spot, attention: S.attention,              // 2.7.0
  quick: Q.quick,                                      // 2.11.0
  media: MD.media,                                     // 2.54.0: the GM's Dashboard
  chat: CHAT.chat,                                     // 2.73.0 (owner, R4): Discuss
};
const NEEDS_REPORT = new Set(['attention', 'start', 'crew', 'work', 'item', 'photo', 'equipment', 'materials', 'delivery', 'safety', 'delay', 'photos', 'end', 'request', 'send']);

/* ---------- state helpers ---------- */

// 2.13.0: with Central Hub's team overlaid (live)
// 2.42.0: until Central Hub's team arrives, the people deleted last time stay out (no flash of a deleted person on refresh)
const project = () => {
  const p = store.get().projects.find(x => x.code === store.get().proj) || null;
  if (!p) return p;
  if (ui.teamOf === p.code) return withTeam(p, ui.team);
  const gone = (store.get().gone || {})[p.code] || [];
  return gone.length ? { ...p, staff: (p.staff || []).filter(s => !gone.includes(s.id)), gone } : p;
};
const key = () => draftKey(store.get().proj, today());
const report = () => store.get().drafts[key()] || null;
const working = () => { const r = report(); return r && r.start ? r : null; };
/** 2.6.0: reporter, reviewer or viewer, from the role the script gives at sign-in. */
/** 2.7.0: the project's working hours. */
const remindAt = () => (project() || {}).remindAt || '17:00';
const crewStart = () => (project() || {}).defStart || '08:00';
const kind = () => kindOf((store.get().auth || {}).role || 'engineer');

function lastReport(code, before) {
  const d = store.get().drafts;
  return Object.keys(d).filter(k => k.startsWith(code + '|') && k.split('|')[1] < before).sort().map(k => d[k]).filter(r => !r.nowork).pop() || null;
}

function nextNo(p) {
  const used = store.get().lastNo[p.code] || 0;
  const last = lastReport(p.code, today());
  return Math.max((Number(p.day) || 0) + 1, used + 1, last ? last.no + 1 : 1);
}

/** Saves the report (after a change made with fn). quiet = do not redraw, for typing. */
function edit(fn, quiet) {
  const k = key(), r = structuredClone(report());
  // 2.19.1: the GM changes a project's report before it is sent only after saying yes (once per report, per opening)
  if (!r.sentAt && P.isGM({ s: store.get() }) && !(ui.gmOk || {})[k]) {
    if (!confirm(`This is the site's report of ${r.date} for ${r.proj}, not sent yet. Change it?`)) { draw(); return; }
    ui.gmOk = { ...(ui.gmOk || {}), [k]: true };
  }
  fn(r);
  r.updated = Date.now();
  // 2.4.0: one report per project and day, shared: who worked on it, in turn
  const me = store.get().profile.name || (store.get().auth || {}).name || '';
  // 2.27.0 (owner, 2 Nov): each step keeps who changed it last and when, and when it was first changed
  const step = stepOfScreen(location.hash.slice(1) || '');
  if (step) { const was = (r.stamps || {})[step]; r.stamps = { ...(r.stamps || {}), [step]: { by: me, at: r.updated, first: (was && was.first) || r.updated } }; }
  if (me) { const last = (r.edits || []).at(-1); if (last && last.by === me) last.at = r.updated; else r.edits = [...(r.edits || []), { by: me, at: r.updated }].slice(-50); }
  if (r.date === today()) { const pt = partOf(now()); if (pt && !(r.seen || {})[pt]) r.seen = { ...(r.seen || {}), [pt]: r.updated }; const sl = slotOf(now()); if (sl != null && !(r.slots || []).includes(sl)) r.slots = [...(r.slots || []), sl]; }   // 2.18.0, 2.19.3 half hours
  const drafts = { ...store.get().drafts, [k]: r };
  if (quiet) store.quiet({ drafts }); else store.set({ drafts });
  draftSoon();
}

/** Today's report, made when first needed. A day first marked "no work" becomes a normal report if work starts after all. */
function ensureReport() {
  if (report() && report().start) return report();
  const p = project(), prof = store.get().profile;
  const r = newReport({ ...p, defStart: prof.defStart || p.defStart, defEnd: prof.defEnd || p.defEnd }, today(), nextNo(p), lastReport(p.code, today()));
  r.crew.rows = applyMarks(mergeStaff([], p.staff, p.gone), !ui.date && ui.marksOf === p.code ? ui.marks : null);   // 2.15.0: marks made on another device
  store.set({ drafts: { ...store.get().drafts, [key()]: r } });
  syncNo(key()).catch(() => {});   // offline: checked again when it is sent
  return r;
}

/** 2.3.0: the server gives the report number (one per project and date, for everyone); the phone's own count is only a guess for offline. */
async function syncNo(k) {
  const r = store.get().drafts[k], p = r && store.get().projects.find(x => x.code === r.proj);
  if (!r || !p || r.sentAt || r.nowork) return r && r.no;
  const q = await call('reportNo', { name: pdfName(p, r.date, r.no) });
  if (q.no && q.no !== store.get().drafts[k].no) editKey(k, x => { x.no = q.no; });
  return q.no;
}

/** item.* and photo.* fields belong to the item or photo being edited, held in ui until saved. */
const isDraft = f => /^(item|photo|recv|delay|req|cl)\./.test(f);
const setDraft = (f, v) => { const [k, ...rest] = f.split('.'); setPath(ui[k], rest.join('.'), v); };

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const setPath = (obj, path, v) => {
  const ks = path.split('.');
  let o = obj;
  for (const k of ks.slice(0, -1)) o = o[k];
  o[ks.at(-1)] = v;
};

/** Changes a report other than today's (one sent from the outbox). */
function editKey(k, fn) {
  const cur = store.get().drafts[k];
  if (!cur) return;
  const r = structuredClone(cur);
  fn(r);
  store.set({ drafts: { ...store.get().drafts, [k]: r } });
}

/* ---------- server ---------- */

const token = () => (store.get().auth || {}).token;

async function call(action, body) {
  try { return await post(action, body, token()); }
  catch (e) {
    if (e.code === 'AUTH') { store.set({ auth: null }); ui.error = `Signed out: ${e.message}`; location.hash = ''; }   // 2.53.0: the reason stays on the sign-in page
    throw e;
  }
}

/** Projects from getconfig, with the crew lists and site location from myProjects. */
async function loadProjects() {
  const [cfg, mine] = await Promise.all([call('getconfig', {}), call('myProjects', {}).catch(() => ({ projects: [] }))]);
  const extra = new Map((mine.projects || []).map(p => [String(p.proj).toUpperCase(), p]));
  const projects = (cfg.projects || []).map(p => {
    const code = codesOf(p).code, m = extra.get(code) || {};
    return { ...p, code, staff: (m.staff || []).map(x => ({ ...x, trade: normTrade(x.trade) })), location: m.location || p.siteName || '', crewWait: (m.crewWait || []).map(x => ({ ...x, trade: normTrade(x.trade) })),   // 2.17.1
      tradeWages: m.tradeWages || {}, crewApprove: !!m.crewApprove, hoursEdit: !!m.hoursEdit };
  });
  const s = store.get(), old = new Map(s.projects.map(p => [p.code, p]));
  for (const p of projects) if (old.get(p.code)?.setup) p.setup = old.get(p.code).setup;
  store.set({ projects, proj: projects.some(p => p.code === s.proj) ? s.proj : projects.length === 1 ? projects[0].code : '' });
  // 2.8.1: today's report, when not sent yet, takes in the crew the office added or removed since it was started
  const drafts = { ...store.get().drafts }, t = realToday();
  let changed = false;
  for (const p of projects) {
    const k = draftKey(p.code, t), r = drafts[k];
    if (!r || r.sentAt || r.nowork || !r.crew || !p.staff.length) continue;
    const rows = mergeStaff(r.crew.rows, p.staff, p.gone);
    if (JSON.stringify(rows) !== JSON.stringify(r.crew.rows)) { drafts[k] = { ...r, crew: { ...r.crew, rows }, updated: Date.now() }; changed = true; }
  }
  if (changed) store.set({ drafts });
  await loadSetup();
}

/** The office's lists for the project in use: tasks, milestones, work types, zones. Kept on the phone for offline days. */
async function loadSetup() {
  const p = project();
  if (!p) return;
  const r = await call('getSetup', { proj: p.code }).catch(() => null);
  if (!r || !r.setup) return;
  store.set({ projects: store.get().projects.map(x => (x.code === p.code ? { ...x, setup: r.setup } : x)) });
}

/** Sends what waited for a connection. */
async function flush() {
  const box = store.get().outbox;
  if (!box.length || !token()) return;
  const left = [];
  for (const job of box) {
    if (job.action === 'report') continue;
    try { await call(job.action, job.body); } catch (e) { if (e.code === 'OFFLINE' || e.code === 'BUSY') left.push(job); }
  }
  const reports = store.get().outbox.filter(j => j.action === 'report');
  store.set({ outbox: [...left, ...reports] });
  for (const job of reports) {
    try { if (await sendReport(job.body.key) === 'sent') toast(`Report #${store.get().drafts[job.body.key].no} sent to the office.`); }
    catch (e) { unqueue(job.body.key); editKey(job.body.key, r => { r.queuedAt = 0; r.sendError = e.message; }); }
  }
}

/* ---------- the office's answers, drafts on other phones, notifications ---------- */

/** Asks the office (script `status`) about the reports sent and not approved yet. force = all of them now. */
/** 2.9.0: the reports of the project sent from any phone, so this one shows "Submitted" for them too. */
async function teamDays(p) {
  try {
    const res = await call('projectDays', { proj: p.code });
    store.set({ others: { ...(store.get().others || {}), [p.code]: res.days || [] } });
  } catch { /* an older script or offline: this phone's own reports only */ }
}
async function checkStatus(force) {
  const p = project();
  if (!p || !token() || ui.checking) return;
  await teamDays(p);   // 2.9.0
  const s = store.get(), rows = monthDays(realToday(), p, s.drafts, s.known, (s.others || {})[p.code]);
  const list = force ? rows.filter(x => x.name && x.report && x.report.sentAt) : toCheck(rows, s.known);
  if (!list.length) return;
  ui.checking = true; draw();
  const known = { ...store.get().known };
  for (const x of list) {
    try {
      const res = await call('status', { name: x.name });
      known[x.name] = res.found ? { status: res.report.status, version: res.report.version, comments: res.report.comments || [], history: res.report.history || [], checked: Date.now() } : { status: 'submitted', comments: [], checked: Date.now() };
    } catch (e) { if (e.code === 'OFFLINE') break; }
  }
  ui.checking = false;
  store.set({ known, knownAt: Date.now() });
}

/**
 * 2.12.0 (Phase E1): live reads. When the Admin set the data route to "read", the phone signs in to Central Hub's
 * database with the Google sign-in just made (at) and listens to its project's reports: approvals and comments land
 * in `known` at once. Anything that fails leaves the normal refresh (checkStatus) in charge.
 */
/**
 * 2.79.0 (owner, 9 Nov: Discuss said "Not connected to Central Hub" and stayed so): the live link was made only when the
 * app opened, a project was chosen or the person signed in. A drop (no network at opening, the phone asleep, a database
 * error) was never mended. Now it is tried again by itself: when the phone is back online, when the app comes to the
 * front, and every minute while it is not on ('none', not linked, every 5 minutes; 'signin' needs the person's tap).
 */
/** 2.80.0: an earlier month's reports for Reports (the open project, or every project on the GM's All projects). */
async function monthLoad(month) {
  const s = store.get(), list = (ui.allProj && P.isGM({ s }) ? s.projects : [project()]).filter(Boolean);
  ui.mBusy = true; draw();
  await Promise.all(list.map(p => L.monthReports(p.code, month).then(r => { if (r) (ui.mRows ||= {})[`${p.code}|${month}`] = r; }).catch(() => {})));
  ui.mBusy = false; draw();
}
let healAt = 0;
function liveHeal(force = false) {
  if (demo || !store.get().auth || !project() || !L.healDue(ui.live, healAt, Date.now(), force)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  healAt = Date.now();
  goLive();
}

async function goLive(at = '') {
  if (demo) return;
  ui.liveRoute = await L.routeOf();
  if (!L.LIVE.has(ui.liveRoute)) { ui.live = ''; await L.stop(); return; }
  if (at && !(await L.connect(at))) { ui.live = 'error'; ui.liveWhy = L.liveWhy(); draw(); return; }
  const p = project(), a = store.get().auth;
  if (!p || !a) return;
  const st = await L.listen({
    code: p.code, email: a.email,
    onKnown: list => {
      store.set({ known: { ...store.get().known, ...Object.fromEntries(list) } });
      liveReview(list);   // 2.12.2: the reviewer's list too
      inboxCheck();
      regSoon();   // 2.16.0
    },
    onChange: st => { ui.live = st; ui.liveWhy = L.liveWhy(); draw(); },
    // 2.13.0: Central Hub sent new lists or decided on crew: reload them at once
    onPing: d => {
      const seen = ui.pingSeen; ui.pingSeen = d;
      if (!seen) return;
      if (d.lists && d.lists !== seen.lists) loadSetup();
      if (d.crew && d.crew !== seen.crew) crewSoon();   // 2.16.0: now and again a little later
    },
    // 2.54.0 (owner): the trades of Central Hub's Manpower Directory, the one list every trade is picked from
    onPingTrades: list => { if (JSON.stringify(list) !== JSON.stringify(store.get().trades || [])) store.set({ trades: list }); },
    onTeam: team => { ui.team = team; ui.teamOf = p.code; store.set({ gone: { ...(store.get().gone || {}), [p.code]: team.filter(m => m.active === false).map(m => m.id) } }); crewFollow(); draw(); },
    onUrgent: list => showUrgent(list, a.email, (store.get().profile || {}).name || '', L.answerUrgent),   // 2.34.0
    onDay: (marks, ok) => { ui.marks = marks; ui.dayOk = ok; ui.marksOf = p.code; crewFollow(); draw(); },
    day: realToday(),
    onPhotos: m => { ui.photos = m; draw(); },
    onRequests: list => liveRequests(list),
    onFixes: list => regFixes(list),   // 2.16.0
    onPenalties: list => { ui.pens = list; draw(); },   // 2.57.0
    onStore: list => { ui.smList = list; draw(); },   // 2.61.0 (R5)
    onPOs: list => { ui.poList = list; draw(); },   // 2.62.0 (R6)
    onShots: list => { ui.shList = list; draw(); },   // 2.66.0
    onFeatures: list => {   // 2.74.0 (owner): Central Hub switched features on or off
      const k = JSON.stringify(list || []);
      try { if (localStorage.getItem('fr2_off') === k) return; localStorage.setItem('fr2_off', k); } catch { /* private mode */ }
      setOff(list); draw();
    },
    onChat: list => { (ui.chat ||= {}).ch = list; chatRing(list); draw(); },   // 2.73.0 (owner, R4)
    onDirect: list => { (ui.chat ||= {}).dm = list; chatRing(list); draw(); },
    // 2.17.0: every phone's reports, live; the GM's other projects too
    onDays: (code, days) => liveDays(code, days),
    onReqAll: (code, list) => { (ui.reqAll ||= {})[code] = list; if (ui.allProj) draw(); },
    all: P.isGM({ s: store.get() }),
  });
  if (st === 'stale') return;   // 2.19.2: a newer start is in charge
  ui.live = st;
  ui.liveWhy = L.liveWhy();
  if (ui.live === 'on') { sigSync(); dbResend(); }   // 2.19.1; 2.35.0: database copies still missing
  draw();
}

/**
 * 2.35.0 (3 Nov): the database copy of a sent report (data route Both). Marked `dbAt` when the database answers;
 * a phone that was not signed in sends it again later (dbResend), so Central Hub's Compare finds no gap.
 */
function dbBody(k) {
  const r = store.get().drafts[k], p = store.get().projects.find(x => x.code === r.proj);
  if (!p) return null;
  const meta = reportMeta(r, p, store.get().profile);
  return { proj: p.code, date: r.date, no: r.no, name: (r.sent && r.sent.name) || pdfName(p, r.date, r.no), script: 'ok', meta: L.reportLite(meta),
    // a report sent before 2.35.0 has no signing time: without `full` the database keeps the copy it has
    ...(r.signedAt ? { full: L.reportFull(r, p, store.get().profile, r.signedAt) } : {}) };
}
async function dbCopy(k) {
  const body = dbBody(k);
  if (!body || !L.liveOn()) return false;
  const res = await L.now('report', body);
  if (!res || !res.ok) { if (res && res.refused) editKey(k, x => { x.dbWhy = res.refused; }); return false; }   // 2.69.0: the reason, shown on the bar
  editKey(k, x => { x.dbAt = Date.now(); delete x.dbWhy; });
  return true;
}
let dbBusy = false;
async function dbResend() {
  if (dbBusy || demo || ui.liveRoute !== 'both' || !L.liveOn()) return;
  dbBusy = true;
  try { for (const k of dbWaiting(store.get().drafts)) await dbCopy(k); } finally { dbBusy = false; }
  draw();
}

/**
 * 2.15.0: today's report (not sent yet) follows Central Hub's crew and the marks made on the project's other devices
 * at once: nobody presses "Check the office list".
 */
/** 2.17.0: a project's reports from every phone, live from Central Hub: Reports and Review show the same, with times. */
function liveDays(code, days) {
  const s = store.get(), old = (s.others || {})[code] || [], names = new Set(days.map(d => d.name));
  const next = [...days, ...old.filter(o => !o.live && !names.has(o.name))];
  if (JSON.stringify(next) !== JSON.stringify(old)) store.set({ others: { ...(s.others || {}), [code]: next } });
  const rv = ui.rv;
  if (!rv || !rv.list) return;
  for (const d of days) {
    const x = rv.list.find(y => y.name === d.name), h = d.history || [], last = h[h.length - 1] || {};
    const fresh = { status: d.status, version: d.version, history: h, ...(last.kind && last.kind !== 'submit' ? { reviewedBy: last.by || '', reviewedAt: last.at || '' } : {}) };
    if (x) Object.assign(x, fresh);
    else rv.list.push({ name: d.name, date: d.date, no: d.no, preparedBy: d.by, uploadedAt: d.at, ...fresh });
  }
  rv.list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.no) - Number(a.no));
  draw();
}

/** 2.16.0: crew decided in Central Hub: the office list asked now and again a little later, on every device. */
function crewSoon() { ACTS.attRefresh(true); for (const t of [15e3, 45e3]) setTimeout(() => ACTS.attRefresh(true), t); }

// 2.16.0: Crew attendance: Central Hub's own attendance sheet (its engine, read from the hub); a site correction waits for the office
const HUB_ENGINE = 'https://hub.amistadprefab.com/js/engine/attendance.js';
let ENG = null, regWs = null, regProj = null, regT = 0;
const fixKey = (date, key) => `sr_${date}_${String(key).replace(/[\/.#$\[\]\s]/g, '_')}`;
const myName = () => (store.get().profile || {}).name || '';
/* 2.73.0 (owner, 8 Nov, R4): Discuss. A new message from someone else rings and shows a note with who wrote and what;
   the first read after opening only remembers how things are. */
const CHAT_SEEN = 'fr2_chatSeen';
function chatRing(list) {
  const me = String((store.get().auth || {}).email || '').toLowerCase();
  let seen = 0; try { seen = Number(localStorage.getItem(CHAT_SEEN) || 0); } catch { /* private mode */ }
  const fresh = freshOf(list, me, seen);
  if (!fresh.length) return;
  const top = Math.max(...fresh.map(m => Number(m.sentMs || Date.parse(m.at) || 0)));
  try { localStorage.setItem(CHAT_SEEN, String(top)); } catch { /* private mode */ }
  if (!seen) return;
  const m = fresh[fresh.length - 1];
  try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch { /* no vibration */ }
  if (route() !== 'chat') toast(`Discuss: ${m.name || m.by}: ${String(m.text || '').slice(0, 80)}`);
}
/** 2.74.1: when each conversation was last opened (unread counts on the tab and the conversations). */
const CHAT_READ = 'fr2_chatRead';
try { ui.chatRead = JSON.parse(localStorage.getItem(CHAT_READ) || '{}') || {}; } catch { ui.chatRead = {}; }
function chatMarkRead() {
  const u = ui.chat || {}, me = String((store.get().auth || {}).email || '').toLowerCase(), id = u.open || '';
  const list = threadOf({ ch: u.ch || [], dm: u.dm || [], open: id, me });
  const top = list.reduce((t, m) => Math.max(t, Number(m.sentMs || Date.parse(m.at) || 0)), 0);
  if (top > (ui.chatRead[id] || 0)) { ui.chatRead = { ...ui.chatRead, [id]: top }; try { localStorage.setItem(CHAT_READ, JSON.stringify(ui.chatRead)); } catch { /* private mode */ } }
}
function chatUnread() {
  const u = ui.chat || {}, me = String((store.get().auth || {}).email || '').toLowerCase(), r = ui.chatRead || {};
  const n = CHAT.unreadIn(u.ch || [], me, r['']) + (u.dm || []).filter(m => m.by !== me && !m.deleted && Number(m.sentMs || Date.parse(m.at) || 0) > (r[`dm:${m.by}`] || 0)).length;
  return n > 99 ? '99+' : n;
}
const chatFind = id => [...((ui.chat || {}).ch || []), ...((ui.chat || {}).dm || [])].find(m => m.id === id);
function regBuild() {
  const p = project();
  if (!ENG || !regWs || !regProj || !p) return;
  const period = ENG.periodFor(regProj, ui.regAt || realToday());
  const crewList = (p.staff || []).filter(s => s.active !== false).map(s => ({ id: s.id || '', name: s.name, role: s.trade || '' }));
  const r = ENG.register(regProj, regWs, period, crewList);
  const waiting = {}, answered = [];
  for (const f of regWs.attendance || []) {
    if (!f.review || f.date < period.from || f.date > period.to) continue;
    if (f.review === 'waiting') waiting[`${f.date}|${f.key}`] = f; else answered.push(f);
  }
  answered.sort((a, b) => String(b.reviewAt || '').localeCompare(String(a.reviewAt || '')));
  ui.reg = { code: p.code, period, days: r.days, off: [...r.off], heads: r.heads, reported: r.reportedDays, groups: ENG.groupRows(r.rows, () => 'day'), waiting, answered: answered.slice(0, 20), today: realToday() };
}
async function regLoad() {
  if (!project()) return;
  if (!demo && !L.liveOn()) { ui.regErr = 'The sheet needs live updates (the Central Hub sign-in). Open Me to switch them on.'; return draw(); }
  ui.regBusy = true; ui.regErr = ''; draw();
  try {
    ENG ||= await import(HUB_ENGINE);
    if (demo) { regProj = { id: 'demo', payPeriod: 'weekly' }; regWs = { reports: [], attendance: (regWs && regWs.attendance) || [], team: [] }; }
    else ({ project: regProj, ws: regWs } = await L.sheetData(proj => ENG.periodFor(proj, ui.regAt || realToday())));
    regBuild();
  } catch (e) { ui.regErr = `The sheet did not load: ${e.message || e}`; }
  finally { ui.regBusy = false; draw(); }
}
function regSoon() { if (ui.attTab !== 'sheet' || route() !== 'att') return; clearTimeout(regT); regT = setTimeout(regLoad, 3000); }
function regFixes(list) { if (!regWs) return; regWs.attendance = list; regBuild(); if (route() === 'att' && ui.attTab === 'sheet') draw(); }

/** 2.16.0: Employee data: the crew form, filled in here. It sits outside the page, so redrawing never empties it. */
function empFrame() {
  let box = document.getElementById('emp-box');
  if (!(ui.empUrl && route() === 'att' && ui.attTab === 'emp')) { if (box) box.hidden = true; return; }
  if (!box) {
    box = document.createElement('div'); box.id = 'emp-box'; box.className = 'emp-box';
    box.innerHTML = '<div class="emp-bar"><b>Candidate</b><span>Each form goes to Central Hub, Crew forms, for review</span><button type="button" class="btn t slim" data-emp="new">New form</button><button type="button" class="btn t slim" data-emp="close">Close</button></div><iframe title="Employee data form" allow="camera"></iframe>';
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-emp]');
      if (!b) return;
      if (b.dataset.emp === 'close') { ui.empUrl = ''; draw(); } else box.querySelector('iframe').src = `${ui.empUrl}&n=${Date.now()}`;
    });
    document.body.append(box);
  }
  const f = box.querySelector('iframe');
  if (f.dataset.u !== ui.empUrl) { f.dataset.u = ui.empUrl; f.src = ui.empUrl; }
  box.hidden = false;
}

function crewFollow() {
  const p = project();
  const k = p && draftKey(p.code, realToday()), r = k && store.get().drafts[k];
  if (!r || r.sentAt || r.nowork || !r.crew) return;
  let rows = applyMarks(p.staff.length ? mergeStaff(r.crew.rows, p.staff, p.gone) : r.crew.rows, ui.marksOf === p.code ? ui.marks : null);
  // 2.17.0: only Central Hub's crew (and labour added on site today) once the team is known
  if (ui.teamOf === p.code) { const ok = new Set(p.staff.map(s => String(s.id || s.name).toLowerCase())); rows = rows.filter(x => x.added || ok.has(String(x.id || x.name).toLowerCase())); }
  if (JSON.stringify(rows) !== JSON.stringify(r.crew.rows)) editKey(k, x => { x.crew.rows = rows; });
}

/** 2.15.0: the marks of these rows to the project's other devices (today only). */
function shareRows(rows) {
  if (ui.date || !L.liveOn()) return;
  L.shareMarks(realToday(), Object.fromEntries(rows.map(x => [markKey(x), { id: x.id || '', name: x.name || '', state: x.state || '', ot: Number(x.ot) || 0, at: x.markAt || Date.now(), by: (store.get().profile || {}).name || '' }]))).catch(() => {});
}

/** 2.14.0: the project's shared requests: shown on Requests, and today's drafts kept in today's report. */
function liveRequests(list) {
  ui.liveReqs = list;
  const p = project();
  // 2.39.0 (owner): the last shared list is kept, so a refresh shows the same requests before the database answers
  if (p) store.set({ reqCache: { ...(store.get().reqCache || {}), [p.code]: list } });
  const k = p && draftKey(p.code, realToday()), r = k && store.get().drafts[k];
  if (r && !r.sentAt) {
    const cur = r.requests || [], next = mergeRequests(cur, list, r.date);
    if (JSON.stringify(next) !== JSON.stringify(cur)) editKey(k, x => { x.requests = next; });
  }
  shareLater();
  draw();
}

/** 2.25.0: requests kept on this phone and not in the shared list yet go again, at most once a minute each. */
const tried = new Map();
function shareLater() {
  const p = project();
  if (!p || !L.liveOn() || !ui.liveReqs) return;
  const byName = (store.get().profile || {}).name || '';
  for (const x of unsharedRequests(p.code, store.get().drafts, ui.liveReqs, store.get().reqQueue || [])) {
    if (Date.now() - (tried.get(x.q.id) || 0) < 60000) continue;
    tried.set(x.q.id, Date.now());
    L.saveRequest(x.q, { date: x.date, byName }).then(ok => { if (ok) dropQueued(x.q.id); }).catch(() => {});
  }
}
/** 2.25.0: a request for another day kept on the phone until it is shared (before, it was lost when sharing failed). */
function queueReq(q, date) {
  const p = project(), qq = (store.get().reqQueue || []).filter(x => x.q.id !== q.id);
  if (p) store.set({ reqQueue: [...qq, { code: p.code, date, q: structuredClone(q) }] });
}
function dropQueued(id) {
  const qq = store.get().reqQueue || [];
  if (qq.some(x => x.q.id === id)) store.set({ reqQueue: qq.filter(x => x.q.id !== id) });
}

/** 2.12.2: live answers into the reviewer's open list and report (Review), which come from the script's `list`. */
function liveReview(list) {
  const rv = ui.rv, m = new Map(list);
  if (!rv || !rv.list) return;
  const upd = y => (m.has(y.name) ? { ...y, status: m.get(y.name).status, comments: m.get(y.name).comments } : y);
  rv.list = rv.list.map(upd);
  if (rv.open) rv.open = upd(rv.open);
  draw();
}

/**
 * 2.12.3: never keep working on an old version. When the site's version.json is newer, the app clears its stored
 * copy and reloads; if the site still serves the old one, a wall asks to update. Drafts and photos stay on the phone.
 */
/** 2.13.1: the app's files fetched past every cache (service worker and browser), so the reload is the new version. */
async function freshFiles() {
  try {
    performance.setResourceTimingBufferSize?.(2000);
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.update();
    for (const k of await caches.keys()) if (k !== 'afr-dev') await caches.delete(k);   // 2.56.0: the device id's copy stays
    const own = performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(location.origin) && /\.(js|css|json|html)(\?|$)/.test(u));
    await Promise.all([...new Set([location.href.split('#')[0], ...own])].map(u => fetch(u, { cache: 'reload' }).catch(() => {})));
  } catch { /* reload anyway */ }
}

/** 2.14.2: a newer version is out: a red tag at the top; tapping it updates. Nothing is blocked. */
async function updateCheck() {
  if (demo || !navigator.onLine) return;
  let v = '';
  try { v = (await (await fetch(`version.json?x=${Date.now()}`, { cache: 'no-store' })).json()).v || ''; } catch { return; }
  if (!v || v === APP_VERSION || document.querySelector('.upd-tag')) return;
  const tag = document.createElement('button');
  tag.type = 'button'; tag.className = 'upd-tag'; tag.textContent = `Update to ${v}`;
  tag.title = 'Field Report ' + APP_VERSION + ' is out of date. Tap to update; nothing you saved is lost.';
  tag.onclick = async () => { tag.textContent = 'Updating…'; await freshFiles(); location.reload(); };
  document.body.append(tag);
}

const devId = () => deviceId();   // trial.2: the same id the script's device check knows

/** Today's report as text in the script, so another phone can carry on (photos stay on this phone). */
let draftT = 0;
function draftSoon() {
  clearTimeout(draftT);
  if (demo || ui.date || !token()) return;
  draftT = setTimeout(pushDraft, 15000);
}
async function pushDraft() {
  const r = report(), p = project();
  if (!r || !r.start || !p || (r.sentAt && !(r.updated > r.sentAt + 1000))) return;
  await call('draftPut', { proj: p.code, date: r.date, no: r.no, screen: 'fr2', photoCount: r.photos.length, steps: r.start ? doneCount(r) : 0, dev: devId(), s: { fr2: 1, report: r } }).catch(() => {});
}
async function pullDraft() {
  const p = project();
  if (!p || !token() || ui.date || ui.sheet || demo) return;
  try {
    const res = await call('draftGet', { proj: p.code });
    const how = draftChoice(res.found ? res.draft : null, report(), { today: realToday(), dev: devId() });
    if (how === 'load') { useRemote(res.draft); toast(`Report carried on from ${res.draft.by || 'your other phone'} (saved ${new Date(res.draft.at).toTimeString().slice(0, 5)}).${res.draft.photoCount ? ' Photos it has not sent stay on that phone.' : ''}`); }
    if (how === 'ask') { ui.remote = res.draft; ui.sheet = 'draft'; draw(); }
  } catch { /* offline: try next time */ }
}
function useRemote(d) {
  const mine = report(), r = { ...d.s.report };
  // photos taken on the other phone are not here: keep the ones this phone has and the ones already in Drive (2.1.0)
  const here = new Set((mine && mine.photos || []).map(x => x.id));
  r.photos = (r.photos || []).filter(x => here.has(x.id) || x.drive);
  store.set({ drafts: { ...store.get().drafts, [key()]: r } });
}

/** The OneSignal app id, asked once and kept (2.0.1: the switch no longer waits for the script every time). */
async function pushAppId() {
  const s = store.get();
  if (s.pushAppId) return s.pushAppId;
  const ping = await call('ping', {});
  if (ping.pushAppId) store.quiet({ pushAppId: ping.pushAppId });
  return ping.pushAppId || '';
}

/** Me opened: the notification service loads in the background, so the switch answers at once. */
function pushPreload() {
  const s = store.get();
  if (demo || !s.auth || !s.pushAppId || window.OneSignal) return;
  oneSignal(s.pushAppId, s.auth.who).catch(() => {});
}

/** Push notifications through the same OneSignal app as the old app; the worker lives in push/. */
function oneSignal(appId, who) {
  return new Promise((ok, fail) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    if (!document.getElementById('os-sdk')) {
      const sc = document.createElement('script');
      sc.id = 'os-sdk'; sc.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; sc.defer = true;
      sc.onerror = () => { sc.remove(); fail(new Error('The notification service could not load. Check the connection.')); };
      document.head.appendChild(sc);
    }
    const base = location.pathname.replace(/[^/]*$/, '');
    window.OneSignalDeferred.push(async OS => {
      try { await OS.init({ appId, serviceWorkerPath: base.replace(/^\//, '') + 'push/OneSignalSDKWorker.js', serviceWorkerParam: { scope: base + 'push/' }, notifyButton: { enable: false } }); }
      catch (e) { if (!/already init/i.test(String(e && e.message || e))) return fail(e); }
      try { if (who) await OS.login(who); ok(OS); } catch (e) { fail(e); }
    });
  });
}

/** The project's reminder time (2.7.0, set by the PE or GM; 17:00 when none): a reminder when today's report is not sent (on the phone, while the app is open or in the background). */
function remindTick() {
  const s = store.get(), r = s.drafts[draftKey(s.proj, realToday())];
  if (!s.proj || now() < remindAt() || s.remindedOn === realToday()) return;   // 2.8.0: one reminder per project, no switch in Me
  if (r && (r.sentAt || r.nowork)) return;
  store.quiet({ remindedOn: realToday() });
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification('Field Report', { body: "Today's report is not sent yet.", tag: 'remind', icon: 'icon-192.png' })).catch(() => {});
  }
  draw();
}

/* ---------- the report: PDF, upload, outbox ---------- */

const toDataUrl = blob => new Promise((ok, fail) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => fail(fr.error); fr.readAsDataURL(blob); });

let pdfSignedAt = '';
/** The report PDF, with the report's photos (from this phone, or from Drive) and the saved signature. */
async function makePdf(r, p, step = () => {}) {
  step('Making the PDF…');
  const JsPDF = await loadPdfLib();
  const photos = [];
  for (const ph of r.photos) {
    const b = await getPhoto(ph.id).catch(() => null) || (ph.drive ? await drivePhoto(pdfName(p, r.date, r.no), ph.id) : null);
    if (!b) continue;
    const bmp = await createImageBitmap(b).catch(() => null);
    photos.push({ data: await toDataUrl(b), w: bmp ? bmp.width : 4, h: bmp ? bmp.height : 3, at: ph.at || '', cap: photoCaption(ph, r.items) });
    if (bmp) bmp.close();
  }
  const prof = store.get().profile;
  const pic = f => (f ? fetch(f).then(x => x.blob()).then(toDataUrl).catch(() => '') : '');
  const [logo, weather] = await Promise.all([pic('icon-192.png'), pic(weatherFile(weatherTerm(r.start.cond)) && `img/weather/${weatherFile(weatherTerm(r.start.cond))}.png`)]);
  pdfSignedAt = now();   // 2.23.0: kept with the whole report, so Central Hub prints the same time
  const doc = buildPdf(JsPDF, { r, project: p, profile: prof, file: pdfName(p, r.date, r.no), logo, weather, photos, sig: r.signed ? prof.sig : '', signedAt: pdfSignedAt });
  const blob = doc.output('blob');
  if (ui.pdf) URL.revokeObjectURL(ui.pdf.url);
  ui.pdf = { key: draftKey(r.proj, r.date), at: r.updated, blob, url: URL.createObjectURL(blob), name: pdfName(p, r.date, r.no) };
  logAct({ action: 'generate', channel: 'PDF', doc: ui.pdf.name, no: r.no ? `#${r.no}` : '' });   // 2.59.0
  return blob;
}

/** 2.11.0: how many photos fill the last photo page: the PDF laid out without the pictures, when jsPDF is at hand. */
function fitSoon() {
  const r = report(), p = project();
  if (!r || !p) return;
  const key = `${draftKey(r.proj, r.date)}|${r.updated}`;
  if (ui.fit && ui.fit.key === key) return;
  ui.fit = { key };
  loadPdfLib().then(J => {
    const doc = buildPdf(J, { r, project: p, profile: store.get().profile, photos: r.photos.map(ph => ({ data: '', w: 4, h: 3, at: ph.at, cap: photoCaption(ph, r.items) })), signedAt: '00:00' });
    if (ui.fit.key === key) { ui.fit = { key, ...doc.photoFit }; draw(); }
  }).catch(() => {});   // offline and never loaded: no hint
}

/** The script's answer to a sign-in (from the demo button or the return from Google). */
async function signedIn(pending) {
  ui.busy = true; ui.error = ''; draw();
  try {
    const a = await pending;
    const s = store.get();
    // 2.74.1 (owner, 8 Nov): a phone signed in with another account forgets the last person's name, position and
    // signature (a shared Kinshasa phone put one person's name on another account's reports); the account's own come back
    const was = String(s.profile.of || (s.auth && s.auth.email) || '').toLowerCase(), now = String(a.email || '').toLowerCase();
    const other = !!was && !!now && was !== now;
    const prof = other ? { ...s.profile, name: '', position: '', sig: '', sigAt: 0, locked: false, sentNP: '' } : s.profile;
    store.set({ auth: { token: a.token, who: a.who, role: a.role, email: a.email, name: a.name }, profile: { ...prof, of: now, name: prof.name || a.name || '' } });
    applyMe(a.me);
    if ('rules' in a) store.set({ rules: cleanRules(a.rules) });   // 2.60.0 (G6)
    ui.signup = null;
    oldAppClear();
    sigFetch();
    await loadProjects();
    let after = '';
    try { after = sessionStorage.getItem(AFTER) || ''; } catch { /* none */ }
    if (after === 'emp') { ui.attTab = 'emp'; go('att'); try { sessionStorage.setItem(AFTER, 'done'); } catch { /* once */ } } else go('today');   // 2.43.1: back to Candidate, once
    checkStatus(); devCheck(true); inboxCheck(true); pullDraft();   // 2.53.0: a draft lost with the sign-out comes back
    goLive(takeGoogleToken());
  } catch (e) {
    if (e.code === 'SIGNUP') ui.signup = { email: (e.reply && e.reply.email) || (ui.signup || {}).email || '', sent: !!(ui.signup && ui.signup.asking), msg: e.message };
    else ui.error = e.message;
  }
  ui.busy = false; draw();
}

/** 2.19.1: a new signature: on this phone, and in Central Hub's copy that every device of this person uses. */
function sigSaved(png) {
  const at = Date.now();
  store.set({ profile: { ...store.get().profile, sig: png, sigAt: at } });
  L.sigPush(png, at).catch(() => {});
}
/** 2.19.1: when live: the newer of this phone's signature and the shared one wins on both. */
async function sigSync() {
  try {
    const prof = store.get().profile, far = await L.sigPull();
    if (far && far.sig !== prof.sig && (!prof.sig || far.at >= (prof.sigAt || 0))) { store.set({ profile: { ...store.get().profile, sig: far.sig, sigAt: far.at } }); draw(); }
    else if (prof.sig && (!far || far.sig !== prof.sig)) await L.sigPush(prof.sig, prof.sigAt || Date.now());
  } catch { /* the script's copy still works */ }
}

/** 2.4.0: the signature kept in Drive comes to a phone that has none (a new phone, or after clearing it). */
function sigFetch() {
  if (demo || store.get().profile.sig) return;
  call('sigGet', {}).then(r => { if (r.sig && !store.get().profile.sig) store.set({ profile: { ...store.get().profile, sig: r.sig } }); }).catch(() => {});
}

/** trial.2: only the Admin may see, share or download the report PDF (the script also keeps the Drive link from the others). */
const adminRole = () => ((store.get().auth || {}).role || '') === 'admin';
const dropPdf = () => { if (ui.pdf) { URL.revokeObjectURL(ui.pdf.url); ui.pdf = null; } };
const pdfRefused = () => { toast('The report PDF goes to the office only. Use View the report.'); return true; };

/** 2.59.0 (owner, G1): a line of Central Hub's activity record: a report PDF made, opened, shared or downloaded, a report sent. */
function logAct(e) {
  if (demo) return;
  try {
    const s = store.get(), p = project();
    L.logAct(actEntry({ page: 'Field Report', ...e }, { email: L.logEmail(), name: (s.profile || {}).name || '', position: (s.profile || {}).position || '', project: p ? p.code : '', projectName: p ? p.name || p.code : '' }));
  } catch { /* the record never stops the work */ }
}

/** 2.0.1: the old app (at /v1/) is for the Admin only. On everyone else's phone its saved data goes: its settings, sign-in,
 *  drafts and unsent reports (localStorage "afr_…" and IndexedDB "afr"). The device id (afr_devid) stays: it is shared with this app. */
function oldAppClear() {
  const role = (store.get().auth || {}).role;
  if (demo || !role || role === 'admin') return;
  try { Object.keys(localStorage).filter(k => k.startsWith('afr') && k !== 'afr_devid').forEach(k => localStorage.removeItem(k)); } catch { /* no storage */ }
  try { indexedDB.deleteDatabase('afr'); } catch { /* no IndexedDB */ }
}

/** 2.0.2: the name and position Central Hub confirmed win over what was typed here, and cannot be changed on the phone. */
function applyMe(me) {
  if (!me) return;
  const p = store.get().profile;
  if (me.locked) {
    if (p.name !== me.name || p.position !== me.position || !p.locked) store.set({ profile: { ...p, name: me.name, position: me.position, locked: true, sentNP: `${me.name}|${me.position}` } });
  } else if (p.locked) store.set({ profile: { ...p, locked: false } });
}

/** 2.0.2: what the person typed goes to Central Hub to be confirmed (once per change; quietly, it is sent again later if offline). */
async function sendProfile() {
  const p = store.get().profile, np = `${String(p.name || '').trim()}|${String(p.position || '').trim()}`;
  if (demo || p.locked || !store.get().auth || np === p.sentNP) return;
  try {
    const r = await call('profilePut', { name: p.name || '', position: p.position || '' });
    store.quiet({ profile: { ...store.get().profile, sentNP: np } });
    applyMe(r.me);
  } catch { /* offline or an older script: sent again next time */ }
}

/** 2.0.1: the notifications sent to this person (script 7.29.0), shown at the top of Today. At most once a minute unless asked. */
async function inboxCheck(force) {
  if (!store.get().auth || (!force && Date.now() - (ui.inboxAt || 0) < 60e3)) return;
  ui.inboxAt = Date.now();
  try {
    const r = await call('inbox', {});
    applyMe(r.me);
    if ('rules' in r) { const nr = cleanRules(r.rules); if (JSON.stringify(nr) !== JSON.stringify(store.get().rules || null)) store.set({ rules: nr }); }   // 2.60.0 (G6)
    const items = r.items || [], was = store.get().inbox || [];
    if (JSON.stringify(items) !== JSON.stringify(was)) store.set({ inbox: items });
  } catch (e) { if (force && e.code !== 'BAD_REQUEST') toast(e.message); }
}

/** The Admin's list of devices (script 7.28.0), at most once a minute unless asked. */
async function devCheck(force) {
  if (!adminRole() || (!force && Date.now() - (ui.devsAt || 0) < 60e3)) return;
  ui.devsAt = Date.now();
  try { const r = await call('devices', {}); ui.devs = r.devices || []; ui.refused = r.refused || []; draw(); } catch (e) { if (force) toast(e.message); }
}

/** The PDF of today's report: the one just made when nothing changed since, otherwise a new one. */
async function currentPdf() {
  const r = report();
  if (ui.pdf && ui.pdf.key === key() && ui.pdf.at === r.updated) return ui.pdf;
  await makePdf(r, project());
  return ui.pdf;
}

const queueReport = k => {
  store.set({ outbox: [...store.get().outbox.filter(j => !(j.action === 'report' && j.body.key === k)), { action: 'report', body: { key: k }, at: Date.now() }] });
  editKey(k, r => { r.queuedAt = r.queuedAt || Date.now(); r.sendError = ''; });
};
const unqueue = k => store.set({ outbox: store.get().outbox.filter(j => !(j.action === 'report' && j.body.key === k)) });

/**
 * Sends a report: the PDF with the file name Central Hub and the script know, and the report file (meta).
 * Without a connection it waits in the outbox and is made again when the connection is back.
 */
async function sendReport(k, step = () => {}) {
  const p = store.get().projects.find(x => x.code === store.get().drafts[k].proj);
  if (!store.get().drafts[k].sentAt) {
    // 2.3.1: a script older than 7.34.0 has no reportNo: the phone's own number is used, as before
    try { await syncNo(k); } catch (e) { if (e.code === 'OFFLINE' || e.code === 'BUSY') { queueReport(k); return 'queued'; } }
  }
  const r = store.get().drafts[k];
  const name = pdfName(p, r.date, r.no), meta = reportMeta(r, p, store.get().profile);
  // 2.7.0: when Send was pressed on the phone (earlier than the arrival when it waited for a connection)
  const pressed = r.queuedAt || Date.now();
  meta.pressedAt = new Date(pressed).toISOString();
  try { await sendPhotos(k, name, step); } catch (e) {
    if (e.code === 'OFFLINE' || e.code === 'BUSY') { queueReport(k); return 'queued'; }
    throw e;
  }
  let blob;
  try { blob = await makePdf(store.get().drafts[k], p, step); } catch { queueReport(k); return 'queued'; }
  step('Sending…');
  const data = (await toDataUrl(blob)).split(',')[1];
  if (!adminRole()) dropPdf();   // trial.2: the PDF is made only to send it; the engineer's phone does not keep it
  try {
    const res = await call('upload', { name, folderId: '', data, meta });
    const at = Date.now();
    logAct({ action: 'send', channel: 'To the office', doc: name, no: r && r.no ? `#${r.no}` : '' });   // 2.59.0 (G1)
    editKey(k, x => { x.firstSentAt = x.firstSentAt || at; x.sentAt = at; x.pressedAt = pressed; x.updated = at; x.queuedAt = 0; x.sendError = ''; x.sent = { name, version: res.version || 1, status: res.status || 'submitted', unchanged: !!res.unchanged, hash: meta.hash }; });
    if (ui.pdf && ui.pdf.key === k) ui.pdf.at = at;
    unqueue(k);
    if (k === draftKey(p.code, realToday()) && !demo) call('draftDel', { proj: p.code }).catch(() => {});
    store.set({ known: { ...store.get().known, [name]: { status: res.status || 'submitted', version: res.version || 1, comments: (store.get().known[name] || {}).comments || [], checked: Date.now() } } });
    L.now('reports', { proj: p.code });   // 2.13.0: Central Hub takes it now, not on its next run
    // 2.19.0 (Phase E3a): Data route Both: the report goes to the database too (Central Hub's Compare checks the two)
    // 2.23.0 (CH 20b): with the whole report, for Central Hub's copy of the PDF and its edits
    editKey(k, x => { x.signedAt = pdfSignedAt; });
    if (ui.liveRoute === 'both') dbCopy(k);   // 2.35.0: marked when the database answers, else sent again later
    // 2.14.0: the day's shared requests go to the office with the report
    for (const q of (store.get().drafts[k] || {}).requests || []) if (q.live) L.requestStatus(q.id, 'requested', { byName: (store.get().profile || {}).name || '', note: `With report ${name}` }).catch(() => {});
    return 'sent';
  } catch (e) {
    if (e.code === 'OFFLINE' || e.code === 'BUSY') { queueReport(k); return 'queued'; }
    // 2.3.0: another number was already given to this date: take it and send again (once)
    if (e.code === 'RENUMBER' && e.reply && e.reply.no && e.reply.no !== r.no && !step.again) { editKey(k, x => { x.no = e.reply.no; }); const again = s => step(s); again.again = true; return sendReport(k, again); }
    throw e;
  }
}

/** 2.1.0: the report's photos to Drive, before its PDF. Each one is marked (drive = its Drive id, upAt) as it arrives,
 *  so a Send that stops halfway carries on where it stopped. */
async function sendPhotos(k, name, step) {
  const todo = (store.get().drafts[k].photos || []).filter(ph => !ph.drive);
  let i = 0;
  for (const ph of todo) {
    i += 1;
    const b = await getPhoto(ph.id).catch(() => null);
    if (!b) continue;   // taken on another phone and never sent from there
    step(`Sending photos… ${i} of ${todo.length}`);
    // 2.51.0 (owner): the camera original in full quality, after a screen copy for Central Hub; the 1600 px copy when the
    // original is not on this phone (taken before 2.51.0). Time and caption go with it, so the office sees it live.
    const meta = { time: ph.at || '', caption: ph.caption || '', zone: ph.zone || '' }, o = await getPhoto(ORIG(ph.id)).catch(() => null);
    const b64 = async x => (await toDataUrl(x)).split(',')[1];
    await call('photoPut', { report: name, id: ph.id, kind: 'tile', data: await b64(await tileCopy(o || b)), ...meta });   // 2.78.0: the tile first, so it shows at once
    if (o) await call('photoPut', { report: name, id: ph.id, kind: 'screen', data: await b64(await screenCopy(o)), ...meta });
    const res = await call('photoPut', { report: name, id: ph.id, data: await b64(o || b), ...meta });
    if (o) deletePhoto(ORIG(ph.id)).catch(() => {});
    editKey(k, r => { const x = r.photos.find(y => y.id === ph.id); if (x) { x.drive = res.fileId || 'yes'; x.upAt = Date.now(); } });
  }
}

/** 2.1.0: a photo this phone no longer has, read back from Drive (kept for this session only). */
const fromDrive = new Map();
async function drivePhoto(report, id, size = '') {
  const key = size ? `${size}|${id}` : id;   // 2.78.0: size 'tile' = the small picture
  if (fromDrive.has(key)) return fromDrive.get(key);
  const job = call('photoGet', { report, id, ...(size ? { size } : {}) }).then(res => fetch(`data:image/jpeg;base64,${res.data}`).then(x => x.blob())).catch(() => null);
  fromDrive.set(key, job);
  const b = await job;
  if (!b) fromDrive.delete(key);   // offline: tried again next time
  return b;
}

/** 2.54.0: the GM's Dashboard: the day's photos (script dayPhotos), the project's videos (videoList), each photo read from Drive. */
async function mediaLoad() {
  const p = project(), day = ui.mDay || realToday();
  if (!p) return;
  const k = `${p.code}|${day}`;
  ui.mPhotos ||= {}; ui.mVids ||= {}; ui.mUrl ||= {}; ui.mErr = '';
  try {
    if (!ui.mVids[p.code]) ui.mVids[p.code] = (await call('videoList', { proj: p.code })).videos || [];
    ui.mPhotos[k] = (await call('dayPhotos', { proj: p.code, date: day })).photos || [];
  } catch (e) { ui.mErr = e.message; ui.mPhotos[k] = ui.mPhotos[k] || []; }
  draw();
  for (const ph of ui.mPhotos[k] || []) {
    if (ui.mUrl[ph.id]) continue;
    const b = await drivePhoto(ph.report, ph.id, 'tile');   // 2.78.0: tiles first; the screen copy when one is opened
    if (b) { ui.mUrl[ph.id] = URL.createObjectURL(b); if (route() === 'media') draw(); }
  }
}

/** The thumbnail of a photo that left this phone: from Drive, through the report that holds it. */
async function driveUrl(id) {
  const d = store.get().drafts;
  for (const r of Object.values(d)) {
    const ph = (r.photos || []).find(x => x.id === id);
    const p = ph && ph.drive && store.get().projects.find(x => x.code === r.proj);
    if (!p) continue;
    const b = await drivePhoto(pdfName(p, r.date, r.no), id);
    return b ? URL.createObjectURL(b) : '';
  }
  return '';
}

/** 2.1.0: a photo leaves this phone 7 days after it is safely in Drive (the report keeps its caption and Drive mark). */
const PHOTO_DAYS = 7;
async function cleanPhotos() {
  const old = [], d = store.get().drafts, limit = Date.now() - PHOTO_DAYS * 864e5;
  for (const [k, r] of Object.entries(d)) for (const ph of r.photos || []) if (r.sentAt && ph.drive && !ph.gone && ph.upAt && ph.upAt < limit) old.push([k, ph.id]);
  for (const [k, id] of old) {
    await deletePhoto(id).catch(() => {});
    deletePhoto(ORIG(id)).catch(() => {});
    editKey(k, r => { const x = r.photos.find(y => y.id === id); if (x) x.gone = true; });
  }
}

/* signature pad: strokes kept in ui so a redraw paints them again */
function bindSig() {
  const cv = root.querySelector('#sigpad');
  if (!cv) return;
  const g = cv.getContext('2d');
  g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1b2430';
  const paint = () => { g.clearRect(0, 0, cv.width, cv.height); for (const st of ui.sig || []) { g.beginPath(); st.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); } };
  const at = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * cv.width / b.width, (e.clientY - b.top) * cv.height / b.height]; };
  let cur = null;
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); cur = [at(e)]; ui.sig = [...(ui.sig || []), cur]; paint(); };
  cv.onpointermove = e => { if (cur) { cur.push(at(e)); paint(); } };
  cv.onpointerup = cv.onpointercancel = () => { cur = null; };
  paint();
}

async function sendOrQueue(action, body) {
  try { await call(action, body); return 'sent'; }
  catch (e) {
    if (e.code !== 'OFFLINE' && e.code !== 'BUSY') throw e;
    const box = store.get().outbox.filter(j => !(j.action === action && j.body.date === body.date && j.body.proj === body.proj));
    store.set({ outbox: [...box, { action, body, at: Date.now() }] });
    return 'queued';
  }
}

/** 2.64.0 (R8): the 3-day forecast for Today, once per project and day. */
function fetchForecast() {
  const p = project();
  if (demo || !p || p.siteLa == null || p.siteLo == null) return;
  const key = `${p.code}|${realToday()}`;
  if (ui.fcKey === key) return;
  ui.fcKey = key;
  fetch(forecastUrl(p.siteLa, p.siteLo)).then(r => r.json()).then(j => { ui.fc = forecastOf(j); draw(); }).catch(() => { ui.fc = null; });
}

/** Today's weather at the site, when the project has a map position. Optional: the fields stay editable. */
async function fetchWeather() {
  const p = project();
  if (demo || !p || p.siteLa == null || p.siteLo == null) return;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${p.siteLa}&longitude=${p.siteLo}&current=temperature_2m,weather_code,wind_speed_10m`;
    const cur = (await (await fetch(u)).json()).current;
    const code = cur.weather_code;
    // 2.7.0: the WMO weather code in the owner's 8 terms
    const cond = cur.wind_speed_10m >= 30 ? 'Windy' : (code >= 63 && code <= 67) || code >= 81 ? 'Heavy Rain' : code >= 51 ? 'Light Rain' : code >= 45 ? 'Foggy / Hazy' : code === 3 ? 'Cloudy / Overcast' : code >= 1 ? 'Partly Cloudy' : 'Sunny';
    edit(r => { if (!r.start.done) { r.start.cond = cond; r.start.tempC = Math.round(cur.temperature_2m); } });
    ui.wx = `fetched for ${p.location || p.name}`;
    draw();
  } catch { /* no forecast: the engineer picks */ }
}

/* ---------- actions ---------- */

const go = to => { location.hash = to; };
const AFTER = 'fr2_after';
/** 2.45.0: what each crew member's employee record in Central Hub still misses (read each time the Crew tab opens). */
async function crewInfo() {
  const p = project();
  if (!p || demo || !L.liveOn()) return;
  const r = await L.now('crewInfo', { proj: p.code });
  if (r && r.info) { ui.crewInfo = { code: p.code, info: r.info }; draw(); }
}
const attRefreshSoon = () => setTimeout(() => { ACTS.attRefresh(true); crewInfo(); }, 300);   // 2.43.1: the page to return to after the Central Hub sign-in
/** 2.71.0: why live updates (and the crew employee data) are not available, in words. */
function liveWhyText(st, why = '') {
  if (st === 'none') return 'This project is not linked to your email in Central Hub. Ask the Admin to put you on it in the Manpower Directory.';
  if (st === 'error') return `Central Hub's database cannot be reached now${why ? ` (${why})` : ''}. Check the internet and try again.`;
  if (st === 'off' || st === '') return 'Live updates are off for this project. Ask the Admin.';
  return 'Connecting to Central Hub… try again in a moment.';
}
function toast(msg) {
  ui.toast = msg; draw();
  clearTimeout(toast.t); toast.t = setTimeout(() => { ui.toast = ''; draw(); }, 2600);
}

/** Opens a work item: an existing one by id, or a new one stamped with the time, in the last zone used. */
function openItem(id) {
  const r = ensureReport();
  const found = id && r.items.find(x => x.id === id);
  ui.back = location.hash.slice(1) === 'work' ? 'work' : 'today';
  ui.item = found ? structuredClone(found) : newItem(now(), r.items.at(-1));
  ui.allTasks = false; ui.mileOpen = false; ui.heard = '';
  if (location.hash.slice(1) === 'item') draw(); else go('item');
}

/** Hours of today's working day, for the equipment added. */
const hoursOf = s0 => { const [a, b] = [s0.start, s0.end].map(t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] + m[2] / 60 : null; }); return a != null && b > a ? Math.round((b - a) * 2) / 2 : 8; };

/** Opens a delivery: an existing one by id, or a new one stamped with the time. */
function openRecv(id) {
  const r = ensureReport();
  const found = id && r.received.find(x => x.id === id);
  ui.recv = found ? structuredClone(found) : newReceived(now());
  if (location.hash.slice(1) === 'delivery') draw(); else go('delivery');
}

/** Opens a request: an existing one by id, or a new one stamped with the time. */
function openReq(id) {
  const r = ensureReport();
  const found = id && (r.requests || []).find(x => x.id === id);
  const shared = !found && id && (ui.liveReqs || []).find(d => d.fr && d.fr.id === id && d.status === 'draft');   // 2.14.0
  // 2.40.0 (owner): an asked request is changed too, until the office acts on it
  const asked = id && (ui.liveReqs || []).find(d => d.fr && d.fr.id === id && d.status === 'requested');
  ui.reqAsked = !!asked;
  if (asked) { ui.req = { ...fromLive(asked), live: true }; ui.reqDate = asked.fr.date; if (location.hash.slice(1) === 'request') draw(); else go('request'); return; }
  const queued = !found && !shared && id && (store.get().reqQueue || []).find(x => x.q.id === id);   // 2.25.0
  ui.req = found ? structuredClone(found) : shared ? fromLive(shared) : queued ? structuredClone(queued.q) : newRequest(now());
  ui.reqDate = shared ? shared.fr.date : queued ? queued.date : '';
  if (location.hash.slice(1) === 'request') draw(); else go('request');
}

/** Opens a delay: an existing one by id, or a new one stamped with the time. */
function openDelay(id) {
  const r = ensureReport();
  const found = id && r.delays.find(x => x.id === id);
  ui.delay = found ? structuredClone(found) : newDelay(now());
  if (location.hash.slice(1) === 'delay') draw(); else go('delay');
}

/* voice entry */
let stopVoice = null;
function startListening() {
  ui.listening = true; ui.heard = ''; draw();
  const p = project(), setup = p.setup || {};
  stopVoice = listen({
    onText(text, final) {
      ui.heard = text;
      if (final && ui.item) {
        const got = parseSpeech(text, { zones: zonesOf(setup, store.get().siteZones[p.code], report().items), types: setup.activities || p.activities || [], tasks: setup.tasks || [] });
        const it = ui.item;
        it.text = it.text ? `${it.text} ${got.text}` : got.text;
        for (const k of ['zone', 'type', 'taskId', 'task', 'unit']) if (got[k]) it[k] = got[k];
        if (got.qty) it.qty = got.qty;
      }
      draw();
    },
    onEnd() { ui.listening = false; stopVoice = null; draw(); },
    onError(msg) { ui.listening = false; toast(msg); },
  });
}
function stopListening() { if (stopVoice) stopVoice(); ui.listening = false; }

/* camera: one hidden file input, opened from a tap so the phone allows it */
const cam = document.getElementById('cam');
function camera() { cam.value = ''; cam.multiple = false; cam.click(); }
cam.addEventListener('change', () => addPhotos([...(cam.files || [])]));
// 2.32.0 (owner): the GM may add report photos from the gallery too; they are marked as such (Central Hub shows "From gallery")
const gal = document.getElementById('gal');
gal.addEventListener('change', async () => {
  if (!P.isGM({ s: store.get() })) return;
  const files = [...(gal.files || [])].filter(f => /^image\//.test(f.type));
  ui.camFor = 'photo';
  for (const f of files) { ui.fromGallery = timeIn('Africa/Addis_Ababa', new Date(f.lastModified || Date.now())); await addPhoto(f); }
  ui.fromGallery = '';
});

/** 2.5.0: report photos come from the camera only. A picture made more than a few minutes ago (from the gallery) is refused. */
const FRESH_MS = 3 * 60000;
async function addPhotos(files) {
  const all = files.filter(f => /^image\//.test(f.type)), pics = all.filter(f => !f.lastModified || Date.now() - f.lastModified < FRESH_MS);
  if (all.length > pics.length) toast('Only a photo taken now with the camera can go in the report.');
  if (!pics.length) return;
  if (route() === 'item' && ui.item) ui.camFor = 'item';
  if (route() === 'delivery' && ui.recv) ui.camFor = 'recv';
  if (ui.camFor === 'item' || ui.camFor === 'recv') { for (const f of pics) await addPhoto(f); return; }
  await addPhoto(pics[0]);
  if (pics.length > 1) toast('One photo at a time here; drop the rest on a work item to attach them all.');
}
// 2.5.0: no dropping or pasting pictures: report photos are taken with the camera
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); if ([...(e.dataTransfer?.files || [])].length) toast('Report photos are taken with the camera.'); });

/** Shrinks and keeps a picture, then attaches it to the item being edited or opens the Photo page. */
/** 2.11.0: 'p' (portrait) or 'l' (landscape), for the PDF's photo grid. */
const orientOfBlob = async b => { const bmp = await createImageBitmap(b).catch(() => null); if (!bmp) return 'l'; const o = bmp.height > bmp.width ? 'p' : 'l'; bmp.close(); return o; };
async function addPhoto(file) {
  try {
    const blob = await shrink(file), id = uid(), o = await orientOfBlob(blob);
    await putPhoto(id, blob);
    await putPhoto(ORIG(id), await original(file)).catch(() => {});   // 2.51.0: the original goes to Drive, full quality
    await photoUrl(id);
    const r = ensureReport();
    if (ui.camFor === 'item' && ui.item) {
      ui.item.photos.push(id);
      edit(x => { x.photos.push({ id, o, at: now(), zone: ui.item.zone, captionKind: 'Progress', caption: '', itemId: ui.item.id }); });
    } else if (ui.camFor === 'crew') {
      edit(x => { x.photos.push({ id, o, at: now(), zone: '', captionKind: 'Crew', caption: 'Morning crew', itemId: '' }); });
      crewStamp(id);
      return;
    } else if (ui.camFor === 'recv' && ui.recv) {
      if (!ui.recv.photos.length) ui.recv.at = now();   // 2.5.0: the first photo's time is the delivery time
      ui.recv.photos.push(id);
      edit(x => { x.photos.push({ id, o, at: now(), zone: '', captionKind: 'Delivery', caption: ui.recv.name ? `Delivery: ${ui.recv.name}` : 'Delivery note', itemId: '' }); });
    } else {
      const last = r.items.at(-1);
      ui.photo = { id, o, at: ui.fromGallery || now(), zone: last ? last.zone : '', captionKind: 'Progress', caption: '', itemId: '', ...(ui.fromGallery ? { gallery: true } : {}) };
      ui.photoEditing = false;
      ui.photoBack = route() === 'photos' ? 'photos' : 'today';
      if (location.hash.slice(1) === 'photo') draw(); else go('photo');
    }
    upNow();
  } catch (e) { toast(`The photo could not be saved on this phone (${e.message || e}).`); }
}

/** 2.66.0: approve or reject a technician's photos. */
async function shDecide(id, status, reason = '') {
  ui.busy = true; draw();
  try { await L.shotStatus(id, status, (store.get().profile || {}).name || '', reason); toast(status === 'approved' ? 'Approved.' : 'Rejected. The technician sees why.'); }
  catch (e) { toast(`Not saved: ${e.message}`); }
  ui.busy = false; draw();
}
/** 2.66.0: a work photo made small (about 230 KB) and checked for clearness on a 160-px grey copy. */
async function shotPhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  const src = bmp || await new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = URL.createObjectURL(file); });
  const g = document.createElement('canvas'), k0 = 160 / Math.max(src.width, src.height);
  g.width = Math.max(8, Math.round(src.width * k0)); g.height = Math.max(8, Math.round(src.height * k0));
  const gx = g.getContext('2d'); gx.drawImage(src, 0, 0, g.width, g.height);
  const px = gx.getImageData(0, 0, g.width, g.height).data, gray = new Uint8ClampedArray(g.width * g.height);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const q = qualityOf(gray, g.width, g.height);
  const c = document.createElement('canvas');
  let side = 1280, jq = 0.72, url = '';
  for (let i = 0; i < 8; i++) {
    const k = Math.min(1, side / Math.max(src.width, src.height));
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', jq);
    if (url.length <= PHOTO_CHARS) break;
    side = Math.round(side * 0.8); jq = Math.max(0.45, jq - 0.05);
  }
  return { url, q };
}

/** 2.5.0: the crew photo's time (the server's when online) and place, and whether it is on time. */
const crewClock = () => (demo && new URLSearchParams(location.search).get('t')) || now();
const where = () => new Promise(res => {
  if (!navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(p => res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }), () => res(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
});
async function crewStamp(id) {
  const phone = Date.now();
  const [geo, srv] = await Promise.all([where(), demo ? Promise.resolve(phone) : call('sync', {}).then(x => Number(x.t) || 0).catch(() => 0)]);
  const time = demo ? crewClock() : timeIn(undefined, new Date(srv || phone));
  const s = crewPhotoState(time, { offline: !srv, skewMin: srv ? (srv - phone) / 60000 : 0, start: crewStart() });
  if (s.st === 'closed') {
    edit(x => { x.photos = x.photos.filter(p => p.id !== id); });
    deletePhoto(id).catch(() => {});
    return toast(`Crew photos close at ${crewCloses(crewStart())}. This one was not kept.`);
  }
  edit(x => {
    const p = x.photos.find(y => y.id === id);
    if (p) { p.at = time; p.crew = { st: s.st, tags: s.tags, geo, phoneAt: phone, serverAt: srv }; p.caption = `Morning crew · ${CREW_ST_WORD[s.st]} ${time}${s.tags.length ? ` · ${s.tags.join(', ')}` : ''}`; }
  });
  toast(`Crew photo kept: ${CREW_ST_WORD[s.st]}, ${time}.`);
  upNow();
}

/** 2.5.0: each photo goes to Drive as soon as it is taken when there is a connection (else with the report). */
let upping = false;
async function upNow() {
  const k = key(), r = report(), p = project();
  if (upping || demo || !navigator.onLine || !r || !p || r.nowork || !(r.photos || []).some(x => !x.drive)) return;
  upping = true;
  try { await syncNo(k); const r2 = store.get().drafts[k]; await sendPhotos(k, pdfName(p, r2.date, r2.no), () => {}); }
  catch { /* sent with the report */ }
  finally { upping = false; }
}

/* 2.7.0: Spotlight. Photos and videos wait in the phone's photo store; each goes up alone, then the note. */
const spotCam = document.getElementById('spotCam'), spotVid = document.getElementById('spotVid');
const spotGal = document.getElementById('spotGal');   // 2.27.0 (owner): from the gallery too, several at once
const spotIn = el => { el.value = ''; el.click(); };
/* 2.29.0: the receipt of an expense, camera or gallery, made small enough to go with the request (at most about 300 KB). */
const rcpt = document.getElementById('rcpt');
async function receiptUrl(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  const src = bmp || await new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = URL.createObjectURL(file); });
  const c = document.createElement('canvas');
  let side = 1400, q = 0.75, url = '';
  for (let i = 0; i < 6; i++) {
    const k = Math.min(1, side / Math.max(src.width, src.height));
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', q);
    if (url.length * 0.75 < 300 * 1024) break;
    side = Math.round(side * 0.8); q = Math.max(0.5, q - 0.05);
  }
  return url;
}
rcpt.addEventListener('change', async () => {
  const f = rcpt.files?.[0];
  if (!f || !ui.req) return;
  try { ui.req.receipt = await receiptUrl(f); draw(); } catch { toast('That picture could not be read.'); }
});
/** 2.21.0: the length of a video in seconds (0 when the phone cannot tell). */
const videoSeconds = file => new Promise(res => { const v = document.createElement('video'), u = URL.createObjectURL(file); v.preload = 'metadata'; v.onloadedmetadata = () => { URL.revokeObjectURL(u); res(Number.isFinite(v.duration) ? v.duration : 0); }; v.onerror = () => { URL.revokeObjectURL(u); res(0); }; v.src = u; });
const spotFiles = async files => {
  // 2.49.0: the camera may be taking a visitor's photo (camera only, photos only)
  const forVisit = ui.camFor === 'visit' && ui.visit; ui.camFor = '';
  const s = forVisit ? ui.visit : ui.spot || (ui.spot = newSpot()), max = forVisit ? VISIT_PHOTOS : SPOT_MAX;
  for (const f of files) {
    if (s.media.length >= max) { toast(`At most ${max} photos${forVisit ? '' : ' or videos'}.`); break; }
    const k = mediaKind(f);
    if (k.refused) { toast(k.refused); continue; }
    if (forVisit && k.kind !== 'photo') { toast('Only photos for a visit.'); continue; }
    // 2.21.0: a live video is at most 60 seconds
    if (k.kind === 'video' && await videoSeconds(f) > VIDEO_SECONDS + 1) { toast(`The video is longer than ${VIDEO_SECONDS} seconds. Record a shorter one.`); continue; }
    try {
      let blob = k.kind === 'photo' ? await shrink(f) : f;
      // 2.7.1: a video too big (or of another type) is made smaller here instead of being refused
      if (k.shrink) {
        ui.spotWork = 'Making the video smaller… 0%. Keep this screen open.'; draw();
        blob = await shrinkVideo(f, VIDEO_AIM, p => { const t = `Making the video smaller… ${Math.round(p * 100)}%. Keep this screen open.`; if (t !== ui.spotWork) { ui.spotWork = t; draw(); } });
      }
      const id = uid();
      await putPhoto(id, blob);
      if (k.kind === 'photo') await photoUrl(id);
      s.media.push({ id, kind: k.kind, type: k.kind === 'photo' ? 'image/jpeg' : blob.type || f.type });
      if (k.shrink) toast(`Video ready: ${(blob.size / 1048576).toFixed(1)} MB.`);
    } catch (e) { toast(k.shrink ? e.message || String(e) : `Could not keep it on this phone (${e.message || e}).`); }
    finally { ui.spotWork = ''; }
  }
  draw();
};
spotCam.addEventListener('change', () => spotFiles([...(spotCam.files || [])]));
spotVid.addEventListener('change', () => spotFiles([...(spotVid.files || [])]));
/* 2.50.0 (owner, 5 Nov, R4): a live video from the report camera. Central Hub only, never the report; kept 30 days. */
const repVid = document.getElementById('repVid');
const videoSet = (id, patch) => store.set({ videos: (store.get().videos || []).map(v => (v.id === id ? { ...v, ...patch } : v)) });
// 2.76.0 (owner, 8 Nov): videos are recorded live only; the gallery button of 2.54.0 is gone
repVid.addEventListener('change', () => keepVideo(repVid.files?.[0], false));
/** 2.76.0 (owner, 8 Nov): the report camera inside the app, PHOTO and VIDEO; the phone's own camera when it cannot be shown. */
function liveCam(mode) {
  const p = project();
  openLiveCam({
    mode, title: p ? p.name || p.code : '', maxBytes: VIDEO_AIM,
    count: () => { const r = store.get().drafts?.[key()]; return (r?.photos || []).length + (store.get().videos || []).filter(v => v.proj === p?.code && v.date === realToday()).length; },
    onPhoto: f => { ui.camFor = 'photo'; addPhotos([f]); },
    onVideo: (f, secs) => keepVideo(f, false, secs),
    fallback: m => { if (m === 'photo') camera(); else { repVid.value = ''; repVid.click(); } },
  });
}
async function keepVideo(f, gal, secs = 0) {
  const p = project();
  if (!f || !p) return;
  const k = mediaKind(f);
  if (k.refused || k.kind !== 'video') { toast(k.refused || 'That is not a video.'); return; }
  if ((secs || await videoSeconds(f)) > VIDEO_SECONDS + 1) { toast(`The video is longer than ${VIDEO_SECONDS} seconds. Record a shorter one.`); return; }
  try {
    let blob = f;
    if (k.shrink) {
      ui.vidWork = 'Making the video smaller… 0%. Keep this screen open.'; draw();
      blob = await shrinkVideo(f, VIDEO_AIM, q => { const t = `Making the video smaller… ${Math.round(q * 100)}%. Keep this screen open.`; if (t !== ui.vidWork) { ui.vidWork = t; draw(); } });
    }
    const id = uid();
    await putPhoto(id, blob);
    store.set({ videos: videoAdd(store.get().videos, { id, proj: p.code, date: realToday(), time: now(), type: blob.type || f.type || 'video/mp4', sent: false, ...(gal ? { gal: true } : {}) }) });
    toast('Video kept. It goes to Central Hub only.');
  } catch (e) { toast(k.shrink ? e.message || String(e) : `Could not keep it on this phone (${e.message || e}).`); }
  finally { ui.vidWork = ''; draw(); }
  flushVideos();
}
let videoing = false;
async function flushVideos() {
  const waiting = videoWaiting(store.get().videos);
  if (videoing || !waiting.length || !store.get().auth || !navigator.onLine) return;
  videoing = true;
  try {
    for (const v of waiting.reverse()) {
      const blob = await getPhoto(v.id);
      if (!blob) { videoSet(v.id, { gone: true }); continue; }
      await call('repVideo', { proj: v.proj, id: v.id, date: v.date, time: v.time, type: v.type, ...(v.gal ? { gal: 1 } : {}), data: await toDataUrl(blob) });
      videoSet(v.id, { sent: true, sentAt: Date.now() });
      deletePhoto(v.id).catch(() => {});
      toast(`Video sent to Central Hub (${v.time}).`);
    }
  } catch (e) { if (e.code !== 'OFFLINE') toast(`Video not sent yet: ${e.message}`); }
  finally { videoing = false; draw(); }
}
spotGal.addEventListener('change', () => spotFiles([...(spotGal.files || [])]));
/** 2.49.0: a signature (PNG) as a JPEG on white, the only picture type Spotlight sends. */
const jpegOf = png => new Promise((ok, fail) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0); c.toBlob(ok, 'image/jpeg', 0.9); }; im.onerror = fail; im.src = png; });
const spotSet = (id, fn) => store.set({ spots: (store.get().spots || []).map(x => { if (x.id !== id) return x; const y = structuredClone(x); fn(y); return y; }) });
let spotting = false;
async function flushSpots() {
  const waiting = (store.get().spots || []).filter(x => !x.sent), outs = (store.get().spots || []).filter(x => x.sent && x.outPending);
  if (spotting || !(waiting.length || outs.length) || !store.get().auth || !navigator.onLine) return;
  spotting = true;
  try {
    for (const x of waiting.reverse()) {
      for (const [n, m] of x.media.entries()) {
        if (m.up) continue;
        const blob = await getPhoto(m.id);
        if (blob) await call('spotMedia', { proj: x.proj, id: x.id, n, type: m.type, data: await toDataUrl(blob) });
        spotSet(x.id, y => { y.media[n].up = true; });
      }
      await call('spotPut', { proj: x.proj, id: x.id, about: x.about, tone: x.tone, cat: x.cat, note: x.note, madeAt: `${x.date}T${x.time}`, ...(x.visit ? { visit: x.visit } : {}) });
      spotSet(x.id, y => { y.sent = true; y.sentAt = Date.now(); });
      x.media.forEach(m => deletePhoto(m.id).catch(() => {}));
      toast(x.visit ? `Visit sent: ${x.visit.name}.` : `Spotlight sent: ${x.cat} · ${x.about}.`);
    }
    // 2.49.0: the time a visitor left, after the visit was sent
    for (const x of outs) { await call('visitOut', { proj: x.proj, id: x.id, out: x.visit.tout }); spotSet(x.id, y => { y.outPending = false; }); }
  } catch (e) { if (e.code !== 'OFFLINE') toast(`Spotlight not sent yet: ${e.message}`); }
  finally { spotting = false; }
}

/** 2.5.0: the crew list being written for the office, kept on the phone per project. */
function clSync() {
  const p = project();
  if (!p || ui.clFor === p.code) return;
  const kept = (store.get().crewList || {})[p.code];
  ui.cl = kept ? structuredClone(kept) : { trades: Object.entries(p.tradeWages || {}).map(([trade, wage]) => ({ trade, wage: String(wage) })), people: [] };
  ui.clFor = p.code;
}
const saveCl = () => store.quiet({ crewList: { ...(store.get().crewList || {}), [ui.clFor]: ui.cl } });
window.__addPhoto = demo ? addPhoto : undefined;   // lets the demo check be driven without a camera

/** Choices a second tap does not clear. */
const KEEP = new Set(['unit', 'captionKind', 'name', 'category', 'priority', 'text', 'currency', 'cost']);

const ACTS = {
  go: d => go(d.to),
  quickEdit() { ui.quickEdit = !ui.quickEdit; draw(); },   // 2.11.0
  quickPin(d) { Q.quickToggle(d.v); draw(); },
  signin: () => signedIn(signIn(store.get().profile.name || '')),
  /** 2.4.0: the sign-up form: full name and phone go with the Google sign-in just made. */
  signUp() {
    const name = (root.querySelector('#sun') || {}).value || '', phone = (root.querySelector('#sup') || {}).value || '';
    if (!name.trim()) return toast('Write your full name first.');
    ui.signup = { ...(ui.signup || {}), asking: true };
    signedIn(signUp({ name: name.trim(), phone: phone.trim() }));
  },
  signupBack() { ui.signup = null; draw(); },
  /** 2.4.0: sign full screen (or choose a PNG); kept on this phone and in Drive. d.v === 'report' also signs today's report. */
  async sigFull(d) {
    const png = await openPad(d.v === 'report' ? 'Sign the report' : 'Your signature');
    if (!png) return;
    sigSaved(png);
    if (d.v === 'report' && report()) edit(r => { r.signed = new Date().toISOString(); });
    if (!demo) call('sigPut', { png }).catch(() => toast('Your signature is kept on this phone. It goes to the office with the next sign-in.'));
    draw();
  },
  saveProfile() {
    if (!store.get().profile.name.trim()) return toast('Write your name first.');
    if (!store.get().profile.sig) return toast('Sign first: press Sign.');
    store.set({ profile: { ...store.get().profile, done: true } });
    sendProfile();
    go('today');
  },
  pickProject: d => { store.set({ proj: d.v }); go('today'); loadSetup(); goLive(); },
  liveConnect: () => signedIn(signIn(store.get().profile.name || '')),
  // 2.80.0 (owner, 9 Nov): Reports by month: < > steps a month; an earlier month is read from Central Hub
  repMonth(d) {
    const cur = realToday().slice(0, 7);
    let m = FM.shiftMonth(ui.rMonth || cur, Number(d.v) || 0);
    if (m > cur) m = cur;
    ui.rMonth = m === cur ? '' : m;
    if (ui.rMonth) monthLoad(m); else draw();
  },
  liveRetry: () => { toast('Connecting to Central Hub…'); liveHeal(true); },   // 2.79.0
  // 2.71.0 (owner): the crew Edit opened Google's account page when the project was not linked; now it says why
  liveWhy: () => toast(liveWhyText(ui.live, ui.liveWhy)),   // 2.12.0: the Google sign-in again, for live updates
  // 2.8.0: switch the project and stay on the page (Reports); on Review, its reports load
  // 2.16.1: the GM's project list at the top: every page follows the project chosen
  projTop(d) {
    // 2.17.0: All projects (Reports, Requests, Review)
    if (d.v === '*') {
      ui.allProj = true; ui.rfAll = '';   // 2.75.0: starts on All
      if (route() === 'review') { ui.rv = { f: (ui.rv || {}).f }; ACTS.revLoad(); }
      if (route() === 'reports') for (const p of store.get().projects) teamDays(p);
      return draw();
    }
    const was = ui.allProj; ui.allProj = false;
    if (!d.v || d.v === store.get().proj) { if (was && route() === 'review') { ui.rv = { f: (ui.rv || {}).f }; ACTS.revLoad(); } return draw(); }
    store.set({ proj: d.v }); loadSetup(); goLive();
    ui.reg = null; ui.regEdit = null; ui.regAt = ''; ui.empUrl = '';
    if (route() === 'review') { ui.rv = { f: (ui.rv || {}).f }; ACTS.revLoad(); }
    draw();
  },
  /** 2.17.0: a report of All projects: its project opens, then the day. */
  openAll(d) { ui.allProj = false; if (d.p !== store.get().proj) { store.set({ proj: d.p }); loadSetup(); goLive(); } ACTS.openDay({ v: d.v }); },
  /** 2.17.0: a sent report off this device's list (Central Hub keeps it). */
  dayHide(d) {
    const p = project();
    const r = store.get().drafts[`${p.code}|${d.v}`];
    if (!p || !confirm(r && r.start && !r.sentAt ? `Remove the report of ${d.v} from this phone? It is not sent yet: it stays saved and comes back when opened from Today.` : `Remove the report of ${d.v} from this phone? Central Hub keeps it.`)) return;
    store.set({ hidden: { ...(store.get().hidden || {}), [`${p.code}|${d.v}`]: Date.now() } });
    ui.sheet = ''; toast('Removed from this phone.'); draw();
  },
  projPop: () => { ui.projPop = !ui.projPop; draw(); },
  projPopPick: d => { ui.projPop = false; ACTS.projHere(d); },   // 2.39.0
  projHere: d => { if (d.v !== store.get().proj) { store.set({ proj: d.v }); loadSetup(); } draw(); },
  revProj: d => { if (d.v !== store.get().proj) { store.set({ proj: d.v }); loadSetup(); } ui.rv = { f: (ui.rv || {}).f }; ACTS.revLoad(); },
  async refresh() {
    ui.refreshing = true; draw();   // 2.42.0: the button says Refreshing…
    try { await loadProjects(); toast('Lists updated from the office.'); } catch (e) { toast(e.message); } finally { ui.refreshing = false; draw(); }
  },
  async signout() {
    if (!confirm('Sign out? Reports not yet sent stay on this phone.')) return;
    await here.signOut(Date.now());   // 2.58.0: the end of this session in the sign-in history
    L.stop(); ui.live = '';
    store.set({ auth: null, rules: null }); go('');
  },
  startDay() { ensureReport(); go('start'); fetchWeather(); },
  /** 2.6.0: the reports of the open project, for a reviewer or viewer. */
  async revLoad() {
    const rv = ui.rv || (ui.rv = {});
    rv.busy = true; draw();
    try {
      // 2.17.0: the GM's All projects: every project's list
      if (ui.allProj && P.isGM({ s: store.get() })) rv.list = (await Promise.all(store.get().projects.map(p => call('list', { proj: p.code, days: 45 }).then(r => r.reports || []).catch(() => [])))).flat();
      else { const res = await call('list', { proj: project().code, days: 45 }); rv.list = res.reports || []; }
      // 2.7.0: opened from a notification: straight to that report
      const w = rv.want; rv.want = null;
      const hit = w && rv.list.find(x => x.date === w.d && String(Number(x.no)) === String(Number(w.no)));
      if (hit) { rv.busy = false; return ACTS.revOpen({ v: hit.name }); }
    }
    catch (e) { toast(e.code === 'OFFLINE' ? 'No connection. Try again when online.' : `Could not get the reports: ${e.message}`); }
    finally { rv.busy = false; draw(); }
  },
  revFilter(d) { (ui.rv ||= {}).f = d.v; draw(); },
  // 2.68.0 (owner): Remove in a report's details: off this phone's lists; Central Hub keeps it
  // 2.69.0 (owner): reports the database has not taken yet, sent again from the bar
  dbAgain() { dbResend(); },
  // 2.73.0 (owner, R4): Discuss
  // 2.74.1 (owner): a proper chat page
  chatOpen: d => { const u = ui.chat ||= {}; u.open = d.v || ''; u.pick = false; u.sel = ''; u.edit = ''; ui.chatScroll = -1; draw(); },
  chatPick: () => { const u = ui.chat ||= {}; u.pick = !u.pick; draw(); },
  chatSel: d => { const u = ui.chat ||= {}; u.sel = u.sel === d.v ? '' : d.v; draw(); },
  chatEditCancel: () => { const u = ui.chat ||= {}; u.edit = ''; ui.chatText = ''; draw(); },
  chatStart() {
    const e = String(ui.chatTo || '').trim().toLowerCase(), me = String((store.get().auth || {}).email || '').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) || e === me) return toast('Type the email of the person (their Central Hub or Field Report sign-in).');
    ui.chatTo = ''; ACTS.chatOpen({ v: `dm:${e}` });
  },
  async chatSend() {
    const text = String(ui.chatText || '').trim(), u = ui.chat ||= {};
    if (!text || u.busy) return;
    if (ui.live !== 'on') return toast(liveWhyText(ui.live, ui.liveWhy));
    if (u.edit) {   // 2.74.1: the writing box holds the edit
      const m = chatFind(u.edit), me = String((store.get().auth || {}).email || '').toLowerCase();
      u.edit = ''; u.sel = '';
      if (!m || !mayEdit(m, me)) { draw(); return toast('Too late to edit: a message can be edited only in the first minute.'); }
      if (text !== m.text) try { await L.chatEdit(m.members ? 'direct' : 'messages', m.id, { text: text.slice(0, 2000), edited: true }); } catch { toast('Too late to edit: delete it and write it again.'); }
      ui.chatText = ''; draw(); return;
    }
    u.busy = true; draw();
    try {
      const auth = store.get().auth || {};
      const ok = await L.chatSend(({ email, pid }) => messageOf({ text, me: email, name: myName() || auth.name || email, title: auth.role === 'exec' ? 'GM' : '', open: u.open || '', pid }));
      if (ok) { ui.chatText = ''; ui.chatScroll = -1; } else toast('Not sent: sign in to Central Hub again (Me).');
    } catch (e) { toast(`Not sent: ${String(e && (e.code || e.message) || e).slice(0, 80)}`); }
    u.busy = false; draw();
  },
  async chatFix(d) {
    const m = chatFind(d.v), me = String((store.get().auth || {}).email || '').toLowerCase();
    if (!m || !mayEdit(m, me)) return toast('A message can be edited only in the first minute.');
    const u = ui.chat ||= {}; u.edit = m.id; u.sel = ''; ui.chatText = m.text; draw();   // 2.74.1: edited in the writing box
    const t = root.querySelector('[data-ui="chatText"]'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  },
  async chatDel(d) {
    const m = chatFind(d.v);
    if (!m) return;
    const all = takeBackOk(m);   // 2.73.1 (owner): for everyone in the first 5 minutes, then only from my view
    if (!confirm(all ? 'Delete this message for everyone?' : 'Delete this message from your view? After 5 minutes the others still see it.')) return;
    (ui.chat ||= {}).sel = '';
    try { await L.chatEdit(m.members ? 'direct' : 'messages', m.id, all ? { text: '', deleted: true, deletedAt: new Date().toISOString() } : { hiddenFor: [String((store.get().auth || {}).email || '').toLowerCase()] }); } catch (e) { toast(`Not deleted: ${String(e && (e.code || e.message) || e).slice(0, 80)}`); }
  },
  revHide() {
    const rv = ui.rv || {}, x = rv.open, p = project();
    if (!x || !p || !confirm(`Remove report No. ${x.no} of ${x.date} from this phone? Central Hub keeps it.`)) return;
    store.set({ hidden: { ...(store.get().hidden || {}), [`${p.code}|${x.date}`]: Date.now() } });
    rv.list = (rv.list || []).filter(y => y.name !== x.name); rv.open = null;
    toast('Removed from this phone.'); go('reports');
  },
  async revOpen(d) {
    const rv = ui.rv || (ui.rv = {});
    rv.open = (rv.list || []).find(x => x.name === d.v) || null; ui.revText = '';
    go('rev');
    try { const res = await call('status', { name: d.v }); if (res.found && rv.open && rv.open.name === d.v) { rv.open = { ...rv.open, ...res.report }; draw(); } } catch { /* the list's line is enough */ }
  },
  /** Approve, send back, reopen or comment: it goes to the person who sent the report, and Central Hub sees it. */
  async revDo(d) {
    const rv = ui.rv || {}, x = rv.open, text = String(ui.revText || '').trim();
    if (!x) return;
    if ((d.v === 'changes' || d.v === 'comment') && !text) return toast('Write what to change first.');
    if (d.v === 'approve' && !confirm(`Approve report No. ${x.no} of ${x.date}? It is signed with your signature and locked.`)) return;
    rv.busy = true; draw();
    try {
      const res = await call('review', { name: x.name, decision: d.v, text });
      L.now('reports', { proj: (project() || {}).code });   // 2.13.0
      const upd = res.report || {};
      rv.open = { ...x, ...upd };
      rv.list = (rv.list || []).map(y => (y.name === x.name ? { ...y, ...upd } : y));
      ui.revText = '';
      toast({ approve: 'Approved.', changes: 'Sent back.', reopen: 'Reopened for the site.', comment: 'Comment sent.' }[d.v] + ` ${x.preparedBy || x.uploadedBy || 'The sender'} is told.`);
    } catch (e) { toast(e.code === 'OFFLINE' ? 'No connection. Nothing was sent.' : `Not sent: ${e.message}`); }
    finally { rv.busy = false; draw(); }
  },
  /** 2.7.0: a reviewer sets the project's working hours (script hoursPut). */
  hrDay(d) { const p = project(), h = ui.hr || (ui.hr = { off: [...(p.nwDow || [0])] }), n = Number(d.v), i = h.off.indexOf(n); if (i > -1) h.off.splice(i, 1); else h.off.push(n); draw(); },
  async hoursSend() {
    const p = project(), h = ui.hr || {}, start = ui.hrStart || p.defStart || '08:00', end = ui.hrEnd || p.defEnd || '17:00', remind = ui.hrRemind || p.remindAt || end;
    const off = h.off || p.nwDow || [0];
    if (end <= start) return toast('The end must be after the start.');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (!confirm(`Set the working hours of ${p.name}?\n\nStart ${start} (late attendance until ${crewCloses(start)})\nEnd ${end}\nReminder ${remind}\nDays off: ${off.length ? off.slice().sort().map(n => days[n]).join(', ') : 'none'}`)) return;
    ui.busy = true; draw();
    try {
      await call('hoursPut', { proj: p.code, defStart: start, defEnd: end, remindAt: remind, nwDow: off });
      store.set({ projects: store.get().projects.map(x => (x.code === p.code ? { ...x, defStart: start, defEnd: end, remindAt: remind, nwDow: off.slice() } : x)) });
      ui.hr = null; ui.hrStart = ui.hrEnd = ui.hrRemind = '';
      toast('Working hours saved. The site sees them on its next check.');
    } catch (e) { toast(e.code === 'OFFLINE' ? 'No connection. Nothing was saved.' : `Not saved: ${e.message}`); }
    finally { ui.busy = false; draw(); }
  },
  attOpen() { if (ui.date) return toast('Attention is added on the day itself.'); ensureReport(); go('attention'); },
  attAdd() {
    const text = String(ui.attText || '').trim();
    if (!text) return toast('Write the issue first.');
    edit(r => { (r.attention ||= []).push({ id: uid(), text: text.slice(0, 400), at: now() }); });
    ui.attText = '';
    toast('Added. It goes in the red box of today\'s report.');
  },
  attDrop(d) { if (confirm('Remove this Attention item from the report?')) edit(r => { r.attention = (r.attention || []).filter(x => x.id !== d.v); }); },
  /** 2.7.0: the site answers the office's comment; it goes to the person who wrote it. */
  /** 2.42.0: a reviewer comments on or sends back a report from the Reports list (the same answer as in Review). */
  dayRev(d) {
    const x = monthDays(realToday(), project(), store.get().drafts, store.get().known, (store.get().others || {})[project().code]).find(y => y.name === d.n);
    if (!x) return;
    (ui.rv ||= {}).open = { name: x.name, no: x.no, date: x.date, preparedBy: x.by || '' };
    ui.revText = ui.replyText || '';
    return ACTS.revDo({ v: d.v }).then(() => { if (!ui.revText) { ui.replyText = ''; ui.sheet = ''; draw(); } });
  },
  async replySend(d) {
    const text = String(ui.replyText || '').trim();
    if (!text) return toast('Write the reply first.');
    ui.busy = true; draw();
    try {
      const res = await call('review', { name: d.v, decision: 'reply', text });
      L.now('reports', { proj: (project() || {}).code });   // 2.13.0
      const k = store.get().known[d.v] || {};
      store.set({ known: { ...store.get().known, [d.v]: { ...k, comments: (res.report && res.report.comments) || [...(k.comments || []), { by: store.get().profile.name, at: new Date().toISOString(), kind: 'reply', text }] } } });
      ui.replyText = ''; ui.sheet = '';
      toast('Reply sent. The office is told.');
    } catch (e) { toast(e.code === 'OFFLINE' ? 'No connection. Nothing was sent.' : `Not sent: ${e.message}`); }
    finally { ui.busy = false; draw(); }
  },
  inboxRead(d) { if (d.t) store.set({ inboxRead: [...new Set([...(store.get().inboxRead || []), d.t])].slice(-200) }); draw(); },   // 2.39.0
  inboxGo(d) { ui.inboxOpen = false; if (d.t) ACTS.inboxRead(d); if (location.hash === d.v) openLink(d.v.slice(1)); else location.hash = d.v; },   // 2.53.0: the list closes, so the page opened is seen   // 2.8.1: the same link twice opens again
  // 2.54.0 (owner): the GM's Dashboard: the week's photos and videos from site
  mediaOpen() { if (!P.mayDash({ s: store.get() })) return; ui.mDay = ''; ui.mBig = ''; go('media'); mediaLoad(); },
  mediaDay(d) { ui.mDay = d.v; ui.mBig = ''; draw(); mediaLoad(); },
  mediaBig(d) {
    ui.mBig = d.v ? (ui.mUrl || {})[d.v] || '' : ''; draw();
    // 2.78.0: the tile shows at once, the sharp screen copy replaces it when it arrives
    const ph = d.v && Object.values(ui.mPhotos || {}).flat().find(x => x.id === d.v);
    if (ph) drivePhoto(ph.report, ph.id).then(b => { if (b && ui.mBig === ui.mUrl[ph.id]) { ui.mBig = URL.createObjectURL(b); draw(); } });
  },
  spotOpen() { if (!ui.spot) { ui.spot = newSpot(); ui.spotAbout = ''; ui.spotNote = ''; } go('spot'); },
  spotTone(d) { ui.spot.tone = d.v; draw(); },
  // 2.49.0 (owner, R3): Visitors
  spotTab(d) { ui.spotTab = d.v; draw(); },
  visitNew() { ui.visit = newVisit(); Object.assign(ui, { vName: '', vOrg: '', vIn: now(), vOut: '', vPurpose: PURPOSES[0], vResult: '', vSummary: '' }); draw(); },
  visType(d) { ui.visit.type = d.v; draw(); },
  visitCam() { ui.camFor = 'visit'; spotIn(spotCam); },
  visitDrop(d) { const [m] = ui.visit.media.splice(Number(d.v), 1); if (m) deletePhoto(m.id).catch(() => {}); draw(); },
  async visitSign() {
    const png = await openPad('Visitor signature');
    if (!png || !ui.visit) return;
    const blob = await jpegOf(png), id = uid();
    await putPhoto(id, blob); await photoUrl(id);
    if (ui.visit.signId) deletePhoto(ui.visit.signId).catch(() => {});
    ui.visit.signId = id; draw();
  },
  visitCancel() { (ui.visit?.media || []).forEach(m => deletePhoto(m.id).catch(() => {})); if (ui.visit?.signId) deletePhoto(ui.visit.signId).catch(() => {}); ui.visit = null; draw(); },
  visitSave() {
    const t = k => String(ui[k] || '').trim();
    const v = { ...ui.visit, name: t('vName'), org: t('vOrg'), tin: ui.vIn || '', tout: ui.vOut || '', purpose: ui.vPurpose || PURPOSES[0], result: t('vResult'), summary: t('vSummary') }, why = visitMissing(v);
    if (why) return toast(why);
    const keep = visitRecord(v, { id: uid(), proj: project().code, date: realToday(), time: now() });
    const old = store.get().spots || [];
    store.set({ spots: [keep, ...old.filter(x => !x.sent), ...old.filter(x => x.sent).slice(0, 40)] });
    ui.visit = null;
    toast(navigator.onLine ? 'Sending the visit to Central Hub…' : 'Kept on this phone. It goes when there is a connection.');
    flushSpots();
  },
  visitLeft(d) {
    spotSet(d.v, y => { y.visit.tout = now(); if (y.sent) y.outPending = true; });
    toast('Leaving time kept.'); flushSpots(); draw();
  },
  spotCat(d) { ui.spot.cat = d.v; draw(); },
  spotCam() { ui.camFor = ''; spotIn(spotCam); },
  spotVid() { spotIn(spotVid); },
  spotGal() { spotIn(spotGal); },

  spotDrop(d) { const [m] = ui.spot.media.splice(Number(d.v), 1); if (m) deletePhoto(m.id).catch(() => {}); draw(); },
  spotSave() {
    const list = aboutList(project().staff, (store.get().profile || {}).position);
    const s = { ...ui.spot, about: list.includes(ui.spotAbout) ? ui.spotAbout : list[0], note: String(ui.spotNote || '').trim() }, why = spotMissing(s);
    if (why) return toast(why);
    const p = project(), keep = { id: uid(), proj: p.code, date: realToday(), time: now(), about: s.about, tone: s.tone, cat: s.cat, note: s.note, media: s.media, sent: false };
    const old = store.get().spots || [];
    store.set({ spots: [keep, ...old.filter(x => !x.sent), ...old.filter(x => x.sent).slice(0, 20)] });
    ui.spot = newSpot(); ui.spotAbout = ''; ui.spotNote = '';
    toast(navigator.onLine ? 'Sending to Central Hub…' : 'Kept on this phone. It goes when there is a connection.');
    flushSpots();
  },
  crewPick(d, el) { const rv = ui.rv || (ui.rv = {}); (rv.picks ||= {})[d.v] = !!el.checked; },
  /** A reviewer gives the wages and approves the ticked people (script crewOk). */
  async crewOkSend() {
    const p = project(), rv = ui.rv || {}, wait = p.crewWait || [];
    const typed = Object.fromEntries(wait.map(x => [x.id, num(ui[`cw_${x.id}`])]));
    const wages = crewWages(wait, rv.picks || {}, typed);
    const ticked = wait.filter(x => (rv.picks || {})[x.id]);
    if (!ticked.length) return toast('Tick the people to approve.');
    const noWage = ticked.find(x => !wages[x.id]);
    if (noWage) return toast(`Give the daily wage of ${noWage.name}.`);
    if (!confirm(`Approve ${ticked.length} ${ticked.length === 1 ? 'person' : 'people'} for ${p.name}?\n\n${ticked.map(x => `${x.name} · ${x.trade || ''} · ${wages[x.id]}`).join('\n')}`)) return;
    ui.busy = true; draw();
    try {
      const res = await call('crewOk', { proj: p.code, wages });
      store.set({ projects: store.get().projects.map(x => (x.code === p.code ? { ...x, crewWait: res.crewWait || [], tradeWages: res.tradeWages || x.tradeWages } : x)) });
      rv.picks = {};
      L.now('crew', { proj: p.code });   // 2.72.0 (owner, R3): Central Hub adds them at once, not when the Admin next opens Field users
      toast(`Approved ${res.approved || 0}. Central Hub adds them to the crew.`);
    } catch (e) { toast(e.code === 'OFFLINE' ? 'No connection. Try again when online.' : `Not approved: ${e.message}`); }
    finally { ui.busy = false; draw(); }
  },
  // 2.16.0: the Office page tabs: Today, Crew attendance, Employee data
  attTab(d) {
    ui.attTab = d.v; ui.regEdit = null;
    if (d.v === 'crew') crewInfo();   // 2.45.0: the employee data of the crew, read from Central Hub
    try { localStorage.setItem('fr2_attTab', d.v); } catch { /* private mode */ }   // 2.44.0: reopens on the last tab
    // 2.43.1 (owner): Candidate never asks to connect: the Central Hub sign-in starts by itself (once per visit) and comes back here
    if (d.v === 'emp' && !demo && ui.live !== 'on' && L.LIVE.has(ui.liveRoute) && !sessionStorage.getItem(AFTER)) {
      try { sessionStorage.setItem(AFTER, 'emp'); } catch { /* the Connect button stays */ }
      const a = store.get().auth || {};
      return signedIn(signIn(store.get().profile.name || '', a.email || ''));
    }
    if (d.v === 'sheet' && (!ui.reg || ui.reg.code !== (project() || {}).code)) regLoad();
    draw();
  },
  regLoad() { regLoad(); },
  regShift(d) { if (!ui.reg || !ENG || !regProj) return; ui.regAt = ENG.shiftPeriod(regProj, ui.reg.period, +d.n).from; ui.regEdit = null; regLoad(); },
  regPick(d) { const same = ui.regEdit && ui.regEdit.d === d.d && ui.regEdit.k === d.k; ui.regEdit = same ? null : { d: d.d, k: d.k }; ui.regOt = ''; draw(); },
  async regSend(d) {
    const ed = ui.regEdit, r = ui.reg;
    if (!ed || !r || !ENG) return;
    const row = r.groups.flatMap(g => g.rows).find(x => x.key === ed.k);
    if (!row) return;
    const state = d.v, ot = state === 'present' ? Math.max(0, Math.min(16, num(ui.regOt) || 0)) : 0;
    const rec = { id: fixKey(ed.d, ed.k), date: ed.d, key: ed.k, personId: row.id || '', name: row.name, state, ot, was: ENG.markOn(regWs, ed.d, ed.k) || null,
      by: `Site: ${myName() || 'Field Report'}`, at: new Date().toISOString(), site: true, review: 'waiting', undone: false };
    if (demo) { regWs.attendance = [...regWs.attendance.filter(f => f.id !== rec.id), rec]; ui.regEdit = null; regBuild(); toast('Demo: kept on this device only.'); return draw(); }
    try { await L.siteFix(rec); ui.regEdit = null; toast(`Sent to the office: ${row.name}, ${ed.d}. It counts once they accept it.`); }
    catch (e) { toast(`Not sent: ${e.message}`); }
    draw();
  },
  async empOpen() {
    const p = project();
    if (!p) return;
    if (demo) { ui.empUrl = 'https://hub.amistadprefab.com/crew.html?l=demo'; return draw(); }
    const k = `fr2.siteLink.${p.code}`;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(k) || 'null'); } catch { s = null; }
    if (!s || !s.url || s.until < Date.now() + 30 * 60e3) {
      ui.busy = true; draw();
      try { s = await L.siteLink({ projectName: p.name || p.code, byName: myName() }); try { localStorage.setItem(k, JSON.stringify(s)); } catch { /* private mode */ } }
      catch (e) { toast(`The form did not open: ${e.message}`); return; }
      finally { ui.busy = false; draw(); }
    }
    ui.empUrl = s.url; draw();
  },
  startCrew() { ensureReport(); go('att'); },
  /** 2.10.0: the crew allocated in Central Hub, asked again (a report not sent yet takes in the changes). */
  // 2.45.0 (owner): Edit opens the person's employee data from Central Hub (name, trade, phone, ID, pictures); Save writes it there
  async cdOpen(d) {
    const p = project(), x = (p.staff || []).find(s => s.id === d.v);
    if (!x) return;
    if (ui.cd && ui.cd.id === d.v) { ui.cd = null; return draw(); }
    // 2.45.1 (owner: Edit did not open the employee data): the phone's crew list has no directory link (personId),
    // so Central Hub is always asked; only when it has no record of the person does the short edit open
    ui.cd = { id: d.v, busy: true, f: {} }; draw();
    const r = await L.now('crewPerson', { proj: p.code, id: d.v }).catch(e => ({ refused: e.message }));
    if (r && r.person) ui.cd = { id: d.v, f: { ...r.person }, was: { ...r.person }, missing: r.missing };
    else { ui.cd = null; if (r && r.refused && !/not on this project/.test(r.refused)) toast(r.refused); return ACTS.crewEdit(d); }
    draw();
  },
  cdClose() { ui.cd = null; draw(); },
  cdPic(d) { const i = document.getElementById('cdPic'); i.dataset.k = d.k; if (d.g) i.removeAttribute('capture'); else i.setAttribute('capture', d.k === 'photo' ? 'user' : 'environment'); i.value = ''; i.click(); },
  async cdSave() {
    const p = project(), cd = ui.cd;
    if (!cd || cd.busy) return;
    const fields = Object.fromEntries(Object.entries(cd.f).filter(([k, v]) => v !== (cd.was || {})[k]));
    if (!Object.keys(fields).length) { ui.cd = null; return draw(); }
    cd.busy = true; draw();
    try {
      const r = await L.now('crewSave', { proj: p.code, id: cd.id, fields });
      ui.crewInfo = { ...(ui.crewInfo || {}), info: { ...((ui.crewInfo || {}).info || {}), [cd.id]: { missing: r.missing || [] } } };
      ui.cd = null; toast('Saved. Central Hub has it.'); attRefreshSoon();
    } catch (e) { cd.busy = false; toast(`Not saved: ${e.message}`); }
    draw();
  },
  async attRefresh(quiet) {
    if (ui.attBusy) return;
    if (demo) { ui.attAt = now(); return quiet ? draw() : toast('Demo: the list is the sample crew.'); }
    ui.attBusy = true; draw();
    try { await loadProjects(); ui.attAt = now(); if (!quiet) toast('The crew list is up to date.'); }
    catch (e) { if (!quiet) toast(e.code === 'OFFLINE' ? 'No connection: the list is the one last received.' : e.message); }
    finally { ui.attBusy = false; draw(); }
  },
  pick(d) {
    if (d.f.startsWith('ui.')) { ui[d.f.slice(3)] = d.v; return draw(); }
    if (isDraft(d.f)) {
      const [k0, k] = d.f.split('.'), cur = ui[k0][k];
      setDraft(d.f, cur === d.v && !KEEP.has(k) ? '' : d.v);   // a second tap clears a choice
      if (d.f === 'req.category') ui.req.unit = d.v === 'Manpower' ? 'people' : ui.req.unit === 'people' ? 'pcs' : ui.req.unit;
      if (d.f === 'delay.cause' && ui.delay.cause === 'Weather' && !ui.delay.party) ui.delay.party = 'Weather';
      return draw();
    }
    edit(r => setPath(r, d.f, d.v));
  },
  ppe(d) { edit(r => { const l = r.start.ppe || (r.start.ppe = []); const i = l.indexOf(d.v); if (i > -1) l.splice(i, 1); else l.push(d.v); }); },
  startDone() {
    edit(r => { r.start.done = true; });
    store.set({ lastNo: { ...store.get().lastNo, [store.get().proj]: report().no } });
    go(report().crew.done ? 'today' : 'crew');
  },
  mark: d => { edit(r => { const x = r.crew.rows[d.i]; x.state = d.v; x.markAt = Date.now(); if (d.v !== 'present') x.ot = 0; }); ui.ot = null; shareRows([report().crew.rows[d.i]]); },
  otOpen: d => { ui.ot = ui.ot === Number(d.i) ? null : Number(d.i); draw(); },
  ot: (d, el) => { const i = Number(el.closest('[data-i]').dataset.i); edit(r => { const x = r.crew.rows[i]; x.ot = Math.max(0, Math.min(12, (Number(x.ot) || 0) + Number(d.d) * 0.5)); x.markAt = Date.now(); }); shareRows([report().crew.rows[i]]); },
  // 2.33.0: the reporter confirms today's attendance is correct
  crewConfirm: () => {
    if (ui.date || !L.liveOn()) { toast('Confirm the attendance when you are online, on today.'); return; }
    shareRows(report().crew.rows);
    L.confirmDay(realToday(), (store.get().profile || {}).name || '').then(() => toast('Attendance confirmed. Central Hub shows it.')).catch(() => toast('Not sent. Check the connection and try again.'));
  },
  allPresent: () => { edit(r => { const away = r.crew.rows.some(x => x.state !== 'present'); if (away) { const t = Date.now(); r.crew.rows.forEach(x => { x.state = 'present'; x.markAt = t; }); } }); shareRows(report().crew.rows); },
  filter: d => { ui.filter = d.v; draw(); },
  addExtra: () => edit(r => { r.crew.extra.push({ trade: '', qty: 1 }); }),
  crewPhoto() {
    if (ui.date) return toast('The crew photo is taken on the day itself.');
    if (crewClock() > crewCloses(crewStart())) return toast(`Crew photos close at ${crewCloses(crewStart())}. Tell the Project Engineer.`);
    ensureReport(); ui.camFor = 'crew'; camera();
  },
  clTrade() { ui.cl.trades.push({ trade: '', wage: '' }); saveCl(); draw(); },
  clPerson() { ui.cl.people.push({ name: '', trade: (ui.cl.trades[0] || {}).trade || '', wage: '' }); saveCl(); draw(); },
  clDel(d) { ui.cl[d.k].splice(Number(d.i), 1); saveCl(); draw(); },
  // 2.13.0: crew the site added: corrected or taken off here, in Central Hub at once
  // 2.36.0: every crew member, by the project's SE, PE or GM; Central Hub copies it to the Manpower Directory
  crewEdit: d => { ui.crewEdit = ui.crewEdit === d.v ? '' : d.v; ui.ceName = undefined; ui.ceTrade = undefined; ui.cePhone = undefined; draw(); },
  async crewSave(d) {
    const x = (project().staff || []).find(s => s.id === d.v) || {};
    const name = String(ui.ceName ?? x.name ?? '').trim(), role = String(ui.ceTrade ?? x.trade ?? '').trim(), phone = String(ui.cePhone ?? '').trim();
    if (!name) return toast('Write the name.');
    try { await L.editTeam(d.v, { name, ...(role ? { role } : {}), ...(phone ? { contact: phone } : {}), crewSync: true }); ui.crewEdit = ''; toast('Corrected. Central Hub has it.'); }
    catch (e) { toast(`Not changed: ${e.message}`); }
    draw();
  },
  // 2.17.0: delete from the crew list: the site asks, the PE or the GM confirms (the server takes them off in Central Hub too)
  async crewOff(d) {
    // 2.41.0 (owner, 3 Nov): the Project engineer and the GM delete at once (with who and when); the Site engineer and anyone else ask them
    const boss = kind() === 'reviewer' || P.isGM({ s: store.get() });
    if (boss) return ACTS.crewDropOk(d);
    if (!confirm(`Ask the Project engineer or the GM to delete ${d.n} from this project?`)) return;
    try { await L.editTeam(d.v, { dropAsk: { by: String((store.get().auth || {}).email || '').toLowerCase(), byName: myName(), at: new Date().toISOString() } }); toast(`Asked. ${d.n} stays until the Project engineer or the GM confirms.`); }
    catch (e) { toast(`Not asked: ${e.message}`); }
  },
  async crewDropOk(d) {
    const p = project();
    if (!p || !confirm(`Delete ${d.n} from ${p.name}? They leave the crew list here and in Central Hub; their record stays, with who deleted them and when.`)) return;
    ui.busy = true; draw();
    try { await L.now('crewOff', { proj: p.code, id: d.v, byName: myName() }); toast(`${d.n} is deleted from this project.`); }
    catch (e) { toast(`Not deleted: ${e.message}`); }
    finally { ui.busy = false; draw(); }
  },
  async crewDropNo(d) { try { await L.editTeam(d.v, { dropAsk: null }); toast('Kept on the list.'); } catch (e) { toast(`Not changed: ${e.message}`); } },
  // 2.13.0: one of the waiting list taken back (Remove), or taken back into the form to correct and send again (Edit)
  async waitDrop(d) {
    const p = project(), x = (p.crewWait || []).find(y => y.id === d.v);
    if (!x || (d.e !== '1' && !confirm(`Take ${x.name} off the waiting list?`))) return;
    ui.busy = true; draw();
    try {
      await L.now('crewDrop', { proj: p.code, id: x.id });
      if (d.e === '1') { ui.cl.people.push({ name: x.name, trade: x.trade || '', wage: x.wage || '' }); saveCl(); }
      store.set({ projects: store.get().projects.map(y => (y.code === p.code ? { ...y, crewWait: (y.crewWait || []).filter(z => z.id !== x.id) } : y)) });
      toast(d.e === '1' ? 'Correct it below and send it again.' : `${x.name} is off the waiting list.`);
    } catch (e) { toast(`Not changed: ${e.message}`); }
    finally { ui.busy = false; draw(); }
  },
  // 2.13.0: the crew form link made here, so nobody needs Central Hub for it
  async crewLink() {
    const p = project();
    ui.busy = true; draw();
    try {
      const url = await L.crewLink({ projectName: p.name || p.code, byName: (store.get().profile || {}).name || '' });
      if (navigator.share) await navigator.share({ title: `Crew form · ${p.name || p.code}`, text: 'Fill in your details for the site (open 3 days):', url }).catch(() => {});
      else { await navigator.clipboard.writeText(url).catch(() => {}); toast('Link copied. Paste it in the chat with the crew. It is open 3 days.'); }
    } catch (e) { toast(`No link: ${e.message}`); }
    finally { ui.busy = false; draw(); }
  },
  async clSend() {
    const p = project(), cl = ui.cl;
    const people = cl.people.filter(x => String(x.name).trim());
    if (!people.length) return toast('Write at least one name.');
    if (people.some(x => !x.trade)) return toast('Choose the trade of each person.');
    // 2.6.0: the site sends names and trades; the wages are given by the reviewer
    const paid = kind() === 'reviewer';
    const trades = paid ? Object.fromEntries(cl.trades.filter(t => String(t.trade).trim() && num(t.wage) > 0).map(t => [t.trade.trim(), num(t.wage)])) : {};
    ui.busy = true; draw();
    try {
      const res = await call('crewPropose', { proj: p.code, trades, people: people.map(x => ({ name: x.name.trim(), trade: x.trade, ...(paid ? { wage: num(x.wage) > 0 ? num(x.wage) : trades[x.trade] } : {}) })) });
      store.set({ projects: store.get().projects.map(x => (x.code === p.code ? { ...x, crewWait: res.crewWait || [], tradeWages: res.tradeWages || {} } : x)) });
      cl.people = []; saveCl();
      L.now('crew', { proj: p.code });   // 2.13.0: Central Hub's list shows them at once
      toast(res.added ? `Sent ${res.added} to the office for approval.` : 'They were already sent; the office has them.');
    } catch (e) { toast(e.code === 'OFFLINE' ? 'No connection. The list stays here: send it again later.' : `Not sent: ${e.message}`); }
    finally { ui.busy = false; draw(); }
  },
  extra: (d, el) => { const i = Number(el.closest('[data-i]').dataset.i); edit(r => { const x = r.crew.extra[i]; x.qty = Math.max(0, x.qty + Number(d.d)); if (!x.qty && !x.trade) r.crew.extra.splice(i, 1); }); },
  async crewDone() {
    const open = (report().crew.rows || []).filter(x => !x.state).length;   // 2.13.1
    if (open && !confirm(`${open} ${open === 1 ? 'person is' : 'people are'} not marked. They are not sent. Done anyway?`)) return;
    edit(r => { r.crew.done = true; r.crew.extra = r.crew.extra.filter(x => x.qty > 0); });
    const p = project(), r = report(), rows = attendanceRows(r.crew);
    go('today');
    if (!rows.length) return;
    try {
      const how = await sendOrQueue('attendance', { proj: p.code, cc: codesOf(p).cc, date: r.date, by: store.get().profile.name, rows });
      toast(how === 'sent' ? 'Attendance sent to the office.' : 'Attendance saved. It goes to the office when there is a connection.');
    } catch (e) { toast(`Attendance not sent: ${e.message}`); }
  },
  noWork: () => { ui.sheet = 'nowork'; ui.sheetNew = true; ui.nwReason = ''; ui.nwNote = ''; draw(); },
  fab: () => go('quick'),   // 2.39.0: Log now is in Quick
  later: () => toast('This part comes in the next build.'),

  /* slice 5: reports, corrections, drafts, preferences */
  openDay: d => { ui.daySel = d.v; ui.sheet = 'day'; ui.sheetNew = true; draw(); },
  openPast(d) {
    ui.sheet = '';
    ui.date = d.v === realToday() ? '' : d.v;
    if (ui.date && !report()) ensureReport();
    go('today'); draw();
  },
  backToToday() { ui.date = ''; go('today'); draw(); },
  viewReport(d) {
    ui.viewKey = d.v ? draftKey(store.get().proj, d.v) : key();
    ui.viewBack = d.back || route();
    ui.sheet = ''; go('view');
  },
  devices: () => devCheck(true),
  async devDecide(d) {
    if (d.v === 'deny' && !confirm(`Deny this device of ${d.email}? It is signed out at its next connection.`)) return;
    try {
      const r = await call('devDecide', { email: d.email, device: d.dev, decision: d.v });
      ui.devs = r.devices || []; ui.refused = r.refused || ui.refused; toast(d.v === 'approve' ? 'Approved. That person can sign in on that device now.' : 'Denied. That device is signed out at its next connection.');
    } catch (e) { toast(e.message); }
  },
  async dayPdf(d) {
    if (!adminRole()) return pdfRefused();
    const r = store.get().drafts[draftKey(store.get().proj, d.v)];
    try {
      await makePdf(r, project());
      const f = ui.pdf, file = new File([f.blob], f.name, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: f.name }); logAct({ action: 'share', channel: 'Share sheet', doc: f.name }); }
      else { const a = document.createElement('a'); a.href = f.url; a.download = f.name; a.click(); logAct({ action: 'download', channel: 'PDF', doc: f.name }); }   // 2.59.0
    } catch (e) { if (e.name !== 'AbortError') toast(`Not shared: ${e.message}`); }
  },
  checkStatus: () => checkStatus(true),
  seenNew() { ui.sheet = ''; store.set({ seenNew: APP_VERSION }); },
  showNew() { ui.sheet = 'new'; ui.sheetNew = true; draw(); },
  loadRemote() { useRemote(ui.remote); ui.sheet = ''; ui.remote = null; toast('Draft from your other phone loaded.'); },
  // 2.57.0 (R3): penalties
  penOpen() { Object.assign(ui, { penOpen: true, penWho: '', penReason: '', penAmt: '', penDate: realToday() }); draw(); },
  penClose() { ui.penOpen = false; draw(); },
  penReason(d) { ui.penReason = d.v; draw(); },
  async penSave() {
    const p = project(), staff = p.staff || [];
    const f = { personId: ui.penWho, reason: ui.penReason, amount: ui.penAmt, date: ui.penDate || realToday() };
    const why = penaltyProblem(f, staff);
    if (why) return toast(why);
    if (!L.liveOn()) return toast('No connection to Central Hub. Try again when online.');
    ui.busy = true; draw();
    try {
      await L.savePenalty(o => penaltyRecord(f, { staff, byName: (store.get().profile || {}).name || '', ...o }));
      ui.penOpen = false; toast('Penalty sent for approval.');
    } catch (e) { toast(`Not saved: ${e.message}`); }
    ui.busy = false; draw();
  },
  async penDecide(d) {
    const x = (ui.pens || []).find(p => p.id === d.id);
    if (!x) return;
    const word = { approved: 'Approve', rejected: 'Reject', cancelled: 'Cancel' }[d.v];
    if (!confirm(`${word} the penalty of ${x.name}, ${x.amount} ETB?`)) return;
    ui.busy = true; draw();
    try { await L.penaltyStatus(x.id, d.v, (store.get().profile || {}).name || ''); toast('Done.'); }
    catch (e) { toast(`Not saved: ${e.message}`); }
    ui.busy = false; draw();
  },
  // 2.66.0 (owner): a technician's work photos; the SE / PE approves or rejects with a reason
  shTake() { const i = document.getElementById('shCam'); i.value = ''; i.click(); },
  shDel(d) { if (ui.sh && ui.sh.photos) { ui.sh.photos.splice(Number(d.v), 1); draw(); } },
  async shSave() {
    const p = project(), f = ui.sh || {}, tasks = ((p && p.setup) || {}).tasks || [];
    const why = shotProblem(f, { tasks });
    if (why) return toast(why);
    if (demo) { ui.sh = null; toast('Demo: not sent.'); return draw(); }
    ui.busy = true; draw();
    try {
      const geo = await where(), t = tasks.find(x => x.id === f.taskId);
      const ok = await L.saveShot(({ email, at, pid, id }) => shotRecord({ ...f, taskName: t ? t.name : '' }, { email, byName: (store.get().profile || {}).name || '', at, pid, id, dev: devId(), geo, date: realToday() }));
      if (ok) { ui.sh = null; toast('Sent to the Site Engineer / PE.'); } else toast('Not connected to Central Hub. Try again.');
    } catch (e) { toast(`Not sent: ${e.message}`); }
    ui.busy = false; draw();
  },
  async shOk(d) { await shDecide(d.id, 'approved'); },
  async shNo(d) { await shDecide(d.id, 'rejected', ui[`shWhy.${d.id}`] || 'blur'); },
  // 2.61.0 (R5): the store
  smOpen(d) { ui.sm = { kind: d.v, date: realToday(), cnt: {} }; draw(); },
  smClose() { ui.sm = null; draw(); },
  smCard(d) { ui.smCard = d.v || ''; draw(); },
  smCam() { const i = document.getElementById('smCam'); i.value = ''; i.click(); },
  async smSign() { const sig = await openPad("Receiver's signature"); if (sig && ui.sm) { ui.sm.sig = sig; draw(); } },
  async smSave() {
    const p = project(), f = ui.sm;
    if (!f) return;
    const all = ui.smList || [], book = bookOf(all), projects = store.get().projects || [];
    if (f.kind === 'count') f.lines = Object.values(book).map(e => ({ key: e.key, item: e.item, unit: e.unit, counted: (f.cnt || {})[e.key] ?? '' }));
    const why = moveProblem(f, { book, projects, code: p ? p.code : '', tasks: ((p && p.setup) || {}).tasks || [] });
    if (why) return toast(why);
    if (!L.liveOn()) return toast('No connection to Central Hub. Try again when online.');
    ui.busy = true; draw();
    try {
      let rec = null;
      await L.saveMove(o => (rec = moveRecord(f, { book, projects, byName: (store.get().profile || {}).name || '', ...o })));
      ui.sm = null; toast('Sent to the PE for approval.');
      if (rec) logAct({ action: 'save', channel: 'Store', doc: moveLine(rec) });
    } catch (e) { toast(`Not saved: ${e.message}`); }
    ui.busy = false; draw();
  },
  async smDecide(d) {
    const x = (ui.smList || []).find(m => m.id === d.id);
    if (!x) return;
    const word = { approved: 'Approve', rejected: 'Reject', cancelled: 'Cancel' }[d.v];
    if (!confirm(`${word}: ${moveLine(x)}?`)) return;
    ui.busy = true; draw();
    try { await L.moveStatus(x.id, d.v, (store.get().profile || {}).name || ''); toast('Done.'); logAct({ action: 'save', channel: 'Store', doc: `${word}d: ${moveLine(x)}` }); }
    catch (e) { toast(`Not saved: ${e.message}`); }
    ui.busy = false; draw();
  },
  async smKeeper() {
    const k = (ui.smList || []).find(m => m.id === 'keeper') || {};
    const keeper = String(ui.smKeep ?? k.keeper ?? '').trim();
    if (keeper && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(keeper)) return toast('Enter the keeper\'s sign-in email.');
    const mins = { ...(k.mins || {}) };
    for (const [key, v] of Object.entries(ui.smMin || {})) { if (v === '' || v == null) delete mins[key]; else if (Number(v) >= 0) mins[key] = Number(v); }
    ui.busy = true; draw();
    try { await L.setKeeper({ keeper, keeperName: String(ui.smKeepName ?? k.keeperName ?? '').trim(), mins, byName: (store.get().profile || {}).name || '' }); ui.smMin = {}; toast('Saved.'); }
    catch (e) { toast(`Not saved: ${e.message}`); }
    ui.busy = false; draw();
  },
  keepLocal() { ui.sheet = ''; ui.remote = null; draw(); pushDraft(); },
  flipPref(d) {
    const pr = store.get().profile, on = d.f === 'remind' ? pr.remind === false : !pr[d.f];
    store.set({ profile: { ...pr, [d.f]: on } });
    if (d.f === 'remind' && on && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  },
  async pushOn() {
    const pr = store.get().profile;
    if (ui.pushBusy) return;
    if (pr.push) {
      store.set({ profile: { ...pr, push: false } }); toast('Notifications off on this phone.');
      try { window.OneSignal.User.PushSubscription.optOut().catch(() => {}); } catch { /* the service was not loaded: nothing to stop */ }
      return;
    }
    if (demo) return toast('Demo: notifications are not set up here.');
    ui.pushBusy = true; draw();
    try {
      const appId = await pushAppId();
      if (!appId) return toast('Notifications are not set up on the server yet.');
      const OS = await oneSignal(appId, (store.get().auth || {}).who);
      if (!OS.Notifications.permission) await OS.Notifications.requestPermission();
      if (!OS.Notifications.permission) return toast('Notifications were not allowed. Allow them in the browser settings.');
      try { OS.User.PushSubscription.optIn().catch(() => {}); } catch { /* older service: already in */ }
      store.set({ profile: { ...store.get().profile, push: true } });
      toast('Notifications on.');
    } catch (e) { toast(e.message || String(e)); }
    finally { ui.pushBusy = false; draw(); }
  },
  inboxClear() { ui.inboxOpen = false; store.set({ inboxSeen: ((store.get().inbox || [])[0] || {}).t || '' }); },
  inboxToggle() { ui.inboxOpen = !ui.inboxOpen; draw(); },
  inboxMore() { ui.inboxAll = !ui.inboxAll; draw(); },
  async pushTest() {
    try { const r = await call('pushtest', {}); toast(r.ok ? 'Test sent. It should arrive in a few seconds.' : `Test failed: ${r.error || r.skipped || 'no answer'}`); }
    catch (e) { toast(`Test failed: ${e.message}`); }
  },

  /* slice 4: requests and tomorrow, review and send */
  newReq() { openReq(); },
  logReq() { ui.sheet = ''; openReq(); },
  openReq: d => openReq(d.v),
  reqQty: d => { ui.req.qty = Math.max(0, (num(ui.req.qty) || 0) + Number(d.d)); draw(); },
  reqReceipt() { spotIn(rcpt); },
  saveReq(d) {
    const q = ui.req;
    if (!String(q.text || '').trim()) return toast('Write what is needed first.');
    if (q.category === 'Expense' && !(num(q.amount) > 0)) return toast('Give the amount of the expense.');
    q.text = q.text.trim(); q.qty = num(q.qty); if (q.category === 'Expense') q.amount = num(q.amount);
    // 2.14.0: shared with the project's phones and Central Hub (a draft until the report is sent)
    const by = { date: ui.reqDate || report().date, byName: (store.get().profile || {}).name || '' };
    // 2.25.0: when sharing fails the request stays on the phone (shown as "On this phone") and goes again by itself
    if (ui.reqAsked) {   // 2.40.0: an asked request: changed in the shared list only
      if (!L.liveOn()) return toast('Connect to the internet to change an asked request.');
      L.saveRequest(q, by).then(() => toast('Request changed.')).catch(e => toast(`Not changed: ${e.message}`));
      return go('requests');
    }
    const otherDay = !!ui.reqDate && ui.reqDate !== report().date;
    if (otherDay) queueReq(q, by.date);
    if (L.liveOn()) { q.live = true; L.saveRequest(q, by).then(ok => { if (ok) dropQueued(q.id); }).catch(e => toast(`Saved on this phone; it is shared when the connection is back (${e.message}).`)); }
    if (otherDay) { toast('Request saved.'); return go('requests'); }
    edit(r => { r.requests = r.requests || []; const i = r.requests.findIndex(y => y.id === q.id); if (i >= 0) r.requests[i] = q; else r.requests.push(q); r.done.end = false; });
    toast(q.priority === 'Urgent' ? 'Urgent request saved.' : 'Request saved.');
    if (d.v === 'again') openReq(); else go('end');
  },
  deleteReq() {
    if (!confirm('Delete this request?')) return;
    const id = ui.req.id;
    if (ui.req.live) L.requestStatus(id, 'deleted', { byName: (store.get().profile || {}).name || '' }).catch(e => toast(`Not deleted for the others: ${e.message}`));   // 2.14.0
    dropQueued(id);   // 2.25.0
    if (ui.reqAsked || (ui.reqDate && ui.reqDate !== report().date)) return go('requests');
    edit(r => { r.requests = (r.requests || []).filter(y => y.id !== id); });
    go('end');
  },
  // 2.39.0 (owner): delete a draft or an asked request; it stays in the list as removed by whom and when
  async reqDelete(d) {
    if (!confirm('Delete this request? It shows as removed, with your name and the time.')) return;
    try { await L.requestStatus(d.v, 'deleted', { byName: (store.get().profile || {}).name || '', note: 'Removed on site' }); toast('Removed.'); }
    catch (e) { return toast(`Not removed: ${e.message}`); }
    dropQueued(d.v);
    const k = draftKey(project().code, realToday());
    if (store.get().drafts[k]) editKey(k, x => { x.requests = (x.requests || []).filter(y => y.id !== d.v); });
  },
  async reqCancel(d) {
    if (!confirm('Withdraw this request? The office is told.')) return;
    try { await L.requestStatus(d.v, 'cancelled', { byName: (store.get().profile || {}).name || '', note: 'Withdrawn on site' }); toast('Withdrawn.'); }
    catch (e) { toast(`Not withdrawn: ${e.message}`); }
  },
  copyPlan() {
    const add = unfinishedWork(report(), project().setup || {});
    edit(r => { r.plan = [...(r.plan || []), ...add]; });
    toast(`${add.length} line${add.length === 1 ? '' : 's'} copied. Change what is different.`);
  },
  addPlan: () => edit(r => { const last = (r.plan || []).at(-1); r.plan = [...(r.plan || []), newPlanLine(last ? last.zone : '')]; }),
  dropPlan: d => edit(r => { r.plan.splice(Number(d.i), 1); }),
  saveSig() {
    const cv = root.querySelector('#sigpad');
    if (!cv || !(ui.sig || []).some(st => st.length > 2)) return toast('Sign in the box first.');
    // on white: a see-through signature prints black in some PDF viewers
    const out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height;
    const g = out.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height); g.drawImage(cv, 0, 0);
    sigSaved(out.toDataURL('image/png'));
    if (!demo) call('sigPut', { png: store.get().profile.sig }).catch(() => {});
    ui.sig = [];
    edit(r => { r.signed = new Date().toISOString(); });
  },
  useSig() { edit(r => { r.signed = new Date().toISOString(); }); },
  wipeSig() { ui.sig = []; draw(); },
  clearSig() { ACTS.sigFull({ v: report() && route() === 'send' ? 'report' : '' }); },
  toSign() { root.querySelector('#sign')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  async openPdf() {
    if (!adminRole()) return pdfRefused();
    ui.pdfBusy = true; draw();
    try { const f = await currentPdf(); window.open(f.url, '_blank'); logAct({ action: 'view', channel: 'PDF', doc: f.name }); }   // 2.59.0
    catch (e) { toast(`The PDF could not be made: ${e.message}`); }
    ui.pdfBusy = false; draw();
  },
  async sharePdf() {
    if (!adminRole()) return pdfRefused();
    try {
      const f = await currentPdf(), file = new File([f.blob], f.name, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: f.name }); logAct({ action: 'share', channel: 'Share sheet', doc: f.name }); }
      else { const a = document.createElement('a'); a.href = f.url; a.download = f.name; a.click(); logAct({ action: 'download', channel: 'PDF', doc: f.name }); }   // 2.59.0
    } catch (e) { if (e.name !== 'AbortError') toast(`Not shared: ${e.message}`); }
  },
  async sendReport() {
    if (ui.sending) return;
    ui.sending = 'Making the PDF…'; draw();
    try {
      const how = await sendReport(key(), m => { ui.sending = m; draw(); });
      toast(how === 'sent' ? (report().sent.unchanged ? 'No changes since the last send.' : 'Sent to the office.') : 'No connection. Saved on this phone; it goes by itself when the connection is back.');
    } catch (e) { toast(`Not sent: ${e.message}`); }
    ui.sending = ''; draw();
  },

  /* slice 3: equipment, materials, safety and delays, photos */
  dayDone(d) {
    edit(r => { r.done[d.v] = !r.done[d.v]; if (d.v === 'safety') r.safety.done = r.done.safety; });
    if (report().done[d.v]) go('today');
  },
  flip: d => edit(r => { setPath(r, d.f, !getPath(r, d.f)); if (d.f === 'safety.incident') { r.safety.done = false; r.done.safety = false; } if (d.f === 'safety.toolbox' && r.safety.toolbox && !r.safety.toolboxAt) r.safety.toolboxAt = now(); }),
  allClear() {
    edit(r => { Object.assign(r.safety, { incident: false, kind: '', note: '', done: true }); r.delays = []; r.done.safety = true; });
    toast('Ticked: no incidents, no delays.'); go('today');
  },
  addEq(d) {
    const name = d.v || (prompt('Name of the machine or equipment') || '').trim();
    if (!name) return;
    const s0 = report().start;
    edit(r => { r.equipment.push(newEquipment(name, hoursOf(s0))); r.done.equipment = false; });
  },
  eqQty: (d, el) => { const i = Number(el.closest('[data-i]').dataset.i); edit(r => { const e = r.equipment[i]; e.qty = Math.max(0, e.qty + Number(d.d)); if (!e.qty && confirm(`Take ${e.name} off today's list?`)) r.equipment.splice(i, 1); else if (!e.qty) e.qty = 1; }); },
  eqHrs: (d, el) => { const i = Number(el.closest('[data-i]').dataset.i); edit(r => { const e = r.equipment[i]; e.hrs = Math.max(0, Math.min(24, (Number(e.hrs) || 0) + Number(d.d))); }); },
  eqState: d => edit(r => { r.equipment[Number(d.i)].status = d.v; }),
  newRecv() { openRecv(); },   // 2.80.0 (owner, 9 Nov): the form opens; the camera only when Photo is tapped (was 2.5.0: started with the photo)
  logDelivery() { ui.sheet = ''; openRecv(); },
  openRecv: d => openRecv(d.v),
  recvQty: d => { ui.recv.qty = Math.max(0, (num(ui.recv.qty) || 0) + Number(d.d)); draw(); },
  recvPhoto() { ui.camFor = 'recv'; camera(); },
  saveRecv(d) {
    const x = ui.recv;
    if (!x.photos.length) return toast('Take the photo of the delivery first: its time is the delivery time.');
    if (!String(x.name || '').trim()) return toast('Write or pick the material first.');
    x.name = x.name.trim(); x.qty = num(x.qty);
    edit(r => { const i = r.received.findIndex(y => y.id === x.id); if (i >= 0) r.received[i] = x; else r.received.push(x); r.done.materials = false; });
    toast('Delivery saved.');
    if (d.v === 'again') openRecv(); else go('materials');
  },
  deleteRecv() {
    if (!confirm('Delete this delivery? Its photo stays with today\'s photos.')) return;
    const id = ui.recv.id;
    edit(r => { r.received = r.received.filter(y => y.id !== id); });
    go('materials');
  },
  newDelay() { openDelay(); },
  logDelay() { ui.sheet = ''; openDelay(); },
  logIncident() { ui.sheet = ''; ensureReport(); edit(r => { r.safety.incident = true; r.safety.done = false; r.done.safety = false; }); go('safety'); },
  openDelay: d => openDelay(d.v),
  delayNum: d => { ui.delay.hours = Math.max(0.5, Math.min(24, (Number(ui.delay.hours) || 0) + Number(d.d) * 0.5)); draw(); },
  delayPpl: d => { ui.delay.idlePeople = Math.max(0, (Number(ui.delay.idlePeople) || 0) + Number(d.d)); draw(); },
  saveDelay() {
    const x = ui.delay;
    if (!x.cause) return toast('Pick the cause first.');
    edit(r => { const i = r.delays.findIndex(y => y.id === x.id); if (i >= 0) r.delays[i] = x; else r.delays.push(x); r.safety.done = false; r.done.safety = false; });
    toast('Delay saved.'); go('safety');
  },
  deleteDelay() {
    if (!confirm('Delete this delay?')) return;
    const id = ui.delay.id;
    edit(r => { r.delays = r.delays.filter(y => y.id !== id); });
    go('safety');
  },
  openPhoto(d) {
    const p = report().photos.find(x => x.id === d.v);
    if (!p) return;
    ui.photo = structuredClone(p); ui.photoEditing = true; ui.photoBack = 'photos';
    go('photo');
  },

  /* work done */
  newItem() { openItem(); },
  logWork() { ui.sheet = ''; openItem(); },
  sayIt() { ui.sheet = ''; openItem(); startListening(); },
  sayItem: () => (ui.listening ? stopListening() : startListening()),
  openItem: d => openItem(d.v),
  logPlan(d) {
    const r = ensureReport(), plan = (r.planned || []).find(x => x.id === d.v);
    if (!plan) return;
    const task = ((project().setup || {}).tasks || []).find(t => t.id === plan.taskId);
    ui.back = location.hash.slice(1) === 'work' ? 'work' : 'today';
    ui.item = itemFromPlan(now(), plan, task);
    ui.allTasks = false; ui.mileOpen = false; ui.heard = '';
    go('item');
  },
  pickTask(d) {
    const t = ((project().setup || {}).tasks || []).find(x => x.id === d.v);
    if (ui.item.taskId === d.v) { ui.item.taskId = ''; ui.item.task = ''; }
    else { ui.item.taskId = t.id; ui.item.task = t.name; if (t.unit) ui.item.unit = t.unit; }
    draw();
  },
  allTasks: () => { ui.allTasks = true; draw(); },
  qty: d => { ui.item.qty = Math.max(0, (num(ui.item.qty) || 0) + Number(d.d)); draw(); },
  toggleMile: () => { if (ui.item.milestoneId) { ui.item.milestoneId = ''; ui.mileOpen = false; } else ui.mileOpen = !ui.mileOpen; draw(); },
  pickMile: d => { ui.item.milestoneId = d.v; ui.mileOpen = false; draw(); },
  addZone() {
    const z = (prompt('Name of the zone, block or area') || '').trim();
    if (!z) return;
    const code = store.get().proj, mine = store.get().siteZones[code] || [];
    if (!mine.includes(z)) store.set({ siteZones: { ...store.get().siteZones, [code]: [...mine, z] } });
    if (route() === 'photo') ui.photo.zone = z; else if (ui.item) ui.item.zone = z;
    draw();
  },
  saveItem(d) {
    const it = ui.item;
    if (!it.text.trim() && !it.task && !it.type) return toast('Say or write what was done, or pick a task.');
    it.qty = num(it.qty);
    edit(r => {
      const i = r.items.findIndex(x => x.id === it.id);
      if (i >= 0) r.items[i] = it; else r.items.push(it);
      r.photos.forEach(p => { if (it.photos.includes(p.id)) { p.itemId = it.id; if (!p.zone) p.zone = it.zone; } });
    });
    stopListening();
    toast('Saved.');
    if (d.v === 'again') openItem(); else go(ui.back || 'today');
  },
  deleteItem() {
    if (!confirm("Delete this work item? Its photos stay with today's photos.")) return;
    const id = ui.item.id;
    edit(r => { r.items = r.items.filter(x => x.id !== id); r.photos.forEach(p => { if (p.itemId === id) p.itemId = ''; }); });
    go('work');
  },
  workDone() { edit(r => { r.done.work = !r.done.work; }); if (report().done.work) go('today'); },

  /* photos */
  logPhoto() { ui.sheet = ''; ui.camFor = 'photo'; liveCam('photo'); },   // 2.76.0: the camera inside the app
  logVideo() { if (!ui.vidWork) liveCam('video'); },   // 2.50.0; 2.76.0: the camera inside the app, live only
  videoDrop(d) { const v = (store.get().videos || []).find(x => x.id === d.v); if (!v || v.sent) return; deletePhoto(v.id).catch(() => {}); store.set({ videos: store.get().videos.filter(x => x.id !== v.id) }); draw(); },
  galPhoto() { if (P.isGM({ s: store.get() })) { gal.value = ''; gal.click(); } },   // 2.32.0
  itemPhoto() { ui.camFor = 'item'; camera(); },
  photoItem: d => { ui.photo.itemId = ui.photo.itemId === d.v ? '' : d.v; draw(); },
  savePhoto(d) {
    const p = ui.photo;
    edit(r => {
      const i = r.photos.findIndex(x => x.id === p.id);
      const meta = { id: p.id, at: p.at, zone: p.zone, captionKind: p.captionKind, caption: p.caption, itemId: p.itemId };
      if (i >= 0) r.photos[i] = meta; else r.photos.push(meta);
      r.items.forEach(it => { it.photos = it.photos.filter(x => x !== p.id); if (it.id === p.itemId) it.photos.push(p.id); });
    });
    ui.photoEditing = false;
    toast('Photo saved.');
    upNow();   // 2.52.0 (owner): sent to Drive at once, also after the report was sent, so Central Hub shows it
    if (d.v === 'again') { ui.camFor = 'photo'; liveCam('photo'); } else go(ui.photoBack || 'today');
  },
  async dropPhoto() {
    const p = ui.photo;
    if (ui.photoEditing && !confirm('Delete this photo?')) return;
    edit(r => { r.photos = r.photos.filter(x => x.id !== p.id); r.items.forEach(it => { it.photos = it.photos.filter(x => x !== p.id); }); });
    await deletePhoto(p.id).catch(() => {});
    deletePhoto(ORIG(p.id)).catch(() => {});
    ui.photoEditing = false; go(ui.photoBack || 'today');
  },
  closeSheet: () => { ui.sheet = ''; draw(); },
  async noWorkSend() {
    const p = project(), reason = ui.nwReason;
    ui.busy = true; draw();
    try {
      const how = await sendOrQueue('nowork', { proj: p.code, cc: codesOf(p).cc, date: today(), reason, note: ui.nwNote || '', by: store.get().profile.name });
      const cur = report();
      store.set({ drafts: { ...store.get().drafts, [key()]: { ...(cur || { proj: p.code, date: today(), no: nextNo(p) }), nowork: { reason, note: ui.nwNote || '', at: Date.now() } } } });
      ui.sheet = '';
      toast(how === 'sent' ? 'Sent: no work today.' : 'Saved. It goes to the office when there is a connection.');
    } catch (e) { toast(e.message); }
    ui.busy = false; draw();
  },
};

/* ---------- drawing ---------- */

const root = document.getElementById('app');
// 2.26.0: on a phone, slide left or right for the next or previous tab of the bottom bar
onSwipe(root, () => root.querySelectorAll('nav.nav > button'));
// 2.43.2 (owner: a phone opened in the computer layout until refreshed): when the app opens, a phone can report
// the 980 px of a page without its viewport for a moment, and no resize follows. The screen's own width caps it,
// and the width is asked again when the page has settled.
const viewW = () => Math.min(innerWidth, document.documentElement.clientWidth || innerWidth, (screen && screen.width) || innerWidth);
let layout = D.layoutOf(viewW());
const relayout = () => { const l = D.layoutOf(viewW()); if (l !== layout) { layout = l; draw(); } };
addEventListener('resize', relayout);
addEventListener('orientationchange', relayout);
addEventListener('pageshow', relayout);
addEventListener('load', relayout);
if (window.visualViewport) visualViewport.addEventListener('resize', relayout);
[300, 1500].forEach(ms => setTimeout(relayout, ms));

/** The open step's tab in the menu. */
const TAB_OF = { quick: 'quick', att: 'att', reports: 'reports', requests: 'reports', me: 'me', review: 'reports', rev: 'reports', crewrev: 'me' };   // 2.55.0
if (true) { TAB_OF.review = TAB_OF.rev = TAB_OF.crewrev = 'me'; }   // 2.37.0: from Me (a viewer has no rail tab but Review)
/** Screens with a long form: the day column folds away on a computer. */
const FOLD = new Set(['item', 'photo', 'delivery', 'delay', 'request']);

function context() {
  const s = store.get(), p = project();
  const r = report(), t = now();
  const needs = p ? needsYou(monthDays(realToday(), p, s.drafts, s.known).filter(x => !x.other), s.known) : [];
  const sentToday = p ? ((s.others || {})[p.code] || []).filter(x => x.date === realToday()).sort((a, b) => Number(b.no) - Number(a.no))[0] || null : null;   // 2.9.0
  return {
    s, ui, kind: kind(), devId: devId(), wide: layout !== 'phone', now: t, today: today(), realToday: realToday(), past: !!ui.date, project: p, report: r, nextNo: p ? nextNo(p) : 1,
    dayOff: p ? (p.nwDow || [0]).includes(weekday(today())) : false, needs, sentToday,
    fileName: p && r && r.no ? pdfName(p, r.date, r.no) : '',
    evening: !ui.date && !!r && !!r.start && !r.sentAt && t >= remindAt() && s.profile.remind !== false,
  };
}

/** 2.54.0: the button on a notification: Approve after one question (the list may still be loading), Send back asks for the reason. */
function notifAct(how, date, no, tries = 0) {
  const p = project();
  const x = p && monthDays(realToday(), p, store.get().drafts, store.get().known, (store.get().others || {})[p.code]).find(y => y.date === date && String(y.no) === String(no));
  if (!x || !x.name) { if (tries < 10) setTimeout(() => notifAct(how, date, no, tries + 1), 1000); else toast('Open the report and choose there.'); return; }
  if (how === 'changes') return toast('Write what must change, then tap Send back.');
  if (confirm(`Approve report No. ${x.no} (${date})?`)) ACTS.dayRev({ v: 'approve', n: x.name });
}

/** 2.7.0: a notification's link (#go=what/date/project/no) opens its item: the day of a report, a report to review, the crew. */
function openLink(h) {
  const [what, d, code, no] = decodeURIComponent(h.slice(3)).split('/'), s = store.get();
  if (!s.auth || !s.profile.done) return false;
  if (code && code !== s.proj && s.projects.some(p => p.code === code)) store.set({ proj: code });
  if (what === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(d || '')) { go('reports'); setTimeout(() => { ui.daySel = d; ui.sheet = 'day'; draw(); }, 60); }   // after the page change, which closes sheets
  // 2.52.0 (owner): a new report opens that report in Reports (its day, with Approve and Send back), not the old Review page
  // 2.68.0 (owner): Open on the notification: that report's details (Approve, Send back, Comment, Remove), not the list
  else if (what === 'review' && /^\d{4}-\d{2}-\d{2}$/.test(d || '') && kind() !== 'reporter') { ui.rv = { want: { d, no } }; ui.sheet = ''; go('rev'); ACTS.revLoad(); }
  else if (what === 'review' && /^\d{4}-\d{2}-\d{2}$/.test(d || '')) { go('reports'); setTimeout(() => { ui.daySel = d; ui.sheet = 'day'; draw(); }, 60); }
  // 2.68.0 (owner): Remind later: the same notification again in 30 minutes
  else if (what === 'later' && /^\d{4}-\d{2}-\d{2}$/.test(d || '')) {
    // 2.80.0 (owner, 9 Nov): quiet: no page change, no message (the notification worker does it without opening the app)
    call('remindLater', { date: d, proj: code, no }).catch(e => toast(e.code === 'OFFLINE' ? 'No connection: no reminder set.' : `No reminder set: ${e.message}`));
  }
  // 2.54.0 (owner): Approve or Send back tapped on the phone notification: the report opens, Approve asks once, Send back waits for the reason
  else if (what === 'act') {
    const [, how, date, pcode, pno] = decodeURIComponent(h.slice(3)).split('/');
    if (!['approve', 'changes'].includes(how) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !ruleHas(s.rules, 'fr_approve', 'D')) { go('reports'); return true; }   // 2.60.0: approving by rule only
    if (pcode && pcode !== s.proj && s.projects.some(p => p.code === pcode)) store.set({ proj: pcode });
    go('reports'); setTimeout(() => { ui.daySel = date; ui.sheet = 'day'; draw(); notifAct(how, date, pno); }, 60);
  }
  else if (what === 'attention') ACTS.attOpen();   // 2.8.0: from the shortcut on the app icon
  else if (what === 'devices') { go('me'); devCheck(true); }   // 2.53.0: a new device waits on Me > Devices
  else if (what === 'me' || what === 'requests') go(what);
  else go(['crew', 'att', 'crewrev', 'spot', 'reports'].includes(what) ? (what === 'crew' ? 'att' : what) : 'today');
  return true;
}

function route() {
  const s = store.get();
  if (!s.auth) return 'signin';
  if (!s.profile.done) return 'profile';
  if (!project()) return 'choose';
  let h = location.hash.slice(1) || 'today';
  if (h === 'crew') h = 'att';   // 2.10.0: the day's Attendance step is the Office attendance tab
  // 2.6.0: a reviewer or viewer account writes no report: it opens on Review
  if (h === 'review') h = 'reports';   // 2.55.0 (owner): the old Review list is replaced by Reports and Requests
  if (kind() === 'technician') return h === 'me' ? 'me' : 'share';   // 2.66.0 (owner): a technician opens only Share work
  if (h === 'share') return 'today';
  if (kind() === 'viewer' && (h === 'today' || h === 'att' || h === 'crewrev' || NEEDS_REPORT.has(h))) return 'reports';
  if (kind() === 'reporter' && (h === 'review' || h === 'rev' || h === 'crewrev')) return 'today';
  if (screenOffOnly(s.rules, h)) return h;   // 2.74.2 (owner): turned off in Central Hub: the page says so
  if (!screenOk(s.rules, h)) return firstOk(s.rules);   // 2.60.0 (owner, G6): a page the rules hide does not open by any address
  if (NEEDS_REPORT.has(h) && !working()) return 'today';
  if (h === 'item' && !ui.item) return 'work';
  if (h === 'photo' && !ui.photo) return 'today';
  if (h === 'delivery' && !ui.recv) return 'materials';
  if (h === 'delay' && !ui.delay) return 'safety';
  if (h === 'request' && !ui.req) return 'end';
  return SCREENS[h] ? h : 'today';
}

/** 2.74.2 (owner, 8 Nov): a page whose feature the Admin turned off in Central Hub (Settings, Apps). */
function offScreen(r) {
  const t = [...P.TABS, ...P.REVIEW_TABS, ...P.TECH_TABS].find(x => x.id === r);
  const title = t ? t.title : r.charAt(0).toUpperCase() + r.slice(1);
  return { tab: t ? r : 'today', head: P.head(title, 'Turned off', ''), body: html`<div class="offbox"><i class="offt">Turned off</i><b>${title} is turned off</b><span class="muted small">The Admin turned this off for everyone in Central Hub. Nothing was deleted: it comes back as it was when it is turned on again.</span></div>` };
}
/**
 * 2.80.0 (owner, 9 Nov): Remind later on a notification is done by the notification worker (push/), without opening the
 * app. It needs what the app sends with every request; it is kept on this phone only (the app's own storage), and
 * removed at sign-out.
 */
let kitAt = null;
function kitSync() {
  const t = token() || '';
  if (kitAt === t || demo || typeof caches === 'undefined') return;
  kitAt = t;
  caches.open('fr2-kit').then(c => (t ? c.put('kit.json', new Response(JSON.stringify({ url: SCRIPT, token: t, dev: deviceId(), mode: deviceMode(), app: APP_VERSION }))) : c.delete('kit.json'))).catch(() => {});
}

function draw() {
  kitSync();
  try { fetchForecast(); } catch { /* no forecast */ }   // 2.64.0
  // 2.40.0 (owner): an open list (the project list on Requests) is not closed by a live update; the page is drawn when it closes
  if (document.activeElement && document.activeElement.tagName === 'SELECT') { ui.drawLater = true; return; }
  ui.drawLater = false;
  clSync();
  const r = route(), c = context();
  if (r === 'photos' || r === 'send') fitSoon();   // 2.11.0
  if (r === 'chat') chatMarkRead();   // 2.74.1
  const setup = r === 'signin' || r === 'profile' || r === 'choose';
  const wide = layout !== 'phone' && !setup;
  // on a computer, Today with a started report shows the summary; the day itself sits in the middle column
  const working = c.report && c.report.start && !c.report.nowork;
  let v = r === 'signin' ? S.signin(c) : r === 'profile' ? S.profile(c) : r === 'choose' ? S.chooseProject(c)
    : screenOffOnly(c.s.rules, r) ? offScreen(r) : wide && r === 'today' && working ? D.glance(c) : SCREENS[r](c);   // 2.74.2
  if (ui.date && (r === 'today' || NEEDS_REPORT.has(r))) v = { ...v, body: html`${F.pastBand(c)}${v.body}` };
  if (!demo && !setup) { const w = dbWaiting(c.s.drafts); v = { ...v, body: html`${P.dbBar(ui, w.length, w.map(k => c.s.drafts[k].dbWhy).filter(Boolean).pop() || '')}${v.body}` }; }   // 2.35.0; 2.69.0 the reason
  if (P.TOP_PROJ.has(r) && P.isGM(c) && c.s.projects.length > 1) v = { ...v, head: html`${v.head || ''}${P.projTop(c, P.ALL_PROJ.has(r))}` };   // 2.16.1; 2.17.0 All projects
  document.documentElement.dataset.theme = c.s.profile.dark ? 'dark' : '';
  const scroll = root.querySelector('.bd')?.scrollTop || 0;
  const same = root.dataset.screen === r;
  const focus = document.activeElement && document.activeElement.dataset ? (document.activeElement.dataset.ui || '') : '';
  root.dataset.screen = r;
  const page = `${v.head || ''}<main class="bd">${v.body}</main>${v.foot ? `<footer class="ft">${v.foot}</footer>` : ''}`;
  root.className = `app ${wide ? `wide ${layout}` : ''} ${demo ? 'demo' : ''}`;
  if (wide) {
    const day = working && !TAB_OF[r] && !(layout === 'desk' && FOLD.has(r)) && !(layout === 'tab' && FOLD.has(r));
    root.innerHTML = `${D.rail(c, TAB_OF[r] || 'today')}${day ? D.dayPane(c, r) : ''}<section class="ws ${day ? '' : 'solo'}">${page}</section>`;
  } else {
    root.innerHTML = page
    + `${v.fab ? '<button type="button" class="fab" data-act="fab" aria-label="Log now"><svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>' : ''}`
    + `${v.tab ? nav(v.tab, { chat: r === 'chat' ? 0 : chatUnread() }, c.kind, c.s.rules) : ''}`;   // 2.74.1: unread messages
  }
  if (!setup) root.insertAdjacentHTML('beforeend', S.inboxFab(c));   // 2.37.0: the floating notifications circle
  const sheet = { nowork: S.noWorkSheet, log: S.logSheet, day: F.daySheet, new: F.whatsNewSheet, draft: F.draftSheet }[ui.sheet];
  root.innerHTML += `${sheet ? sheet(c) : ''}`
    + `${ui.toast ? `<div class="toast" role="status">${escText(ui.toast)}</div>` : ''}`
    + `${isDemo() ? '<div class="demo-flag">Demo</div>' : ''}`;
  if (ui.sheetNew) { root.querySelector('.sheet')?.classList.add('new'); ui.sheetNew = false; }
  if (same) { const bd = root.querySelector('.bd'); if (bd) bd.scrollTop = scroll; }
  if (r === 'chat') {   // 2.74.1: the newest message in view on opening and when one arrives or is sent
    const bd = root.querySelector('.bd'), n = root.querySelectorAll('.crow').length;
    if (bd && (!same || ui.chatScroll !== n)) { ui.chatScroll = n; bd.scrollTop = bd.scrollHeight; }
  }
  hideOff(root, c.s.rules);   // 2.60.0 (owner, G6): what the rules hide is not on the page by any means
  if (ui.cur != null) root.querySelector(`[data-row="${ui.cur}"]`)?.scrollIntoView({ block: 'nearest' });
  root.querySelectorAll('img[data-photo]').forEach(img => { if (img.getAttribute('src') === 'data:,') photoUrl(img.dataset.photo).then(u => u || driveUrl(img.dataset.photo)).then(u => { if (u) img.src = u; }); });
  bindSig();
  empFrame();   // 2.16.0
  if (focus) { const el = root.querySelector(`[data-ui="${focus}"]`); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* a time field has no caret */ } } }
}

const escText = s => String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);

/* ---------- events ---------- */

root.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  // 2.44.1 (owner): the project list closes with a tap anywhere else
  if (ui.projPop && !e.target.closest('.proj-pop') && !(el && el.dataset.act === 'projPop')) { ui.projPop = false; draw(); if (!el) return; }
  if (!el || el.disabled) return;
  const fn = ACTS[el.dataset.act];
  if (fn && actOk(store.get().rules, el.dataset.act, el.dataset)) fn(el.dataset, el);   // 2.60.0 (G6)
  else if (fn && actOffOnly(el.dataset.act)) toast('Turned off: the Admin turned this off in Central Hub.');   // 2.74.2
});

// 2.66.0: the technician's photo, from the camera only; refused on the phone when blurred, dark or too bright
document.getElementById('shCam').addEventListener('change', async e => {
  const f = e.target.files?.[0];
  if (!f) return;
  ui.sh ||= { photos: [] }; ui.sh.photos ||= []; ui.shBusy = true; ui.shWhy = ''; draw();
  try {
    const x = await shotPhoto(f);
    if (!x.q.ok) ui.shWhy = x.q.why;
    else if (ui.sh.photos.length < MAX_PHOTOS) ui.sh.photos.push(x);
  } catch { toast('That picture could not be read.'); }
  ui.shBusy = false; draw();
});
const SMF = { smReq: 'reqId', smTask: 'taskId', smPo: 'poId', smDate: 'date', smItem: 'item', smQty: 'qty', smUnit: 'unit', smSup: 'supplier', smTo: 'to', smZone: 'zone', smProj: 'toProject', smNote: 'note' };
// 2.61.0 (R5): the delivery note, from the camera only; a known item fills its unit
document.getElementById('smCam').addEventListener('change', async e => {
  const f = e.target.files?.[0];
  if (!f || !ui.sm) return;
  try { ui.sm.photo = await receiptUrl(f); draw(); } catch { toast('That picture could not be read.'); }
});
root.addEventListener('change', e => {
  // 2.62.0 (R6): a Receive against a PO takes its supplier and number
  if (e.target.dataset.ui === 'smTask' && ui.sm) { const p = project(), t = (((p && p.setup) || {}).tasks || []).find(x => x.id === e.target.value); ui.sm.taskId = t ? t.id : ''; ui.sm.taskName = t ? t.name : ''; return; }   // 2.63.0 (R7)
  if (e.target.dataset.ui === 'smReq' && ui.sm) { const r = (ui.liveReqs || []).find(x => x.id === e.target.value); ui.sm.reqId = r ? r.id : ''; if (r && r.vendor) ui.sm.supplier = r.vendor; draw(); return; }   // 2.67.0
  if (e.target.dataset.ui === 'smPo' && ui.sm) { const po = (ui.poList || []).find(p => p.id === e.target.value); ui.sm.poId = po ? po.id : ''; ui.sm.poNo = po ? po.number : ''; if (po) ui.sm.reqId = ''; if (po) ui.sm.supplier = po.supplier || ui.sm.supplier; draw(); return; }
  if (e.target.dataset.ui !== 'smItem' || !ui.sm || ui.sm.unit) return;
  const hit = itemsOf(ui.smList || [], ui.liveReqs || []).find(i => i.item.toLowerCase() === String(ui.sm.item || '').trim().toLowerCase());
  if (hit) { ui.sm.unit = hit.unit; draw(); }
});
root.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.cd && ui.cd) { ui.cd.f[el.dataset.cd] = el.value; return; }   // 2.45.0
  // 2.61.0 (R5): the store's form, its counts and minimums
  if (el.dataset.ui && /^sm(Cnt|Min)\./.test(el.dataset.ui)) { const i = el.dataset.ui.indexOf('.'), a = el.dataset.ui.slice(0, i), k = el.dataset.ui.slice(i + 1); if (a === 'smCnt' && ui.sm) (ui.sm.cnt ||= {})[k] = el.value; else if (a === 'smMin') (ui.smMin ||= {})[k] = el.value; return; }
  if (el.dataset.ui === 'shTask' || el.dataset.ui === 'shNote') { (ui.sh ||= { photos: [] })[el.dataset.ui === 'shTask' ? 'taskId' : 'note'] = el.value; return; }   // 2.66.0
  if (el.dataset.ui && SMF[el.dataset.ui] && ui.sm) { ui.sm[SMF[el.dataset.ui]] = el.value; return; }
  if (el.dataset.ui) { ui[el.dataset.ui] = el.value; if (el.dataset.ui === 'q') draw(); return; }
  const f = el.dataset.f;
  if (!f) return;
  if (f.startsWith('profile.')) { store.quiet({ profile: { ...store.get().profile, [f.slice(8)]: el.value } }); return; }
  if (isDraft(f)) { setDraft(f, el.value); if (f.startsWith('cl.')) saveCl(); return; }
  const v = f === 'start.tempC' ? (num(el.value) ?? el.value) : el.value;
  edit(r => setPath(r, f, v), true);
});
// 2.45.0: a picture for the employee data (camera or gallery), made small like a receipt
document.getElementById('cdPic').addEventListener('change', async e => {
  const f = e.target.files?.[0], k = e.target.dataset.k;
  if (!f || !ui.cd) return;
  try { ui.cd.f[k] = await receiptUrl(f); draw(); } catch { toast('That picture could not be read.'); }
});
root.addEventListener('change', e => { if (e.target.dataset.proj != null) return ACTS.projTop({ v: e.target.value }); const f = e.target.dataset.f; if (f && !f.startsWith('profile.') && (!isDraft(f) || f.startsWith('cl.'))) draw(); });

/* keyboard (computer): N log now, 1–9 open a step, Esc close or go back, Ctrl+S the main button; on attendance ↑ ↓ and P A S L */
addEventListener('keydown', e => {
  const r = route();
  if (r === 'signin' || r === 'profile' || r === 'choose') return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    const main = root.querySelector('.ft .btn.p:not([disabled])');
    if (main) main.click();
    return;
  }
  if (e.key === 'Escape') {
    if (ui.sheet) { ui.sheet = ''; draw(); return; }
    if (typing) { document.activeElement.blur(); return; }
    if (r === 'item' || r === 'photo') go(r === 'item' ? (ui.back || 'work') : (ui.photoBack || 'today'));
    else if (r === 'delivery' || r === 'delay') go(r === 'delivery' ? 'materials' : 'safety');
    else if (r === 'request') go('end');
    else if (r !== 'today') go('today');
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'n' && working()) { e.preventDefault(); go('quick'); return; }
  if (/^[1-9]$/.test(k) && working()) {
    const step = STEPS[Number(k) - 1];
    if (S.READY.has(step.id)) go(step.id); else toast('This part comes in the next build.');
    return;
  }
  if (r === 'att' && working()) {
    const rows = report().crew.rows;
    if (!rows.length) return;
    const order = [...root.querySelectorAll('[data-row]')].map(x => Number(x.dataset.row));
    if (!order.length) return;
    let pos = Math.max(0, order.indexOf(ui.cur ?? order[0]));
    if (k === 'arrowdown' || k === 'arrowup') { e.preventDefault(); pos = Math.min(order.length - 1, Math.max(0, pos + (k === 'arrowdown' ? 1 : -1))); ui.cur = order[pos]; draw(); return; }
    const i = ui.cur ?? order[0];
    const st = { p: 'present', a: 'absent', s: 'sick', l: 'leave' }[k];
    if (st) { ui.cur = i; ACTS.mark({ i, v: st }); return; }
    if (k === '+' || k === '=' || k === '-') { if (rows[i].state === 'present') edit(x => { const p = x.crew.rows[i]; p.ot = Math.max(0, Math.min(12, (Number(p.ot) || 0) + (k === '-' ? -0.5 : 0.5))); }); }
  }
});

window.addEventListener('hashchange', () => {
  if (route() === 'att' && Date.now() - (ui.attTried || 0) > 30e3) { ui.attTried = Date.now(); ACTS.attRefresh(true); }   // 2.10.0; 2.16.0 30 s
  if (route() === 'review' && !(ui.rv && (ui.rv.list || ui.rv.busy))) ACTS.revLoad();   // 2.17.0: the list is there when the tab opens
  if (location.hash.startsWith('#go=') && openLink(location.hash.slice(1))) return;
  ui.filter = ''; ui.q = ''; ui.ot = null; ui.sheet = ''; ui.cur = null;
  const h = location.hash.slice(1);
  if (h !== 'item') { stopListening(); ui.item = null; }
  if (h !== 'photo') ui.photo = null;
  if (h !== 'delivery') ui.recv = null;
  if (h !== 'delay') ui.delay = null;
  if (h !== 'request') ui.req = null;
  draw();
  if (h === 'reports') checkStatus();
  if (h === 'me' || h === 'today') { devCheck(); inboxCheck(); }
  if (h === 'me') pushPreload();
  if (h !== 'me') sendProfile();
  if (h === 'today' || h === '') pullDraft();
});
window.addEventListener('online', () => { flush(); checkStatus(); upNow(); flushSpots(); flushVideos(); liveHeal(true); });   // 2.79.0: and the live link
setTimeout(() => flushVideos(), 4000);   // 2.50.0: a video left waiting is sent once the app is open
// 2.1.1: the office's approvals show without opening Reports: when the app comes back to the front, and every 10 minutes
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && store.get().auth) { checkStatus(); flushSpots(); liveHeal(true); } });
setInterval(() => { if (document.visibilityState === 'visible') liveHeal(); }, 60e3);   // 2.79.0
setInterval(() => { if (document.visibilityState === 'visible' && store.get().auth) checkStatus(); }, 10 * 60e3);
setInterval(remindTick, 60e3);
setInterval(shareLater, 60e3);   // 2.25.0: requests not shared yet go again
// 2.16.0: the Office page asks the office list every 30 s while open, when this device has no live updates or people wait for approval
setInterval(() => {
  if (document.visibilityState !== 'visible' || !store.get().auth || route() !== 'att' || Date.now() - (ui.attTried || 0) < 30e3) return;
  if (L.liveOn() && !((project() || {}).crewWait || []).length) return;
  ui.attTried = Date.now(); ACTS.attRefresh(true);
}, 30e3);
updateCheck();   // 2.12.3
setInterval(updateCheck, 30 * 60e3);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateCheck(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
// 2.2.0: asks the phone not to clear the app's data (the device id); 2.56.0: asked again each launch, and Me warns when the phone says no
try { navigator.storage?.persist?.().then(ok => { if (ui.persisted !== ok) { ui.persisted = ok; draw(); } }).catch(() => {}); } catch { /* no storage manager */ }
// 2.56.0: today's draft goes to the script at once when the app is put away (not only 15 s after a change)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && draftT) { clearTimeout(draftT); draftT = 0; pushDraft(); } });
// 2.58.0 (owner, G2): this phone's sessions in Central Hub's sign-in history, every minute while the app is in front
const here = presence(now => {
  const s = store.get(), p = project();
  return { ...newLog({ email: L.logEmail(), name: (s.profile || {}).name || '', position: (s.profile || {}).position || '', projects: p ? [p.code] : [], device: deviceUa(), mode: deviceMode(), now }) };
}, L.logIO, inputClock(document).busy);   // 2.65.0 (G3): active minutes
const hereTick = () => { if (!demo && store.get().auth && L.logReady() && document.visibilityState === 'visible' && navigator.onLine) here.tick(Date.now()); };
setInterval(hereTick, BEAT_MS);
setTimeout(hereTick, 5000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') hereTick(); else here.hide(Date.now()); });
store.subscribe(draw);
// 2.40.0: a choice made in a list is drawn at once; a page held back while a list was open is drawn when it closes
document.addEventListener('change', e => { if (e.target.tagName === 'SELECT') e.target.blur(); }, true);
document.addEventListener('focusout', e => { if (ui.drawLater && e.target.tagName === 'SELECT') setTimeout(draw, 0); });
// 2.40.0 (owner): the app opens on Today (a link from a notification still opens its page)
// 2.42.0 (owner): a reload of the page stays on the page it was on
const reloaded = (() => { try { return performance.getEntriesByType('navigation')[0]?.type === 'reload'; } catch { return false; } })();
// 2.42.1: never the answer of the Google sign-in (#state=…&access_token=…): signInReturn reads it below (2.40.0 wiped it)
const googleBack = /(^#|&)(state|access_token|error)=/.test(location.hash);
if (location.hash && !location.hash.startsWith('#go=') && !reloaded && !googleBack) history.replaceState(null, '', location.pathname + location.search);
// 2.42.0 (owner): notifications are on by default: switched on at once when already allowed, else at the first tap
// (the phone asks the person once); someone who turned them off stays off
const autoPush = () => {
  const pr = store.get().profile || {};
  if (demo || pr.push !== undefined || !store.get().auth || typeof Notification === 'undefined' || Notification.permission === 'denied') return;
  ACTS.pushOn();
};
setTimeout(() => { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') autoPush(); }, 3000);
document.addEventListener('pointerup', () => setTimeout(autoPush, 0), { once: true });
// 2.7.0: the app opened from a notification
if (location.hash.startsWith('#go=')) setTimeout(() => { if (!openLink(location.hash.slice(1))) go('today'); }, 300);

draw();
const back = signInReturn();
if (back) signedIn(back);
else if (store.get().auth) { flush(); if (!demo) loadProjects().then(() => { checkStatus(); pullDraft(); goLive(); }).catch(() => {}); else checkStatus(); devCheck(); inboxCheck(); }
oldAppClear();
cleanPhotos();
if (route() === 'me') pushPreload();
remindTick();
if (!demo) offerInstall('Field Report');   // 2.32.0 (owner): offer to install the app
