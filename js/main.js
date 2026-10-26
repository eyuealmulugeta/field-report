// Starts the app: picks the screen from the address (#today, #start, #crew…), draws it, and handles taps and typing.

import { post, signIn, useFake, isDemo, ApiError, APP_VERSION, deviceId } from './core/api.js';
import { html } from './core/dom.js';
import { createStore, memoryStorage } from './core/store.js';
import { todayIn, timeIn, num, weekday, uid } from './core/util.js';
import { codesOf, pdfName } from './core/names.js';
import { newReport, draftKey, STEPS } from './model/report.js';
import { mergeStaff, attendanceRows } from './model/crew.js';
import { demoServer, demoDrafts, DEMO_TODAY } from './demo.js';
import { newItem, itemFromPlan, parseSpeech, zonesOf } from './model/items.js';
import { putPhoto, getPhoto, deletePhoto, shrink, photoUrl } from './core/photos.js';
import { listen } from './core/voice.js';
import * as S from './ui/screens.js';
import * as W from './ui/work.js';
import * as D from './ui/desk.js';
import * as Y from './ui/day.js';
import { newEquipment, newReceived, newDelay } from './model/day.js';
import * as E from './ui/end.js';
import { newRequest, newPlanLine, unfinishedWork, reportMeta } from './model/end.js';
import { buildPdf, loadPdfLib, photoCaption } from './pdf.js';
import * as F from './ui/follow.js';
import { monthDays, sentBack, toCheck, draftChoice } from './model/follow.js';
import { nav } from './ui/parts.js';
import * as V from './ui/view.js';

const demo = new URLSearchParams(location.search).has('demo');
if (demo) useFake(demoServer);
const store = createStore(demo ? memoryStorage() : localStorage);
if (demo) store.set({ drafts: demoDrafts() });

const ui = { busy: false, error: '', sheet: '', toast: '' };
const realToday = () => (demo ? DEMO_TODAY : todayIn());
/** The day being reported: today, or an earlier day opened from Reports to write or correct. */
const today = () => ui.date || realToday();
const now = () => timeIn();

const SCREENS = {
  today: S.today, start: S.start, crew: S.crew, me: S.me, work: W.work, item: W.item, photo: W.photo,
  equipment: Y.equipment, materials: Y.materials, delivery: Y.delivery, safety: Y.safety, delay: Y.delay, photos: Y.photos,
  end: E.end, request: E.request, send: E.send,
  reports: F.reports, requests: F.requests, view: V.view,
};
const NEEDS_REPORT = new Set(['start', 'crew', 'work', 'item', 'photo', 'equipment', 'materials', 'delivery', 'safety', 'delay', 'photos', 'end', 'request', 'send']);

/* ---------- state helpers ---------- */

const project = () => store.get().projects.find(p => p.code === store.get().proj) || null;
const key = () => draftKey(store.get().proj, today());
const report = () => store.get().drafts[key()] || null;
const working = () => { const r = report(); return r && r.start ? r : null; };

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
  fn(r);
  r.updated = Date.now();
  const drafts = { ...store.get().drafts, [k]: r };
  if (quiet) store.quiet({ drafts }); else store.set({ drafts });
  draftSoon();
}

/** Today's report, made when first needed. A day first marked "no work" becomes a normal report if work starts after all. */
function ensureReport() {
  if (report() && report().start) return report();
  const p = project(), prof = store.get().profile;
  const r = newReport({ ...p, defStart: prof.defStart || p.defStart, defEnd: prof.defEnd || p.defEnd }, today(), nextNo(p), lastReport(p.code, today()));
  r.crew.rows = mergeStaff([], p.staff);
  store.set({ drafts: { ...store.get().drafts, [key()]: r } });
  return r;
}

/** item.* and photo.* fields belong to the item or photo being edited, held in ui until saved. */
const isDraft = f => /^(item|photo|recv|delay|req)\./.test(f);
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
    if (e.code === 'AUTH') { store.set({ auth: null }); location.hash = ''; }
    throw e;
  }
}

