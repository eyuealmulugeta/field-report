// Slice 5: after sending. Every day of the month with its status (from the reports on this phone and the
// office's answer read with the script's `status` action), what needs the engineer, and the requests sent.

import { addDays, weekday } from '../core/util.js';
import { pdfName } from '../core/names.js';
import { requestReady } from './end.js';

/** What the office's status is called on the phone, and its colour. */
export const STATUS = {
  approved: { label: 'Approved', cls: 'ok' },
  changes: { label: 'Sent back', cls: 'bad' },
  submitted: { label: 'Waiting', cls: 'info' },
  queued: { label: 'Not sent yet', cls: 'warn' },
  draft: { label: 'Not sent', cls: 'warn' },
  missing: { label: 'Missing', cls: 'bad' },
  off: { label: 'Off', cls: 'muted' },
  dayoff: { label: 'Day off', cls: 'muted' },   // 3.6.0: marked by the GM or the PE
  nowork: { label: 'No work', cls: 'muted' },
  today: { label: 'Today', cls: 'info' },
};
/** 3.6.0: the reasons for a day marked off (the script's DOFF_KINDS). */
export const DAYOFF_KINDS = ['Holiday', 'Weather', 'Client stop', 'Other'];
/** 3.6.0: the script's dayOff map as entries of the project's "others" list. */
export const offEntries = m => Object.entries(m || {}).map(([date, off]) => ({ date, off }));
/** 3.7.0: the office's line for a report sent with fewer than 12 photos. */
export const fewLine = f => `Submitted with ${f.n} photo${f.n === 1 ? '' : 's'} – ${f.why}`;
/** 3.7.0: { n, why } of a report sent with fewer than 12 photos and a reason, else null. */
export const fewOf = r => (r && Array.isArray(r.photos) && r.photos.length < 12 && String(r.fewWhy || '').trim() ? { n: r.photos.length, why: String(r.fewWhy).trim() } : null);
/* 3.8.0 (owner, 18 Nov): "Request report" on a missing day (script 7.70.0). */
export const REQ_GAP_H = 4;   // owner: one request per missing day every 4 hours
const hm = at => { const d = new Date(at); return Number.isNaN(+d) ? '' : d.toTimeString().slice(0, 5); };
/** The due time the form starts with: the end of today ("yyyy-mm-ddT23:59"). */
export const dueDefault = today => `${today}T23:59`;
/** Is a request open (not submitted, not cancelled)? */
export const reqOpen = r => !!r && !r.sub && !r.cx;
/** May another request go now? { ok, next: 'HH:MM' } (one every 4 hours while the day is missing). */
export function reqGap(r, now = Date.now()) {
  if (!r || r.sub || !r.at) return { ok: true, next: '' };
  const t = Date.parse(r.at) + REQ_GAP_H * 3600e3;
  return t <= now ? { ok: true, next: '' } : { ok: false, next: hm(new Date(t).toISOString()) };
}
/** The status line on a missing day: "Requested 10:20 to Abebe · Seen 11:05", "Submitted 14:02", "Request cancelled". */
export function reqLine(r) {
  if (!r || !r.at) return '';
  if (r.sub) return `Requested ${hm(r.at)} · Submitted ${hm(r.sub)}`;
  if (r.cx) return `Request cancelled ${hm(r.cx)}`;
  return `Requested ${hm(r.at)}${r.toName ? ` to ${r.toName}` : ''} by ${r.by}${r.seen ? ` · Seen ${hm(r.seen)}` : ' · Not seen yet'} · due ${String(r.due || '').replace('T', ' ')}`;
}
/** The request's steps for the event log (Requested, Seen, Submitted, Cancelled), newest first. */
export const reqLog = r => ((r && r.log) || []).map(x => ({ text: `Report ${x.e.toLowerCase()}${x.e === 'Requested' && x.to ? ` from ${x.to}` : ''}`, by: x.by, at: x.at })).reverse();
/** The pop-up's requests: open, and not put off with Later during this opening. */
export const popReqs = (list, later = []) => (list || []).filter(r => r && r.date && !later.includes(`${r.proj}|${r.date}`)).sort((a, b) => a.date.localeCompare(b.date));
export const FILTERS = [['', 'All'], ['submitted', 'Waiting'], ['changes', 'Sent back'], ['approved', 'Approved'], ['missing', 'Missing']];

