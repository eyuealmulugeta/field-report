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
  nowork: { label: 'No work', cls: 'muted' },
  today: { label: 'Today', cls: 'info' },
};
export const FILTERS = [['', 'All'], ['submitted', 'Waiting'], ['changes', 'Sent back'], ['approved', 'Approved'], ['missing', 'Missing']];

const isOff = (p, d) => (p.nwDow || [0]).includes(weekday(d)) || (p.nonWorking || []).includes(d);

/**
 * The days from the first of the month (or the last 31 days early in a month) to today, newest first:
 * [{ date, no, kind, status, version, comment, report, name }]. `known` is the office's answers by file name.
 */
/** 2.9.0: `others`: the reports of this project sent from any phone (script projectDays): a day this phone has not sent shows them. */
export function monthDays(today, project, drafts, known = {}, others = []) {
  const sent = new Map();
  for (const o of others || []) if (o && o.date && (!sent.has(o.date) || Number(o.no) > Number(sent.get(o.date).no))) sent.set(o.date, o);
  const first = today.slice(0, 8) + '01';
  // days before the first report on this phone are left out: their reports may have come from the old app
  const mine = Object.keys(drafts).filter(k => k.startsWith(project.code + '|')).map(k => k.split('|')[1]).sort()[0] || today;
  // 2.17.0: with the project's reports from Central Hub, the whole month shows (not only from this phone's first)
  const start = Number(today.slice(8)) < 8 ? addDays(today, -31) : first;
  const from = (others || []).length ? start : [start, mine].sort()[1];
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
    } else if (r && r.queuedAt) row.kind = 'queued';
    else if (r && r.start) row.kind = d === today ? 'today' : 'draft';
    else row.kind = d === today ? 'today' : isOff(project, d) ? 'off' : 'missing';
    const o = sent.get(d);
    if (o && ['today', 'draft', 'missing', 'off'].includes(row.kind)) {
      // 2.12.2: a live answer from Central Hub (known) wins over the script's list of the project's reports
      const ko = (o.name && known[o.name]) || {}, st = ko.status || o.status;
      Object.assign(row, { kind: st === 'approved' || st === 'changes' ? st : 'submitted', no: Number(o.no) || o.no, name: o.name, version: ko.version || o.version || 1, by: o.by || '', other: true });
      if (ko.comments && ko.comments.length) row.comment = ko.comments[ko.comments.length - 1];
      row.last = lastStep(ko.history || o.history) || (o.at ? { kind: 'submit', at: o.at, by: o.by } : null);   // 2.17.0
    }
    out.push(row);
  }
  return out;
}

/** 2.17.0: the newest step of a report's history (sent, approved, sent back…) with who and when. */
export const lastStep = h => (Array.isArray(h) && h.length ? h.filter(x => x && x.at).slice().sort((a, b) => String(a.at).localeCompare(String(b.at))).pop() || null : null);

/** The office sent these back and they were not sent again since. */
/** 2.7.0: a send that waited for a connection: '' when it went at once (within 2 minutes). */
export function offlineLine(pressed, arrived) {
  const p = Number(pressed) || Date.parse(pressed), a = Number(arrived) || Date.parse(arrived);
  if (!p || !a || a - p < 2 * 60e3) return '';
  const t = x => new Date(x).toTimeString().slice(0, 5), d = x => new Date(x).toISOString().slice(0, 10);
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
  return /report|approv|changes|comment/i.test(`${x.h || ''}`) ? '#go=reports' : '';
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
  if (remote.dev === dev || remote.date !== today) return 'none';
  if (!local || !local.start) return 'load';
  if (local.sentAt && !(local.updated > local.sentAt + 1000)) return 'none';
  return remote.at > (local.updated || 0) + 120e3 ? 'ask' : 'none';
}

/** What's new in 2.0, shown once. */
export const WHATS_NEW = [
  ['check', 'Who and when, and the new rating (2.27.0)', 'Each step on Today shows who changed it last and at what time. The engagement rating has four checks: photos in the morning, midday and afternoon; most sections filled in; attendance marked on time; the report sent before 18:00. They show on Review and send and in Reports. Spotlight takes photos and videos from the gallery too, several at once.'],
  ['user', 'Office attendance (2.10.0)', 'Attendance has its own tab, Office attendance. The list is the crew the office allocated in Central Hub and is checked again each time you open it. People working on site who are not on the list: Add labour on site for approval; once approved they join the list.'],
  ['check', 'Sent from any phone (2.9.0)', 'A report sent from another phone of the project shows as Submitted (or Approved) on every phone, in Reports and on Today.'],
  ['user', 'Me at the top right, the day at a glance (2.8.0)', 'Me is the round button at the top right. Today starts with steps, crew in, what needs you and Attention. Long-press the app icon for Report, Attendance, Spotlight and Attention. Review and Reports list your projects. The signature pad turns sideways to sign. The report reminder is set with the project\'s working hours. Trades are picked from a list, with Add for a new one. Log: Activity photo.'],
  ['cam', 'Spotlight: Photo, Video and the gallery (2.7.1)', 'Photo and Video open the camera straight away. A video bigger than 20 MB is made smaller on the phone instead of being refused: keep the screen open while it runs.'],
  ['alert', 'One account, Attention, Spotlight (2.7.0)', 'The PM and GM write reports in the same account and have Review. Attention puts a serious issue for the client in a red box on the report. Spotlight sends a note with photos or videos to Central Hub. Weather in 8 terms with pictures, safety gear ticks, working hours per project (late = start + 15 min), replies to the office, notifications open their item, and a report sent offline shows both times.'],
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
