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
export function monthDays(today, project, drafts, known = {}) {
  const first = today.slice(0, 8) + '01';
  // days before the first report on this phone are left out: their reports may have come from the old app
  const mine = Object.keys(drafts).filter(k => k.startsWith(project.code + '|')).map(k => k.split('|')[1]).sort()[0] || today;
  const from = [Number(today.slice(8)) < 8 ? addDays(today, -31) : first, mine].sort()[1];
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
    } else if (r && r.queuedAt) row.kind = 'queued';
    else if (r && r.start) row.kind = d === today ? 'today' : 'draft';
    else row.kind = d === today ? 'today' : isOff(project, d) ? 'off' : 'missing';
    out.push(row);
  }
  return out;
}

/** The office sent these back and they were not sent again since. */
export const sentBack = rows => rows.filter(x => x.kind === 'changes' && !x.changed);

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