const isOff = (p, d) => (p.nwDow || [0]).includes(weekday(d)) || (p.nonWorking || []).includes(d);

/**
 * The days from the first of the month (or the last 31 days early in a month) to today, newest first:
 * [{ date, no, kind, status, version, comment, report, name }]. `known` is the office's answers by file name.
 */
/** 2.9.0: `others`: the reports of this project sent from any phone (script projectDays): a day this phone has not sent shows them. */
/** 2.80.0: "2026-11" moved by n months; the last day of a month; "November 2026". */
export const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };
export const monthEnd = m => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
export const monthName = m => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/**
 * 2.80.0 (owner, 9 Nov): the days of one month for Reports. This month: up to today; an earlier month: every day of it
 * (its reports from Central Hub in `others`). real = the real today, so an earlier month has no "Today".
 */
export function monthRows(month, real, project, drafts, known = {}, others = []) {
  const past = month < real.slice(0, 7);
  return monthDays(past ? monthEnd(month) : real, project, drafts, known, (others || []).filter(o => String(o.date || '').startsWith(month)), real, past)
    .filter(x => x.date.startsWith(month));
}
export function monthDays(today, project, drafts, known = {}, others = [], real = today, whole = false) {
  const sent = new Map();
  const marked = new Map();   // 3.6.0 (owner, 17 Nov): days the GM or the PE marked as day-off ({ date, off })
  for (const o of others || []) if (o && o.date && o.off) marked.set(o.date, o.off);
  else if (o && o.date && (!sent.has(o.date) || Number(o.no) > Number(sent.get(o.date).no))) sent.set(o.date, o);
  const first = today.slice(0, 8) + '01';
  // days before the first report on this phone are left out: their reports may have come from the old app
  const mine = Object.keys(drafts).filter(k => k.startsWith(project.code + '|')).map(k => k.split('|')[1]).sort()[0] || today;
  // 2.17.0: with the project's reports from Central Hub, the whole month shows (not only from this phone's first)
  const start = Number(today.slice(8)) < 8 ? addDays(today, -31) : first;
  const from = (others || []).length || whole ? start : [start, mine].sort()[1];   // 2.80.0: an earlier month shows all its days
  const out = [];
  for (let d = today; d >= from; d = addDays(d, -1)) {
    const r = drafts[`${project.code}|${d}`];
    const row = { date: d, no: r ? r.no : '', report: r || null, name: r && r.no ? pdfName(project, d, r.no) : '' };
    const k = row.name && known[row.name];
    if (r && r.nowork && !r.start) row.kind = 'nowork';
    else if (r && r.sentAt) {
      row.kind = k ? (k.status === 'approved' || k.status === 'changes' ? k.status : 'submitted') : 'submitted';
      row.version = (k && k.version) || (r.sent && r.sent.version) || 1;
      row.comment = k && k.comments && k.comments.length ? k.comments[k.comments.length - 1] : null;
      row.changed = r.updated > r.sentAt + 1000;
      row.last = lastStep(k && k.history) || { kind: 'submit', at: r.sentAt };   // 2.17.0
      row.late = lateTag(d, r.firstSentAt || r.sentAt, lateAfter(project));   // 2.47.0: a re-send after a send-back keeps the first send's tag
    } else if (r && r.queuedAt) row.kind = 'queued';
    else if (r && r.start) row.kind = d === real ? 'today' : 'draft';
    else row.kind = d === real && !marked.has(d) ? 'today' : isOff(project, d) ? 'off' : marked.has(d) ? 'dayoff' : 'missing';
    if (marked.has(d)) row.off = marked.get(d);
    const o = sent.get(d);
    // 2.41.0: 'queued' too: a report this phone kept but the Admin or another phone sent is sent, not "Not sent yet"
    if (o && ['today', 'draft', 'missing', 'off', 'dayoff', 'queued'].includes(row.kind)) {
      // 2.12.2: a live answer from Central Hub (known) wins over the script's list of the project's reports
      const ko = (o.name && known[o.name]) || {}, st = ko.status || o.status;
      Object.assign(row, { kind: st === 'approved' || st === 'changes' ? st : 'submitted', no: Number(o.no) || o.no, name: o.name, version: ko.version || o.version || 1, by: o.by || '', other: true, at: o.at || '' });
      if (ko.comments && ko.comments.length) row.comment = ko.comments[ko.comments.length - 1];
      row.last = lastStep(ko.history || o.history) || (o.at ? { kind: 'submit', at: o.at, by: o.by } : null);   // 2.17.0
      row.late = lateTag(d, o.at || (row.last && row.last.kind === 'submit' ? row.last.at : ''), lateAfter(project));
    }
    out.push(row);
  }
  return out;
}