/** Projects from getconfig, with the crew lists and site location from myProjects. */
async function loadProjects() {
  const [cfg, mine] = await Promise.all([call('getconfig', {}), call('myProjects', {}).catch(() => ({ projects: [] }))]);
  const extra = new Map((mine.projects || []).map(p => [String(p.proj).toUpperCase(), p]));
  const projects = (cfg.projects || []).map(p => {
    const code = codesOf(p).code, m = extra.get(code) || {};
    return { ...p, code, staff: m.staff || [], location: m.location || p.siteName || '' };
  });
  const s = store.get(), old = new Map(s.projects.map(p => [p.code, p]));
  for (const p of projects) if (old.get(p.code)?.setup) p.setup = old.get(p.code).setup;
  store.set({ projects, proj: projects.some(p => p.code === s.proj) ? s.proj : projects.length === 1 ? projects[0].code : '' });
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
async function checkStatus(force) {
  const p = project();
  if (!p || !token() || ui.checking) return;
  const s = store.get(), rows = monthDays(realToday(), p, s.drafts, s.known);
  const list = force ? rows.filter(x => x.name && x.report && x.report.sentAt) : toCheck(rows, s.known);
  if (!list.length) return;
  ui.checking = true; draw();
  const known = { ...store.get().known };
  for (const x of list) {
    try {
      const res = await call('status', { name: x.name });
      known[x.name] = res.found ? { status: res.report.status, version: res.report.version, comments: res.report.comments || [], checked: Date.now() } : { status: 'submitted', comments: [], checked: Date.now() };
    } catch (e) { if (e.code === 'OFFLINE') break; }
  }
  ui.checking = false;
  store.set({ known, knownAt: Date.now() });
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
  await call('draftPut', { proj: p.code, date: r.date, no: r.no, screen: 'fr2', photoCount: r.photos.length, dev: devId(), s: { fr2: 1, report: r } }).catch(() => {});
}
async function pullDraft() {
  const p = project();
  if (!p || !token() || ui.date || ui.sheet || demo) return;
  try {
    const res = await call('draftGet', { proj: p.code });
    const how = draftChoice(res.found ? res.draft : null, report(), { today: realToday(), dev: devId() });
    if (how === 'load') { useRemote(res.draft); toast(`Report carried on from your other phone (saved ${new Date(res.draft.at).toTimeString().slice(0, 5)}).${res.draft.photoCount ? ' Its photos stay on that phone.' : ''}`); }
    if (how === 'ask') { ui.remote = res.draft; ui.sheet = 'draft'; draw(); }
  } catch { /* offline: try next time */ }
}
function useRemote(d) {
  const mine = report(), r = { ...d.s.report };
  // photos taken on the other phone are not here: keep only the ones this phone has
  const here = new Set((mine && mine.photos || []).map(x => x.id));
  r.photos = (r.photos || []).filter(x => here.has(x.id));
  store.set({ drafts: { ...store.get().drafts, [key()]: r } });
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

/** 17:00: a reminder when today's report is not sent (on the phone, while the app is open or in the background). */
function remindTick() {
  const s = store.get(), r = s.drafts[draftKey(s.proj, realToday())];
  if (s.profile.remind === false || !s.proj || now() < '17:00' || s.remindedOn === realToday()) return;
  if (r && (r.sentAt || r.nowork)) return;
  store.quiet({ remindedOn: realToday() });
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification('Field Report', { body: "Today's report is not sent yet.", tag: 'remind', icon: 'icon-192.png' })).catch(() => {});
  }
  draw();
}

/* ---------- the report: PDF, upload, outbox ---------- */

const toDataUrl = blob => new Promise((ok, fail) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => fail(fr.error); fr.readAsDataURL(blob); });

/** The report PDF, with today's photos from this phone and the saved signature. */
async function makePdf(r, p, step = () => {}) {
  step('Making the PDF…');
  const JsPDF = await loadPdfLib();
  const photos = [];
  for (const ph of r.photos) {
    const b = await getPhoto(ph.id).catch(() => null);
    if (!b) continue;
    const bmp = await createImageBitmap(b).catch(() => null);
    photos.push({ data: await toDataUrl(b), w: bmp ? bmp.width : 4, h: bmp ? bmp.height : 3, cap: photoCaption(ph, r.items) });
    if (bmp) bmp.close();
  }
  const prof = store.get().profile;
  const doc = buildPdf(JsPDF, { r, project: p, profile: prof, file: pdfName(p, r.date, r.no), photos, sig: prof.sig, signedAt: now() });
  const blob = doc.output('blob');
  if (ui.pdf) URL.revokeObjectURL(ui.pdf.url);
  ui.pdf = { key: draftKey(r.proj, r.date), at: r.updated, blob, url: URL.createObjectURL(blob), name: pdfName(p, r.date, r.no) };
  return blob;
}

