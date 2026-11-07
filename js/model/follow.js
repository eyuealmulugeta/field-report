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
      row.late = lateTag(d, r.firstSentAt || r.sentAt, lateAfter(project));   // 2.47.0: a re-send after a send-back keeps the first send's tag
    } else if (r && r.queuedAt) row.kind = 'queued';
    else if (r && r.start) row.kind = d === today ? 'today' : 'draft';
    else row.kind = d === today ? 'today' : isOff(project, d) ? 'off' : 'missing';
    const o = sent.get(d);
    // 2.41.0: 'queued' too: a report this phone kept but the Admin or another phone sent is sent, not "Not sent yet"
    if (o && ['today', 'draft', 'missing', 'off', 'queued'].includes(row.kind)) {
      // 2.12.2: a live answer from Central Hub (known) wins over the script's list of the project's reports
      const ko = (o.name && known[o.name]) || {}, st = ko.status || o.status;
      Object.assign(row, { kind: st === 'approved' || st === 'changes' ? st : 'submitted', no: Number(o.no) || o.no, name: o.name, version: ko.version || o.version || 1, by: o.by || '', other: true });
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

/** What's new in 2.0, shown once. */
export const WHATS_NEW = [
  ['cam', 'Technicians share work photos (2.66.0)', 'A technician account opens only Share work: photos of the work done, the task and a note. A blurred or dark photo is refused on the phone. The Site Engineer or PM approves it in Review, Photos, or rejects it with a reason.'],
  ['users', 'Time used is recorded (2.65.0)', 'As with sign-ins, the minutes you actively use Field Report and Central Hub (tapping, typing, scrolling) are recorded for the company. Only the Admin and the GM see them.'],
  ['sun', 'Next 3 days (2.64.0)', 'Today shows the forecast at the site for the next 3 days, heavy rain in red. It needs the site position, set in Central Hub, Reports, Weather; the same position fills in the weather on the report.'],
  ['doc', 'Issue for a task (2.63.0)', 'Store, Issue: choose the schedule task the material is for. Central Hub compares what was issued with what the work done should have used.'],
  ['doc', 'Deliveries against purchase orders (2.62.0)', 'Store, Receive: choose the purchase order the goods came on; the supplier fills in and the items are the PO lines. Store shows the deliveries still to come per PO, late ones first.'],
  ['doc', 'Store (2.61.0)', 'Review, Store: receive (with a photo of the delivery note), issue (the receiver signs), return, transfer to another project and the weekly stock count. The PM approves every movement; the PE or GM approves count differences. The PM sets the store keeper and the minimums.'],
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