/**
 * 2.41.0 (owner, 3 Nov): a report sent after 19:00 on its day is a late submission; sent on a later day, the tag
 * says the day it was sent. '' when on time or not known. Addis Ababa time (UTC+3).
 */
export const LATE_AFTER = '19:00';
/** 2.42.8 (owner): late is 30 minutes after the project's work finish time (Crew & Hours), else 17:00 + 30. */
export function lateAfter(project) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String((project && project.defEnd) || '17:00')) || [0, 17, 0];
  const t = Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2]) + 30);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
export function lateTag(date, at, after = LATE_AFTER) {
  const t = Number(at) || Date.parse(at);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  const a = new Date(t + 3 * 36e5).toISOString(), day = a.slice(0, 10), hm = a.slice(11, 16);
  if (day > date) return `Late submission · sent ${Number(day.slice(8))} ${new Date(`${day}T00:00:00Z`).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
  return day === date && hm >= after ? 'Late submission' : '';
}

/** 2.17.0: the newest step of a report's history (sent, approved, sent back…) with who and when. */
export const lastStep = h => (Array.isArray(h) && h.length ? h.filter(x => x && x.at).slice().sort((a, b) => String(a.at).localeCompare(String(b.at))).pop() || null : null);

/** The office sent these back and they were not sent again since. */
/** 2.7.0: a send that waited for a connection: '' when it went at once (within 2 minutes). */
export function offlineLine(pressed, arrived) {
  const p = Number(pressed) || Date.parse(pressed), a = Number(arrived) || Date.parse(arrived);
  if (!p || !a || a - p < 2 * 60e3) return '';
  const t = x => new Date(x).toTimeString().slice(0, 5), d = x => { const y = new Date(x); return new Date(y.getTime() - y.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };   // 3.1.0: local day
  return `Sent offline at ${t(p)}${d(p) !== d(a) ? ` (${d(p)})` : ''} · reached the office at ${t(a)}${d(p) !== d(a) ? ` (${d(a)})` : ''}`;
}
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
/** 2.8.1: where a notification opens: its own link, else read from its id or its text ("Report No. 41 (19 Oct)"). '' when nowhere. */
export function inboxLink(x, year = new Date().getFullYear()) {
  if (x.l) return x.l;
  const m = /^(rep|rpl|rev)-(\d{4}-\d{2}-\d{2})-([A-Z0-9]+)-(\d+)$/.exec(String(x.c || ''));
  if (m) return `#go=${m[1] === 'rev' ? 'day' : 'review'}/${m[2]}/${m[3]}/${m[4]}`;
  const k = /^(crew|crewok)-([A-Z0-9]+)$/.exec(String(x.c || ''));
  if (k) return `#go=${k[1] === 'crew' ? 'crewrev' : 'crew'}//${k[2]}`;
  const d = /No\.\s*(\d+)\s*\((\d{1,2}) (\w{3})\)/.exec(`${x.h || ''} ${x.m || ''}`);
  if (d && MON[d[3]]) return `#go=day/${year}-${MON[d[3]]}-${d[2].padStart(2, '0')}//${d[1]}`;
  // 2.53.0 (owner): every kind of notification opens its page, not only reports and crew
  const c = String(x.c || ''), h = String(x.h || '');
  if (/^(dev|devok)-/.test(c) || /device/i.test(h)) return '#go=devices';
  if (/^spot-/.test(c) || /^(Spotlight|Visitor)/.test(h)) return '#go=spot';
  if (/^(miss|digest|risk)-/.test(c) || /^(MISSING REPORT|CRITICAL RISK|No work|Report updates)/i.test(h)) return '#go=reports';
  if (/^(me|sus|su)-/.test(c) || /^(Your name|Sign-in refused|Sign-up request)/.test(h)) return '#go=me';
  if (/^(send|urg)-/.test(c) || /^Send today/.test(h)) return '#go=today';
  return /report|approv|changes|comment/i.test(h) ? '#go=reports' : '';
}
export const sentBack = rows => rows.filter(x => x.kind === 'changes' && !x.changed);
/** 2.7.0: what needs the site: reports sent back, and office comments not answered yet (the last word is the office's). */
export function needsYou(rows, known = {}) {
  return rows.filter(x => {
    if (x.kind === 'changes' && !x.changed) return true;
    const cm = (x.name && known[x.name] && known[x.name].comments) || [], last = cm[cm.length - 1];
    return x.kind !== 'approved' && !!last && last.kind === 'comment';
  });
}