/** trial.2: only the Admin may see, share or download the report PDF (the script also keeps the Drive link from the others). */
const adminRole = () => ((store.get().auth || {}).role || '') === 'admin';
const dropPdf = () => { if (ui.pdf) { URL.revokeObjectURL(ui.pdf.url); ui.pdf = null; } };
const pdfRefused = () => { toast('The report PDF goes to the office only. Use View the report.'); return true; };

/** Field Report 1 (now at /v1/, same address so the same phone storage) may still hold a report that was not sent:
 *  its draft (afr_draft) or its upload queue (IndexedDB "afr", keys q:…). Today then says so, with a link to /v1/. */
async function oldAppWork() {
  if (demo && !new URLSearchParams(location.search).has('old')) return;   // ?demo&old shows the notice in the demo
  let n = 0;
  try { const d = JSON.parse(localStorage.getItem('afr_draft') || 'null'); if (d && d.key) n++; } catch { /* no old draft */ }
  try {
    n += await new Promise(ok => {
      const rq = indexedDB.open('afr');
      rq.onupgradeneeded = () => rq.transaction.abort();   // the old app never ran on this phone: do not create its database
      rq.onerror = () => ok(0);
      rq.onsuccess = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('kv')) { db.close(); ok(0); return; }
        const g = db.transaction('kv').objectStore('kv').getAllKeys();
        g.onsuccess = () => { db.close(); ok(g.result.filter(k => String(k).startsWith('q:')).length); };
        g.onerror = () => { db.close(); ok(0); };
      };
    });
  } catch { /* no IndexedDB */ }
  if (n !== (ui.oldWork || 0)) { ui.oldWork = n; draw(); }
}