/** Reports worth asking the office about: sent in the last weeks and not approved yet. */
export const toCheck = (rows, known, now = Date.now(), every = 10 * 60e3) => rows.filter(x => x.name && x.report && x.report.sentAt && x.kind !== 'approved'
  && !(known[x.name] && now - known[x.name].checked < every));

/** The counts on the filter chips. */
/**
 * 2.75.0 (owner, 8 Nov: "when the project is set to All, report is showing only the approved ones and hiding the rest"):
 * All projects is every project's own list (monthDays: waiting, sent back, approved, missing, today), one after another,
 * newest first, each row with its project. Days off and nothing-to-show days stay out.
 */
export function allDays(today, projects, drafts = {}, known = {}, others = {}, hidden = {}, month = '') {
  return (projects || []).flatMap(p => (month ? monthRows(month, today, p, drafts, known, others[p.code] || []) : monthDays(today, p, drafts, known, others[p.code] || [])).filter(x => x.kind !== 'off' && !hidden[`${p.code}|${x.date}`]).map(x => ({ ...x, p })))
    .sort((a, b) => b.date.localeCompare(a.date) || String(a.p.name).localeCompare(String(b.p.name)) || Number(b.no) - Number(a.no));
}

export const counts = rows => rows.reduce((a, x) => { a[x.kind] = (a[x.kind] || 0) + 1; return a; }, {});

/** Every request written on this phone for the project, newest first: [{ date, no, ...request }]. */
export function allRequests(code, drafts) {
  return Object.keys(drafts).filter(k => k.startsWith(code + '|')).sort().reverse()
    .flatMap(k => (drafts[k].requests || []).filter(requestReady).map(q => ({ ...q, date: drafts[k].date, no: drafts[k].no, sent: !!drafts[k].sentAt })));
}

/**
 * 2.25.0: requests kept on this phone that the shared list does not have yet (never shared, or sharing failed):
 * those of reports not sent yet, and those for another day waiting in the queue. [{ q, date }]
 */
export function unsharedRequests(code, drafts, live = [], queue = []) {
  const there = new Set(live.filter(d => d.fr).map(d => d.fr.id));
  const local = Object.keys(drafts).filter(k => k.startsWith(code + '|')).map(k => drafts[k]).filter(r => r && !r.sentAt)
    .flatMap(r => (r.requests || []).filter(requestReady).map(q => ({ q, date: r.date })));
  const queued = queue.filter(x => x.code === code && x.q).map(x => ({ q: x.q, date: x.date }));
  const seen = new Set();
  return [...local, ...queued].filter(x => !there.has(x.q.id) && !seen.has(x.q.id) && seen.add(x.q.id));
}

/** A request is late when its date has passed. */
export const lateRequest = (q, today) => !!q.neededBy && q.neededBy < today;

/** The draft another phone keeps in the script (text only; photos stay on that phone): use it, ask, or leave it. */
export function draftChoice(remote, local, { today, dev }) {
  if (!remote || !remote.s || !remote.s.fr2 || !remote.s.report) return 'none';
  if (remote.date !== today) return 'none';
  if (!local || !local.start) return 'load';   // 2.53.0: also this phone's own copy, when the phone lost its draft
  if (remote.dev === dev) return 'none';
  if (local.sentAt && !(local.updated > local.sentAt + 1000)) return 'none';
  return remote.at > (local.updated || 0) + 120e3 ? 'ask' : 'none';
}

/**
 * 2.97.0 (owner, 12 Nov: "the images of today's log disappeared"): a camera photo of the report keeps its file on the
 * phone (and its original as o_<id>) even when the report's list lost it. These are the ids taken on `day` (local
 * date from the id's time) that nothing on the phone names any more. `named` = the phone's saved state as text.
 */
export function orphanPhotos(keys, named, day) {
  const all = new Set(keys.map(String));
  return [...all].filter(id => /^[0-9a-z]{6,10}[0-9a-z]{5}$/.test(id) && all.has(`o_${id}`) && !named.includes(id)).filter(id => {
    const t = parseInt(id.slice(0, -5), 36), d = new Date(t);
    return t > 1.7e12 && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === day;
  }).sort();
}

/** 2.97.0: a draft from this person's other phone: its photo list, plus every photo this phone has that it does not name. */
export function keepMine(remote, mine) {
  const here = new Set(((mine && mine.photos) || []).map(x => x.id));
  const theirs = ((remote && remote.photos) || []).filter(x => here.has(x.id) || x.drive);
  const named = new Set(theirs.map(x => x.id));
  return [...theirs, ...((mine && mine.photos) || []).filter(x => !named.has(x.id))];
}