/** The Admin's list of devices (script 7.28.0), at most once a minute unless asked. */
async function devCheck(force) {
  if (!adminRole() || (!force && Date.now() - (ui.devsAt || 0) < 60e3)) return;
  ui.devsAt = Date.now();
  try { const r = await call('devices', {}); ui.devs = r.devices || []; draw(); } catch (e) { if (force) toast(e.message); }
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
  const r = store.get().drafts[k], p = store.get().projects.find(x => x.code === r.proj);
  const name = pdfName(p, r.date, r.no), meta = reportMeta(r, p, store.get().profile);
  let blob;
  try { blob = await makePdf(r, p, step); } catch { queueReport(k); return 'queued'; }
  step('Sending…');
  const data = (await toDataUrl(blob)).split(',')[1];
  if (!adminRole()) dropPdf();   // trial.2: the PDF is made only to send it; the engineer's phone does not keep it
  try {
    const res = await call('upload', { name, folderId: '', data, meta });
    const at = Date.now();
    editKey(k, x => { x.sentAt = at; x.updated = at; x.queuedAt = 0; x.sendError = ''; x.sent = { name, version: res.version || 1, status: res.status || 'submitted', unchanged: !!res.unchanged, hash: meta.hash }; });
    if (ui.pdf && ui.pdf.key === k) ui.pdf.at = at;
    unqueue(k);
    if (k === draftKey(p.code, realToday()) && !demo) call('draftDel', { proj: p.code }).catch(() => {});
    store.set({ known: { ...store.get().known, [name]: { status: res.status || 'submitted', version: res.version || 1, comments: (store.get().known[name] || {}).comments || [], checked: Date.now() } } });
    return 'sent';
  } catch (e) {
    if (e.code === 'OFFLINE' || e.code === 'BUSY') { queueReport(k); return 'queued'; }
    throw e;
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

/** Today's weather at the site, when the project has a map position. Optional: the fields stay editable. */
async function fetchWeather() {
  const p = project();
  if (demo || !p || p.siteLa == null || p.siteLo == null) return;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${p.siteLa}&longitude=${p.siteLo}&current=temperature_2m,weather_code,wind_speed_10m`;
    const cur = (await (await fetch(u)).json()).current;
    const code = cur.weather_code;
    const cond = cur.wind_speed_10m >= 30 ? 'Windy' : code >= 51 ? 'Rain' : code >= 2 ? 'Cloudy' : 'Clear';
    edit(r => { if (!r.start.done) { r.start.cond = cond; r.start.tempC = Math.round(cur.temperature_2m); } });
    ui.wx = `fetched for ${p.location || p.name}`;
    draw();
  } catch { /* no forecast: the engineer picks */ }
}

/* ---------- actions ---------- */

const go = to => { location.hash = to; };
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
  ui.req = found ? structuredClone(found) : newRequest(now());
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
function camera() { cam.value = ''; cam.multiple = layout !== 'phone' && ui.camFor === 'item'; cam.click(); }
cam.addEventListener('change', () => addPhotos([...(cam.files || [])]));

/** Several pictures at once: all go to the item being edited; otherwise the first opens the Photo page. */
async function addPhotos(files) {
  const pics = files.filter(f => /^image\//.test(f.type));
  if (!pics.length) return;
  if (route() === 'item' && ui.item) ui.camFor = 'item';
  if (route() === 'delivery' && ui.recv) ui.camFor = 'recv';
  if (ui.camFor === 'item' || ui.camFor === 'recv') { for (const f of pics) await addPhoto(f); return; }
  await addPhoto(pics[0]);
  if (pics.length > 1) toast('One photo at a time here; drop the rest on a work item to attach them all.');
}
addEventListener('dragover', e => { if ([...e.dataTransfer.items].some(i => i.kind === 'file')) e.preventDefault(); });
addEventListener('drop', e => {
  e.preventDefault();
  if (!store.get().auth || !project()) return;
  ui.camFor = route() === 'item' ? 'item' : 'photo';
  addPhotos([...e.dataTransfer.files]);
});
addEventListener('paste', e => {
  const files = [...(e.clipboardData?.files || [])];
  if (!files.length || !project()) return;
  e.preventDefault();
  ui.camFor = route() === 'item' ? 'item' : 'photo';
  addPhotos(files);
});

/** Shrinks and keeps a picture, then attaches it to the item being edited or opens the Photo page. */
async function addPhoto(file) {
  try {
    const blob = await shrink(file), id = uid();
    await putPhoto(id, blob);
    await photoUrl(id);
    const r = ensureReport();
    if (ui.camFor === 'item' && ui.item) {
      ui.item.photos.push(id);
      edit(x => { x.photos.push({ id, at: now(), zone: ui.item.zone, captionKind: 'Progress', caption: '', itemId: ui.item.id }); });
    } else if (ui.camFor === 'recv' && ui.recv) {
      ui.recv.photos.push(id);
      edit(x => { x.photos.push({ id, at: now(), zone: '', captionKind: 'Delivery', caption: ui.recv.name ? `Delivery: ${ui.recv.name}` : 'Delivery note', itemId: '' }); });
    } else {
      const last = r.items.at(-1);
      ui.photo = { id, at: now(), zone: last ? last.zone : '', captionKind: 'Progress', caption: '', itemId: '' };
      ui.photoEditing = false;
      ui.photoBack = route() === 'photos' ? 'photos' : 'today';
      if (location.hash.slice(1) === 'photo') draw(); else go('photo');
    }
  } catch (e) { toast(`The photo could not be saved on this phone (${e.message || e}).`); }
}
window.__addPhoto = demo ? addPhoto : undefined;   // lets the demo check be driven without a camera

/** Choices a second tap does not clear. */
const KEEP = new Set(['unit', 'captionKind', 'name', 'category', 'priority', 'text']);

const ACTS = {
  go: d => go(d.to),
  async signin() {
    ui.busy = true; ui.error = ''; draw();
    try {
      const a = await signIn(store.get().profile.name || '');
      const s = store.get();
      store.set({ auth: { token: a.token, who: a.who, role: a.role, email: a.email, name: a.name }, profile: { ...s.profile, name: s.profile.name || a.name || '' } });
      await loadProjects();
      go('today');
      checkStatus(); devCheck(true);
    } catch (e) { ui.error = e.message; }
    ui.busy = false; draw();
  },
  saveProfile() {
    if (!store.get().profile.name.trim()) return toast('Write your name first.');
    store.set({ profile: { ...store.get().profile, done: true } });
    go('today');
  },
  pickProject: d => { store.set({ proj: d.v }); go('today'); loadSetup(); },
  async refresh() {
    try { await loadProjects(); toast('Lists updated from the office.'); } catch (e) { toast(e.message); }
  },
  signout() {
    if (!confirm('Sign out? Reports not yet sent stay on this phone.')) return;
    store.set({ auth: null }); go('');
  },
  startDay() { ensureReport(); go('start'); fetchWeather(); },
  startCrew() { ensureReport(); go('crew'); },
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
  no: d => edit(r => { r.no = Math.max(1, r.no + Number(d.d)); }),
  startDone() {
    edit(r => { r.start.done = true; });
    store.set({ lastNo: { ...store.get().lastNo, [store.get().proj]: report().no } });
    go(report().crew.done ? 'today' : 'crew');
  },
  mark: d => { edit(r => { const x = r.crew.rows[d.i]; x.state = d.v; if (d.v !== 'present') x.ot = 0; }); ui.ot = null; },
  otOpen: d => { ui.ot = ui.ot === Number(d.i) ? null : Number(d.i); draw(); },
  ot: (d, el) => { const i = Number(el.closest('[data-i]').dataset.i); edit(r => { const x = r.crew.rows[i]; x.ot = Math.max(0, Math.min(12, (Number(x.ot) || 0) + Number(d.d) * 0.5)); }); },
  allPresent: () => edit(r => { const away = r.crew.rows.some(x => x.state !== 'present'); if (away) r.crew.rows.forEach(x => { x.state = 'present'; }); }),
  filter: d => { ui.filter = d.v; draw(); },
  addExtra: () => edit(r => { r.crew.extra.push({ trade: '', qty: 1 }); }),
  extra: (d, el) => { const i = Number(el.closest('[data-i]').dataset.i); edit(r => { const x = r.crew.extra[i]; x.qty = Math.max(0, x.qty + Number(d.d)); if (!x.qty && !x.trade) r.crew.extra.splice(i, 1); }); },
  async crewDone() {
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
  fab: () => { ui.sheet = 'log'; ui.sheetNew = true; draw(); },
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
      ui.devs = r.devices || []; toast(d.v === 'approve' ? 'Approved. That person can sign in on that device now.' : 'Denied. That device is signed out at its next connection.');
    } catch (e) { toast(e.message); }
  },
  async dayPdf(d) {
    if (!adminRole()) return pdfRefused();
    const r = store.get().drafts[draftKey(store.get().proj, d.v)];
    try {
      await makePdf(r, project());
      const f = ui.pdf, file = new File([f.blob], f.name, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: f.name });
      else { const a = document.createElement('a'); a.href = f.url; a.download = f.name; a.click(); }
    } catch (e) { if (e.name !== 'AbortError') toast(`Not shared: ${e.message}`); }
  },
  checkStatus: () => checkStatus(true),
  seenNew() { ui.sheet = ''; store.set({ seenNew: APP_VERSION }); },
  showNew() { ui.sheet = 'new'; ui.sheetNew = true; draw(); },
  loadRemote() { useRemote(ui.remote); ui.sheet = ''; ui.remote = null; toast('Draft from your other phone loaded.'); },
  keepLocal() { ui.sheet = ''; ui.remote = null; draw(); pushDraft(); },
  flipPref(d) {
    const pr = store.get().profile, on = d.f === 'remind' ? pr.remind === false : !pr[d.f];
    store.set({ profile: { ...pr, [d.f]: on } });
    if (d.f === 'remind' && on && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  },
  async pushOn() {
    const pr = store.get().profile;
    if (pr.push) { store.set({ profile: { ...pr, push: false } }); toast('Notifications off on this phone.'); return; }
    if (demo) return toast('Demo: notifications are not set up here.');
    try {
      const ping = await call('ping', {});
      if (!ping.pushAppId) return toast('Notifications are not set up on the server yet.');
      const OS = await oneSignal(ping.pushAppId, ping.who || (store.get().auth || {}).who);
      await OS.Notifications.requestPermission();
      if (!OS.Notifications.permission) return toast('Notifications were not allowed. Allow them in the browser settings.');
      store.set({ profile: { ...store.get().profile, push: true } });
      toast('Notifications on.');
    } catch (e) { toast(e.message || String(e)); }
  },
  async pushTest() {
    try { const r = await call('pushtest', {}); toast(r.ok ? 'Test sent. It should arrive in a few seconds.' : `Test failed: ${r.error || r.skipped || 'no answer'}`); }
    catch (e) { toast(`Test failed: ${e.message}`); }
  },

  /* slice 4: requests and tomorrow, review and send */
  newReq() { openReq(); },
  logReq() { ui.sheet = ''; openReq(); },
  openReq: d => openReq(d.v),
  reqQty: d => { ui.req.qty = Math.max(0, (num(ui.req.qty) || 0) + Number(d.d)); draw(); },
  saveReq(d) {
    const q = ui.req;
    if (!String(q.text || '').trim()) return toast('Write what is needed first.');
    q.text = q.text.trim(); q.qty = num(q.qty);
    edit(r => { r.requests = r.requests || []; const i = r.requests.findIndex(y => y.id === q.id); if (i >= 0) r.requests[i] = q; else r.requests.push(q); r.done.end = false; });
    toast(q.priority === 'Urgent' ? 'Urgent request saved.' : 'Request saved.');
    if (d.v === 'again') openReq(); else go('end');
  },
  deleteReq() {
    if (!confirm('Delete this request?')) return;
    const id = ui.req.id;
    edit(r => { r.requests = r.requests.filter(y => y.id !== id); });
    go('end');
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
    store.set({ profile: { ...store.get().profile, sig: out.toDataURL('image/png') } });
    ui.sig = [];
  },
  wipeSig() { ui.sig = []; draw(); },
  clearSig() { ui.sig = []; store.set({ profile: { ...store.get().profile, sig: '' } }); if (route() !== 'send') go('send'); },
  toSign() { root.querySelector('#sign')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  async openPdf() {
    if (!adminRole()) return pdfRefused();
    ui.pdfBusy = true; draw();
    try { const f = await currentPdf(); window.open(f.url, '_blank'); }
    catch (e) { toast(`The PDF could not be made: ${e.message}`); }
    ui.pdfBusy = false; draw();
  },
  async sharePdf() {
    if (!adminRole()) return pdfRefused();
    try {
      const f = await currentPdf(), file = new File([f.blob], f.name, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: f.name });
      else { const a = document.createElement('a'); a.href = f.url; a.download = f.name; a.click(); }
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
  flip: d => edit(r => { setPath(r, d.f, !getPath(r, d.f)); if (d.f === 'safety.incident') { r.safety.done = false; r.done.safety = false; } }),
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
  newRecv() { openRecv(); },
  logDelivery() { ui.sheet = ''; openRecv(); },
  openRecv: d => openRecv(d.v),
  recvQty: d => { ui.recv.qty = Math.max(0, (num(ui.recv.qty) || 0) + Number(d.d)); draw(); },
  recvPhoto() { ui.camFor = 'recv'; camera(); },
  saveRecv(d) {
    const x = ui.recv;
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
  logPhoto() { ui.sheet = ''; ui.camFor = 'photo'; camera(); },
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
    if (d.v === 'again') { ui.camFor = 'photo'; camera(); } else go(ui.photoBack || 'today');
  },
  async dropPhoto() {
    const p = ui.photo;
    if (ui.photoEditing && !confirm('Delete this photo?')) return;
    edit(r => { r.photos = r.photos.filter(x => x.id !== p.id); r.items.forEach(it => { it.photos = it.photos.filter(x => x !== p.id); }); });
    await deletePhoto(p.id).catch(() => {});
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
let layout = D.layoutOf(innerWidth);
addEventListener('resize', () => { const l = D.layoutOf(innerWidth); if (l !== layout) { layout = l; draw(); } });

/** The open step's tab in the menu. */
const TAB_OF = { reports: 'reports', requests: 'requests', me: 'me' };
/** Screens with a long form: the day column folds away on a computer. */
const FOLD = new Set(['item', 'photo', 'delivery', 'delay', 'request']);

function context() {
  const s = store.get(), p = project();
  const r = report(), t = now();
  const needs = p ? sentBack(monthDays(realToday(), p, s.drafts, s.known)) : [];
  return {
    s, ui, devId: devId(), wide: layout !== 'phone', now: t, today: today(), realToday: realToday(), past: !!ui.date, project: p, report: r, nextNo: p ? nextNo(p) : 1,
    dayOff: p ? (p.nwDow || [0]).includes(weekday(today())) : false, needs,
    fileName: p && r && r.no ? pdfName(p, r.date, r.no) : '',
    evening: !ui.date && !!r && !!r.start && !r.sentAt && t >= '17:00' && s.profile.remind !== false,
  };
}

function route() {
  const s = store.get();
  if (!s.auth) return 'signin';
  if (!s.profile.done) return 'profile';
  if (!project()) return 'choose';
  const h = location.hash.slice(1) || 'today';
  if (NEEDS_REPORT.has(h) && !working()) return 'today';
  if (h === 'item' && !ui.item) return 'work';
  if (h === 'photo' && !ui.photo) return 'today';
  if (h === 'delivery' && !ui.recv) return 'materials';
  if (h === 'delay' && !ui.delay) return 'safety';
  if (h === 'request' && !ui.req) return 'end';
  return SCREENS[h] ? h : 'today';
}

function draw() {
  const r = route(), c = context();
  const setup = r === 'signin' || r === 'profile' || r === 'choose';
  const wide = layout !== 'phone' && !setup;
  // on a computer, Today with a started report shows the summary; the day itself sits in the middle column
  const working = c.report && c.report.start && !c.report.nowork;
  let v = r === 'signin' ? S.signin(c) : r === 'profile' ? S.profile(c) : r === 'choose' ? S.chooseProject(c)
    : wide && r === 'today' && working ? D.glance(c) : SCREENS[r](c);
  if (ui.date && (r === 'today' || NEEDS_REPORT.has(r))) v = { ...v, body: html`${F.pastBand(c)}${v.body}` };
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
    + `${v.tab ? nav(v.tab) : ''}`;
  }
  if (!ui.sheet && !setup && c.s.seenNew !== APP_VERSION) ui.sheet = 'new';
  const sheet = { nowork: S.noWorkSheet, log: S.logSheet, day: F.daySheet, new: F.whatsNewSheet, draft: F.draftSheet }[ui.sheet];
  root.innerHTML += `${sheet ? sheet(c) : ''}`
    + `${ui.toast ? `<div class="toast" role="status">${escText(ui.toast)}</div>` : ''}`
    + `${isDemo() ? '<div class="demo-flag">Demo</div>' : ''}`;
  if (ui.sheetNew) { root.querySelector('.sheet')?.classList.add('new'); ui.sheetNew = false; }
  if (same) { const bd = root.querySelector('.bd'); if (bd) bd.scrollTop = scroll; }
  if (ui.cur != null) root.querySelector(`[data-row="${ui.cur}"]`)?.scrollIntoView({ block: 'nearest' });
  root.querySelectorAll('img[data-photo]').forEach(img => { if (img.getAttribute('src') === 'data:,') photoUrl(img.dataset.photo).then(u => { if (u) img.src = u; }); });
  bindSig();
  if (focus) { const el = root.querySelector(`[data-ui="${focus}"]`); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
}

const escText = s => String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);

/* ---------- events ---------- */

root.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTS[el.dataset.act];
  if (fn) fn(el.dataset, el);
});

root.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.ui) { ui[el.dataset.ui] = el.value; if (el.dataset.ui === 'q') draw(); return; }
  const f = el.dataset.f;
  if (!f) return;
  if (f.startsWith('profile.')) { store.quiet({ profile: { ...store.get().profile, [f.slice(8)]: el.value } }); return; }
  if (isDraft(f)) { setDraft(f, el.value); return; }
  const v = f === 'start.tempC' ? (num(el.value) ?? el.value) : el.value;
  edit(r => setPath(r, f, v), true);
});
root.addEventListener('change', e => { const f = e.target.dataset.f; if (f && !f.startsWith('profile.') && !isDraft(f)) draw(); });

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
  if (k === 'n' && working()) { e.preventDefault(); ui.sheet = 'log'; ui.sheetNew = true; draw(); return; }
  if (/^[1-9]$/.test(k) && working()) {
    const step = STEPS[Number(k) - 1];
    if (S.READY.has(step.id)) go(step.id); else toast('This part comes in the next build.');
    return;
  }
  if (r === 'crew') {
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
  ui.filter = ''; ui.q = ''; ui.ot = null; ui.sheet = ''; ui.cur = null;
  const h = location.hash.slice(1);
  if (h !== 'item') { stopListening(); ui.item = null; }
  if (h !== 'photo') ui.photo = null;
  if (h !== 'delivery') ui.recv = null;
  if (h !== 'delay') ui.delay = null;
  if (h !== 'request') ui.req = null;
  draw();
  if (h === 'reports') checkStatus();
  if (h === 'me' || h === 'today') devCheck();
  if (h === 'today') oldAppWork();
  if (h === 'today' || h === '') pullDraft();
});
window.addEventListener('online', () => { flush(); checkStatus(); });
setInterval(remindTick, 60e3);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
store.subscribe(draw);

draw();
if (store.get().auth) { flush(); if (!demo) loadProjects().then(() => { checkStatus(); pullDraft(); }).catch(() => {}); else checkStatus(); devCheck(); }
oldAppWork();
remindTick();