/** What's new in 2.0, shown once. */
export const WHATS_NEW = [
  ['bell', 'Request report (3.8.0)', 'The GM and the project engineer press Request report on a missing day: the site engineer gets a notification and a pop-up each time the app opens, with Start report and Later, until the report is sent. The day shows Requested, Seen and Submitted.'],
  ['check', 'Fewer than 12 photos (3.7.0)', 'A report can be sent with fewer than 12 photos: Send asks why (at least 10 characters). Only the office sees the reason; the PDF shows the photos from the top left. The app now updates by itself when it opens.'],
  ['check', 'Mark as day-off (3.6.0)', 'On Reports, the GM and the project engineer open a Missing day and mark it as a day off with the reason (holiday, weather, client stop or other). It is then not missing: no alert, the report numbers skip it, and Central Hub adds it to the project calendar.'],
  ['check', 'Safer and lighter (3.5.0)', 'The app refuses scripts from unknown places and checks its PDF tools. Field Report 1 is gone. Sent reports older than 60 days leave the phone once their photos are in Drive; they stay in Central Hub and Drive.'],
  ['check', 'One Review page (3.4.0)', 'Review has Pending, Approved, Rejected, Requests and All, with a day and a search. A report shows its photos, scorecard, comments and the full event log, and the list refreshes every minute.'],
  ['doc', 'Report numbers count working days (3.3.0)', 'A report number now counts every working day, with or without a report; only the project days off are skipped. Past reports show their new numbers once the office renumbers them.'],
  ['doc', 'One report for everyone (3.2.0)', 'The PDF is the same for the client and the office: page 2 has the 12 chosen photos, 3 across and 4 down, each with a thin grey border. Prepared by is on the left, Approved by on the right. Every other photo stays on the Dashboard and in Drive.'],
  ['doc', 'Reports show everything (3.1.0)', 'View opens the report as it was sent, with every photo, also from Review. The day and time of a send are local. The scorecard counts a late send as sent and shows the attendance cutoff. The event log lists Submitted, each edit with the parts changed, and Approved. The notifications list closes when you tap elsewhere.'],
  ['doc', 'All projects shows every report (2.75.0)', 'With All projects chosen, Reports lists each project’s month like its own page: waiting, sent back, approved, missing and today, with their own filter starting on All.'],
  ['doc', 'Turned off (2.74.2)', 'A feature the Admin turns off in Central Hub now keeps its tab, marked Off, and opens on a Turned off notice instead of disappearing. Its buttons say Turned off when tapped.'],
  ['chat', 'A new Discuss page (2.74.1)', 'Conversations along the top with unread counts, messages by day, the writing box at the bottom. Tap your own message to Edit it (first minute) or Delete it. The Discuss tab shows how many messages are new. A phone signed in with another account no longer keeps the last person\'s name or signature.'],
  ['doc', 'Features on or off (2.74.0)', 'The Admin can switch a Field Report feature off in Central Hub (Settings, Apps): it disappears from every phone within seconds and comes back when switched on. Nothing is deleted.'],
  ['users', 'PE and PM are one title (2.73.1)', 'Everything that said PM now says PE (Project Engineer). Discuss: correct a message in the first minute; Delete removes it for everyone in the first 5 minutes, after that only from your view.'],
  ['chat', 'Discuss with Central Hub (2.73.0)', 'The new Discuss tab: write in your project channel with everyone in Central Hub, or one-to-one. A new message rings and shows a note. Correct a message in the first minute. Delete removes it for everyone in the first 5 minutes, after that only from your view.'],
  ['users', 'Approved crew reaches Central Hub at once (2.72.0)', 'Crew you approve on the phone is added to the project in Central Hub within seconds.'],
  ['users', 'Crew Edit and nationality (2.71.0)', 'Edit on a crew member no longer opens Google: if the employee data cannot open, it says why. Nationality is chosen from every country in the world.'],
  ['users', 'Project not linked (2.70.0)', 'If your email is not on this project in Central Hub, a bar at the top says so: approvals and changes cannot arrive by themselves until the Admin puts you on the project in the Manpower Directory.'],
  ['doc', 'Reports waiting for the database (2.69.0)', 'If a sent report has not reached the database, a bar at the top says how many, why, and sends them again when you tap it.'],
  ['bell', 'Open and Remind later (2.68.0)', 'A new report\'s notification now has Open, which goes straight to that report with Approve, Send back, Comment and Remove, and Remind later, which brings the notification back in 30 minutes.'],
  ['doc', 'Cash purchases in the store (2.67.0)', 'Store, Receive with no purchase order: choose the approved cash expense the material was bought with. Central Hub then stops showing it as a cash purchase with no receipt.'],
  ['cam', 'Technicians share work photos (2.66.0)', 'A technician account opens only Share work: photos of the work done, the task and a note. A blurred or dark photo is refused on the phone. The Site Engineer or PE approves it in Review, Photos, or rejects it with a reason.'],
  ['users', 'Time used is recorded (2.65.0)', 'As with sign-ins, the minutes you actively use Field Report and Central Hub (tapping, typing, scrolling) are recorded for the company. Only the Admin and the GM see them.'],
  ['sun', 'Next 3 days (2.64.0)', 'Today shows the forecast at the site for the next 3 days, heavy rain in red. It needs the site position, set in Central Hub, Reports, Weather; the same position fills in the weather on the report.'],
  ['doc', 'Issue for a task (2.63.0)', 'Store, Issue: choose the schedule task the material is for. Central Hub compares what was issued with what the work done should have used.'],
  ['doc', 'Deliveries against purchase orders (2.62.0)', 'Store, Receive: choose the purchase order the goods came on; the supplier fills in and the items are the PO lines. Store shows the deliveries still to come per PO, late ones first.'],
  ['doc', 'Store (2.61.0)', 'Review, Store: receive (with a photo of the delivery note), issue (the receiver signs), return, transfer to another project and the weekly stock count. The PE approves every movement; the PE or GM approves count differences. The PE sets the store keeper and the minimums.'],
  ['doc', 'One row of actions on a report (2.42.0)', 'Tap a report on Reports: View, Share, Edit, Comment, Send back (Project engineer and GM) and Remove. Me is shorter, with Crew & Hours where Your usual day was. Live updates and notifications are on by default. A page reloaded stays where it was.'],
  ['users', 'Crew changes need the Project engineer or the GM (2.41.0)', 'A Site engineer asks to delete a crew member or add labour; the Project engineer or the GM confirms, and a deleted person leaves the list here and in Central Hub. Reports sent after 19:00 are tagged Late submission, with the day sent when it was a later day. Check again is now Refresh.'],
  ['plus', 'Log now is in Quick (2.39.0)', 'Quick holds Log now (work, photo, delay, delivery, request, incident, say it) and your shortcuts. Requests show the same on every phone and can be deleted (the list says who removed it and when). Opened notifications leave the count.'],
  ['doc', 'Easier to read on a computer (2.38.0)', 'On a computer the Reports list reads down the first column, then the second, and the text is a little smaller. Office attendance no longer shows the project sheet.'],
  ['bell', 'Notifications circle and the new rating (2.37.0)', 'Notifications now sit in a circle at the top right: tap it to read them, Clear to empty it. Review and Crew & Hours open from Me. Check again shows All first. The rating wants the report sent before 17:30 and asks for the progress of each work item.'],
  ['users', 'Correct the crew (2.36.0)', "The project's Site Engineer, Project Engineer and the GM can correct any crew member's name, trade and phone in Office attendance (Edit). Central Hub and the Manpower Directory get it."],
  ['alert', 'Database copy of every report (2.35.0)', 'If the phone is no longer signed in to the database, a red bar says so: tap it to sign in again. Reports sent meanwhile are copied there once you are back.'],
  ['bell', 'Urgent notices (2.34.0)', "An urgent notice from the GM covers the screen until you tap I've read it, or send a different reply. It also comes as a phone notification."],
  ['users', 'Attendance shared and confirmed (2.33.0)', "Today's marks show at once on Central Hub's attendance sheet. When everyone is marked, tap Confirm the attendance is correct; if a mark changes later, confirm again."],
  ['check', 'Install, red steps, Gallery (2.32.0)', 'Opened in a browser, Field Report offers to install itself on the phone. A step with nothing in yet is red. The GM can add report photos from the Gallery; they are marked as such.'],
  ['money', 'Who approves an expense (2.31.0)', 'The Site Engineer approves up to 5,000 ETB, the Project Engineer up to 20,000 ETB; above that, and any amount in USD, the GM. Each expense says whom it is waiting for.'],
  ['money', 'Expenses (2.29.0)', 'In Requests choose Expense: the amount in ETB or USD, the category, who was paid and a photo of the receipt. It is approved in Central Hub by position and amount (2.31.0); you see each step here.'],
  ['bell', 'Reminder to send (2.28.0)', 'When today’s report has 8 or more of its 9 steps done but is not sent, the people who worked on it are reminded at 17:30, 18:00 and 18:30. Spotlight: the Gallery button.'],
  ['check', 'Who and when, and the new rating (2.27.0)', 'Each step on Today shows who changed it last and at what time. The engagement rating has four checks: photos in the morning, midday and afternoon; most sections filled in; attendance marked on time; the report sent before 18:00. They show on Review and send and in Reports. Spotlight takes photos and videos from the gallery too, several at once.'],
  ['user', 'Office attendance (2.10.0)', 'Attendance has its own tab, Office attendance. The list is the crew the office allocated in Central Hub and is checked again each time you open it. People working on site who are not on the list: Add labour on site for approval; once approved they join the list.'],
  ['check', 'Sent from any phone (2.9.0)', 'A report sent from another phone of the project shows as Submitted (or Approved) on every phone, in Reports and on Today.'],
  ['user', 'Me at the top right, the day at a glance (2.8.0)', 'Me is the round button at the top right. Today starts with steps, crew in, what needs you and Attention. Long-press the app icon for Report, Attendance, Spotlight and Attention. Review and Reports list your projects. The signature pad turns sideways to sign. The report reminder is set with the project\'s working hours. Trades are picked from a list, with Add for a new one. Log: Activity photo.'],
  ['cam', 'Spotlight: Photo, Video and the gallery (2.7.1)', 'Photo and Video open the camera straight away. A video bigger than 20 MB is made smaller on the phone instead of being refused: keep the screen open while it runs.'],
  ['alert', 'One account, Attention, Spotlight (2.7.0)', 'The PE and GM write reports in the same account and have Review. Attention puts a serious issue for the client in a red box on the report. Spotlight sends a note with photos or videos to Central Hub. Weather in 8 terms with pictures, safety gear ticks, working hours per project (late = start + 15 min), replies to the office, notifications open their item, and a report sent offline shows both times.'],
  ['acc', 'Reviewer and reporter accounts (2.6.0)', 'The Project engineer account opens on Review: approve, send back or comment, and the answer goes to the person who sent the report only. Crew: give the wages of the people the site sent and approve them. The site sends names and trades only. To write a report, a manager uses a separate reporter account.'],
  ['cam', 'Crew photo, crew list, camera only (2.5.0)', 'Take the morning crew photo on Attendance: on time until 8:00, late until 8:15. Send your crew list with daily wages for the office to approve. Report photos come from the camera only; a delivery starts with its photo.'],
  ['user', 'Sign up and sign full screen (2.4.0)', 'A new person signs up and waits for the office. Sign full screen, or choose a PNG; your signature follows you to a new phone. One report per project and day, shared by everyone on it.'],
  ['cam', 'Photos kept in Drive (2.1.0)', 'Your photos go to the office with the report when you send it. A week later they leave the phone to free space; they stay in Drive.'],
  ['user', 'Name, position and signature (2.0.2)', 'The office confirms your name and position; they go on every report. Tap your saved signature to sign.'],
  ['bell', 'Notifications on Today (2.0.1)', 'Everything the office and Field Report sent you is listed at the top of Today, with who sent it.'],
  ['home', 'The day in three parts', 'Morning, during the day, end of day. Each step shows what is already in.'],
  ['plus', 'Log as it happens', 'The + button: work done, photo, delay, delivery, request, incident, or say it.'],
  ['users', 'Manpower from attendance', 'Mark who is absent; trades and man-hours are counted for you.'],
  ['copy', 'Yesterday carries over', "Hours, weather, machines and yesterday's plan start today's report."],
  ['send', 'Check, sign once, send', 'Warnings never block. No signal: it is sent by itself later.'],
  ['doc', 'Follow your reports', 'Reports shows Waiting, Sent back and Approved; Today shows what needs you.'],
];

/**
 * 3.1.0 (owner, 15 Nov: "the event log is missing Submitted, Edit (with the fields changed) and Approved"): every step of a
 * report in one list, newest first: Submitted (and sent again), each edit with the parts changed, and the office's answers.
 */
export function eventLog(r, history = [], { by = '', at = '', few = null } = {}, stepTitle = id => id) {
  const out = [];
  const sentFirst = (r && (r.firstSentAt || r.sentAt)) || Date.parse(at) || 0;
  // 3.7.0 (owner, 18 Nov): `few` ({ n, why }) only for the office: "Submitted with 5 photos – reason"
  if (sentFirst) out.push({ kind: 'submit', text: few ? fewLine(few) : 'Submitted', by: (r && r._by) || by || ((r && r.edits || [])[0] || {}).by || '', at: new Date(sentFirst).toISOString() });
  if (r && r.sentAt && r.firstSentAt && r.sentAt - r.firstSentAt > 60e3) out.push({ kind: 'submit', text: 'Sent again', by: (r.edits || []).filter(e => e.after).map(e => e.by).at(-1) || by, at: new Date(r.sentAt).toISOString() });
  for (const e of (r && r.edits) || []) if (e && e.at > 1e12) out.push({ kind: 'edit', text: `${e.after ? 'Edited after sending' : 'Edited'}${(e.parts || []).length ? `: ${e.parts.map(stepTitle).join(', ')}` : ''}`, by: e.by, at: new Date(e.at).toISOString() });
  const word = { approve: 'Approved', changes: 'Sent back', reopen: 'Reopened', comment: 'Comment', reply: 'Reply', return: 'Returned', office: 'Corrected by the office', submit: 'Submitted' };
  for (const h of history || []) if (h && h.at && !(h.kind === 'submit' && sentFirst)) out.push({ kind: h.kind, text: h.text ? `${word[h.kind] || h.kind}: ${h.text}` : word[h.kind] || h.kind, by: h.by || 'Office', at: h.at });
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
