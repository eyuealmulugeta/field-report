// Slice 5: Reports (every day of the month and the office's answer), one day's sheet, Requests,
// "What's new" and the draft found on another phone. Screens return { head, body, foot, tab }.

import { html, icon } from '../core/dom.js';
import { dayLabel, localDay } from '../core/util.js';
import { head, isGM } from './parts.js';
import * as L from '../core/live.js';   // 2.42.0: seenFrom
import { STATUS, FILTERS, monthDays, monthRows, monthName, allDays, counts, allRequests, lateRequest, WHATS_NEW, lastStep, unsharedRequests, eventLog, DAYOFF_KINDS, fewOf, reqLine, reqLog, reqOpen, reqGap, popReqs, startOf, naLog } from '../model/follow.js';
import { STEPS } from '../model/report.js';
import { requestLine } from '../model/end.js';
import { canPdf } from './view.js';
import { rateReport, rateLine, checkLines } from '../model/rating.js';

// 3.1.0 (owner, 15 Nov): the day in local time, not UTC (a report sent after 21:00 showed the next day)
const when = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : `${dayLabel(localDay(d))} ${d.toTimeString().slice(0, 5)}`; };
const pill = kind => html`<span class="pill ${STATUS[kind].cls}">${STATUS[kind].label}</span>`;

const STEP_DONE = { submit: 'Sent', approve: 'Approved', changes: 'Sent back', reopen: 'Reopened', comment: 'Comment', reply: 'Reply', return: 'Returned', office: 'Corrected' };
/** 2.17.0: "Approved by Abel · 1 Nov, 09:12": the report's newest step. */
const stepLine = s => (s && s.at ? `${STEP_DONE[s.kind] || 'Sent'}${s.by ? ` by ${s.by}` : ''} · ${stampOf(s.at)}` : '');
const allOn = c => !!c.ui.allProj && isGM(c);
/** 2.80.0 (owner, 9 Nov): Reports by month: < November 2026 >; an earlier month's reports come from Central Hub. */
const monthOf = c => c.ui.rMonth || c.realToday.slice(0, 7);
// 3.10.0: an earlier month also keeps the days marked off or No activity (they come with the project's days)
const marksOf = (c, code, m) => ((c.s.others || {})[code] || []).filter(o => (o.na || o.off) && String(o.date).startsWith(m));
const othersFor = (c, code) => { const m = monthOf(c), cur = m === c.realToday.slice(0, 7), r = (c.ui.mRows || {})[`${code}|${m}`]; return cur ? (c.s.others || {})[code] || [] : r && [...r, ...marksOf(c, code, m)]; };
export function monthBar(c, codes) {
  const m = monthOf(c), cur = m === c.realToday.slice(0, 7), missing = !cur && codes.some(k => !(c.ui.mRows || {})[`${k}|${m}`]);
  const sm = allOn(c) ? '' : startOf(c.project).slice(0, 7);   // 3.10.0: no month before the project start
  return html`<div class="spread rmonth"><button type="button" class="btn t slim" data-act="repMonth" data-v="-1" aria-label="Month before" ${sm && m <= sm ? 'disabled' : ''}>‹</button><b>${monthName(m)}</b><button type="button" class="btn t slim" data-act="repMonth" data-v="1" aria-label="Month after" ${cur ? 'disabled' : ''}>›</button></div>
    ${c.ui.mBusy ? html`<p class="muted small center">Reading ${monthName(m)} from Central Hub…</p>` : missing ? html`<button type="button" class="btn o" data-act="repMonth" data-v="0">Load ${monthName(m)}</button>` : ''}`;
}

/** 2.17.0: the GM's All projects: every report sent on the account's projects, newest first, from Central Hub. */
function allReports(c) {
  // 2.75.0: every project's own list (waiting, sent back, approved, missing, today), with its own filter (starts on All)
  const others = Object.fromEntries((c.s.projects || []).map(p => [p.code, othersFor(c, p.code) || []]));
  const rows = allDays(c.realToday, c.s.projects, c.s.drafts || {}, c.s.known || {}, others, c.s.hidden || {}, monthOf(c));
  const f = c.ui.rfAll || '', n = counts(rows), list = rows.filter(x => !f || x.kind === f);
  return {
    tab: 'reports',
    head: head('Reports', `All projects · ${monthName(monthOf(c))}`, c.ui.checking ? 'Refreshing…' : ''),
    body: html`${monthBar(c, (c.s.projects || []).map(p => p.code))}<div class="chips">${FILTERS.map(([k, t]) => html`<button type="button" class="chip ${f === k ? 'on' : ''}" data-act="pick" data-f="ui.rfAll" data-v="${k}">${t}${k && n[k] ? ` ${n[k]}` : ''}</button>`)}</div>
      ${list.length ? html`<div class="box">${list.map(x => html`<button type="button" class="li day" data-act="openAll" data-p="${x.p.code}" data-v="${x.date}">
        <span class="dnum"><b>${x.date.slice(8)}</b>${dayLabel(x.date).slice(0, 3)}</span>
        <div class="n"><b>${x.p.name} · ${x.no ? `Report #${x.no}` : x.kind === 'today' ? 'Today' : x.kind === 'nowork' ? 'No work' : 'No report'}</b><span>${[x.by, stepLine(x.last)].filter(Boolean).join(' · ')}</span></div>${x.late ? html`<span class="pill warn">${x.late}</span>` : ''}${pill(x.kind)}</button>`)}</div>`
        : html`<div class="box pad muted small">Nothing here.</div>`}`,
  };
}

export function reports(c) {
  if (allOn(c)) return allReports(c);
  const rows = monthRows(monthOf(c), c.realToday, c.project, c.s.drafts, c.s.known, othersFor(c, c.project.code) || []).filter(x => !(c.s.hidden || {})[`${c.project.code}|${x.date}`]);
  const n = counts(rows), f = c.ui.rf || '';
  const list = rows.filter(x => !f || x.kind === f);
  return {
    tab: 'reports',
    head: head('Reports', `${c.project.name} · ${monthName(monthOf(c))}`, c.ui.checking ? 'Refreshing…' : ''),
    // 2.1.1: the button sits at the top; a footer hides the bottom bar (Home, Today…) on a tab page
    body: html`<button type="button" class="btn o" data-act="checkStatus" ${c.ui.checking ? 'disabled' : ''}>${c.ui.checking ? 'Refreshing…' : 'Refresh'}</button>
      ${monthBar(c, [c.project.code])}<div class="chips">${FILTERS.map(([k, t]) => html`<button type="button" class="chip ${f === k ? 'on' : ''}" data-act="pick" data-f="ui.rf" data-v="${k}">${t}${k && n[k] ? ` ${n[k]}` : ''}</button>`)}</div>
      ${list.length ? html`<div class="box">${list.map(x => html`<button type="button" class="li day" data-act="openDay" data-v="${x.date}">
        <span class="dnum"><b>${x.date.slice(8)}</b>${dayLabel(x.date).slice(0, 3)}</span>
        <div class="n"><b>${x.no ? `Report #${x.no}` : x.kind === 'off' ? 'Day off' : x.kind === 'dayoff' ? `Day off · ${x.off.k}` : x.kind === 'noact' ? 'No activity' : x.kind === 'today' ? 'Today' : 'No report'}${x.version > 1 ? ` · version ${x.version}` : ''}</b>
          <span>${x.other ? `Sent by ${x.by || 'another phone'}` : x.comment ? (x.comment.text ? `${x.comment.by || 'Office'}: ${x.comment.text}` : x.comment.kind === 'approve' ? `Approved by ${x.comment.by || 'the office'}` : '') : x.kind === 'dayoff' ? `Marked by ${x.off.by}${x.off.note ? `: ${x.off.note}` : ''}` : x.kind === 'noact' ? html`<span title="${x.na.why}">${x.na.why} · ${x.na.by}</span>` : x.changed ? 'Changed since sent' : x.kind === 'nowork' ? `No work: ${x.report.nowork.reason}` : ''}${x.last && x.last.at ? ` · ${stepLine(x.last)}` : ''}</span></div>
        ${x.late ? html`<span class="pill warn">${x.late}</span>` : ''}${pill(x.kind)}</button>`)}</div>`
        : html`<div class="box pad muted small">Nothing here.</div>`}
      <p class="muted tiny center">The office's answers are checked when the app opens and every 10 minutes${c.s.knownAt ? ` · last ${new Date(c.s.knownAt).toTimeString().slice(0, 5)}` : ''}.</p>`,
  };
}

/** One day: status, the office's comments and history, and what can be done. */
const STEP = { submit: 'Sent', approve: 'Approved', changes: 'Sent back', reopen: 'Reopened', comment: 'Comment', reply: 'Reply', return: 'Returned', office: 'Corrected by the office' };
/** 2.13.0: "1 Nov, 09:12". */
export const stampOf = at => (at && !Number.isNaN(Date.parse(at)) ? new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

/** 2.24.0: the office corrected the report in Central Hub: its copy there is the newest version (who, when, what changed). */
export const officeLine = steps => {
  const o = steps.find(m => m.kind === 'office');
  return o ? html`<p class="callout warn"><b>Corrected by the office (${o.by || 'Office'}, ${stampOf(o.at)}).</b> The office copy in Central Hub is the newest version${o.text ? `: ${o.text}` : '.'}</p>` : '';
};

/** 3.1.0: the rating of a day uses its send time, also when another phone sent it (this phone's copy is older). */
const rated = x => (x.other ? { ...x.report, firstSentAt: Date.parse(x.at || '') || x.report.firstSentAt || 0, _sent: true } : x.report);

export function daySheet(c) {
  // 2.80.0: a day of an earlier month (Reports by month) is found in that month's reports from Central Hub
  const dm = String(c.ui.daySel || '').slice(0, 7), old = dm && dm < c.realToday.slice(0, 7) && (c.ui.mRows || {})[`${c.project.code}|${dm}`];
  const x = (old ? monthRows(dm, c.realToday, c.project, c.s.drafts, c.s.known, [...old, ...marksOf(c, c.project.code, dm)]) : monthDays(c.realToday, c.project, c.s.drafts, c.s.known, (c.s.others || {})[c.project.code])).find(y => y.date === c.ui.daySel);
  if (!x) return '';
  const k = (x.name && c.s.known[x.name]) || {};
  const comments = k.comments || [];
  // 2.13.0: every step of the report with its date and time (approved, sent back, reopened, comments), newest first
  const steps = (k.history && k.history.length ? k.history : comments).filter(m => m.at).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const canWrite = x.kind !== 'approved' && x.kind !== 'nowork';
  const may = c.kind === 'reviewer';   // 2.42.0 (owner): View, Share, Edit, Comment, Send back, Remove in one row
  return html`<div class="dim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-label="Report of ${dayLabel(x.date)}">
    <div class="grab"></div><div class="spread"><b class="big-t">${dayLabel(x.date)}${x.no ? ` · #${x.no}` : ''}</b>${pill(x.kind)}</div>
    ${x.name ? html`<div class="muted tiny">${x.name}${x.version ? ` · version ${x.version}` : ''}</div>` : ''}
    ${x.report && x.report.start ? (rt => html`<div class="soft small"><b>${rateLine(rt)}</b><ul class="checks">${checkLines(rt).map(l => html`<li>${l}</li>`)}</ul></div>`)(rateReport(rated(x))) : ''}
    ${(log => log.length ? html`<div class="k">Event log</div><div class="box">${log.slice(0, 14).map(m => html`<div class="li"><span class="ic ${m.kind === 'changes' ? 'bad' : m.kind === 'approve' ? 'ok' : ''}">${icon(m.kind === 'approve' ? 'check' : 'doc')}</span>
      <div class="n"><b>${m.text}</b><span>${m.by || 'Office'} · ${stampOf(m.at)}</span></div></div>`)}</div>` : '')(eventLog(x.other ? null : x.report, steps, { by: x.by, at: x.at || (x.last && x.last.kind === 'submit' ? x.last.at : ''), few: may || isGM(c) ? fewOf(x.report) : null }, id => (STEPS.find(t => t.id === id) || {}).title || id))}
    ${officeLine(steps)}
    ${x.kind === 'changes' ? html`<p class="callout bad">The office sent this report back. Open it, fix what they asked, and send it again.</p>` : ''}
    ${x.kind === 'missing' ? html`<p class="small muted">No report on this phone for this day.</p>` : ''}
    ${(r => r ? html`<div class="k">Report request</div><p class="callout ${reqOpen(r) ? 'warn' : ''} small">${reqLine(r)}${r.note ? html`<br>Note: ${r.note}` : ''}</p>
      <div class="box">${reqLog(r).map(m => html`<div class="li"><span class="ic">${icon('bell')}</span><div class="n"><b>${m.text}</b><span>${m.by || ''} · ${stampOf(m.at)}</span></div></div>`)}</div>` : '')(reqOf(c, x.date))}   <!-- 3.8.0 -->
    ${x.kind === 'missing' && may ? html`<button type="button" class="btn p" data-act="reqOpen" data-v="${x.date}" data-n="${x.no || ''}">${icon('bell')}Request report</button>` : ''}
    ${x.kind === 'missing' && may ? html`<div class="k">Mark as day-off</div><div class="chips">${DAYOFF_KINDS.map(k => html`<button type="button" class="chip ${(c.ui.offK || 'Holiday') === k ? 'on' : ''}" data-act="pick" data-f="ui.offK" data-v="${k}">${k}</button>`)}</div>
      <input class="fld" maxlength="80" data-ui="offNote" placeholder="Note (optional)" value="${c.ui.offNote || ''}">
      <button type="button" class="btn o" data-act="dayOff" data-v="${x.date}" ${c.ui.busy ? 'disabled' : ''}>Mark as day-off</button>` : ''}   <!-- 3.6.0 (owner, 17 Nov): the GM and the PE -->
    ${x.kind === 'missing' && may ? html`<div class="k">Mark as No activity</div><p class="muted tiny">A working day: it keeps its report number, is not missing and gets no Request report.</p>
      <input class="fld" maxlength="120" data-ui="naWhy" placeholder="Reason (required)" value="${c.ui.naWhy || ''}">
      <button type="button" class="btn o" data-act="noAct" data-v="${x.date}" ${c.ui.busy ? 'disabled' : ''}>${icon('pause')}Mark No activity</button>` : ''}   <!-- 3.10.0 (owner, 19 Nov) -->
    ${x.kind === 'noact' ? html`<p class="callout na-c">${icon('pause')} No activity · <b>${x.na.why}</b> · marked by ${x.na.by}${x.na.at ? `, ${stampOf(x.na.at)}` : ''}. Not missing; it keeps report #${x.no || '–'}.</p>
      <div class="box">${naLog(x.na).map(m => html`<div class="li"><span class="ic">${icon('pause')}</span><div class="n"><b>${m.e}: ${m.why}</b><span>${m.by || ''} · ${stampOf(m.at)}</span></div></div>`)}</div>
      ${isGM(c) ? html`<input class="fld" maxlength="120" data-ui="naWhy" placeholder="New reason" value="${c.ui.naWhy || ''}">
        <div class="day-acts"><button type="button" class="btn o slim" data-act="noAct" data-v="${x.date}" ${c.ui.busy ? 'disabled' : ''}>Change reason</button>
        <button type="button" class="btn t slim bad-t" data-act="noActUndo" data-v="${x.date}" ${c.ui.busy ? 'disabled' : ''}>Remove</button></div>` : html`<p class="muted tiny">Only the Admin changes or removes it.</p>`}` : ''}
    ${x.kind === 'dayoff' ? html`<p class="callout">Day off · <b>${x.off.k}</b>${x.off.note ? ` · ${x.off.note}` : ''} · marked by ${x.off.by}${x.off.at ? `, ${stampOf(x.off.at)}` : ''}. No report is needed.</p>
      ${may ? html`<button type="button" class="btn t slim bad-t" data-act="dayOffUndo" data-v="${x.date}" ${c.ui.busy ? 'disabled' : ''}>Change back to Missing</button>` : ''}` : ''}
    ${x.name ? html`<textarea class="fld" rows="2" data-ui="replyText" placeholder="${may ? 'Comment, or what to change' : 'Comment to the office'}">${c.ui.replyText || ''}</textarea>` : ''}
    <div class="day-acts">
      ${(x.report && x.report.start) || x.name ? html`<button type="button" class="btn o slim" data-act="viewReport" data-v="${x.date}" data-back="reports">${icon('doc')}View</button>` : ''}
      ${x.name && isGM(c) ? html`<button type="button" class="btn o slim" data-act="pdfOpen" data-n="${x.name}">${icon('doc')}View PDF</button>` : ''}   <!-- 3.0.3 (owner): the GM opens the PDF -->
      ${x.report && x.report.start && canPdf(c) ? html`<button type="button" class="btn o slim" data-act="dayPdf" data-v="${x.date}">${icon('send')}Share</button>` : ''}
      ${x.date === c.realToday ? html`<button type="button" class="btn o slim" data-act="go" data-to="today">${icon('doc')}Edit</button>`
        : canWrite ? html`<button type="button" class="btn o slim" data-act="openPast" data-v="${x.date}">${icon('doc')}${x.report && x.report.start ? 'Edit' : 'Write'}</button>` : ''}
      ${x.name ? html`<button type="button" class="btn o slim" data-act="${may ? 'dayRev' : 'replySend'}" data-v="${may ? 'comment' : x.name}" data-n="${x.name}" ${c.ui.busy ? 'disabled' : ''}>Comment</button>` : ''}
      ${may && x.name && x.kind !== 'approved' && x.kind !== 'changes' ? html`<button type="button" class="btn o slim bad-t" data-act="dayRev" data-v="changes" data-n="${x.name}" ${c.ui.busy ? 'disabled' : ''}>Send back</button>` : ''}
      ${may && x.name && x.kind !== 'approved' && x.kind !== 'missing' && x.kind !== 'nowork' ? html`<button type="button" class="btn p slim" data-act="dayRev" data-v="approve" data-n="${x.name}" ${c.ui.busy ? 'disabled' : ''}>${icon('check')}Approve</button>` : ''}
      ${may && x.name && x.kind === 'approved' ? html`<button type="button" class="btn o slim" data-act="dayRev" data-v="reopen" data-n="${x.name}" ${c.ui.busy ? 'disabled' : ''}>Reopen</button>` : ''}
      ${x.kind !== 'missing' ? html`<button type="button" class="btn t slim bad-t" data-act="dayHide" data-v="${x.date}">Remove</button>` : ''}
    </div>
    <button type="button" class="btn t" data-act="closeSheet">Close</button></div>`;
}

/** 2.14.0: the words and colours of a shared request's state (Central Hub's approval). */
export const REQ_WORD = { gm: 'Waiting for the GM', paid: 'Paid', draft: 'Draft', requested: 'Waiting for approval', approved: 'Approved', arranging: 'Being arranged', fulfilled: 'Delivered', rejected: 'Rejected', cancelled: 'Cancelled', deleted: 'Deleted' };
// 2.31.0 (owner, 3 Nov): who approves an expense, as in Central Hub 0.69.0: the Site Engineer up to 5,000 ETB, the
// Project Engineer up to 20,000 ETB, above that and any USD amount the GM
export const waitingFor = d => (d.currency === 'USD' || +d.amount > 20000 ? 'GM' : +d.amount > 5000 ? 'Project Engineer' : 'Site Engineer');
export const reqWord = d => (d.kind === 'expense' && d.status === 'requested' ? `Waiting for the ${waitingFor(d)}` : REQ_WORD[d.status] || d.status);
const REQ_TONE = { gm: 'info', paid: 'ok', draft: 'warn', requested: 'info', approved: 'ok', arranging: 'info', fulfilled: 'ok', rejected: 'bad' };

/** 2.14.0: the project's requests from every phone, each with who did what and when. */
function sharedRequests(c) {
  const me = String((c.s.auth || {}).email || '').toLowerCase();
  // 2.17.0: the GM's All projects: every project's requests, each with its project
  const all = allOn(c), mine = new Set(c.ui.liveReqs.map(d => d.id));
  const nameOf = code => (c.s.projects.find(p => p.code === code) || {}).name || code;
  const tag = (list, code) => list.map(d => ({ ...d, _p: code }));
  let list = [...tag(c.ui.liveReqs, c.project.code), ...(all ? Object.entries(c.ui.reqAll || {}).filter(([k]) => k !== c.project.code).flatMap(([k, l]) => tag(l.filter(d => !mine.has(d.id)), k)) : [])]
    .filter(d => d.fr).sort((a, b) => String(b.editedAt || b.date).localeCompare(String(a.editedAt || a.date)));
  // 2.39.0 (owner): a deleted request stays, marked as removed by whom and when, under the others
  const gone = list.filter(d => d.status === 'deleted' && L.seenFrom(d.editedAt));   // 2.42.0: not before joining
  list = list.filter(d => d.status !== 'deleted');
  // 2.42.0 (owner): nothing from before this person joined the project
  const fresh = d => L.seenFrom(d.fr && d.fr.date || d.date || d.editedAt);
  list = list.filter(fresh);
  // 2.25.0: saved on this phone but not in the shared list yet: shown, never hidden, and shared again by itself
  const wait = unsharedRequests(c.project.code, c.s.drafts, c.ui.liveReqs, c.s.reqQueue || []);
  return {
    tab: 'requests',
    head: head('Requests', `${list.length + wait.length} on ${all ? 'all projects' : 'this project'}`, `${list.filter(d => d.status === 'draft').length + wait.length} draft`),
    body: html`${wait.length ? html`<div class="box">${wait.map(({ q, date }) => html`<div class="li item">
        <span class="time ${q.priority === 'Urgent' ? 'urgent' : ''}">${q.priority === 'Urgent' ? 'Urgent' : String(date || '').slice(5)}</span>
        <div class="n"><b>${all ? `${nameOf(c.project.code)} · ` : ''}${q.text}</b><span>${requestLine(q)}</span><span class="tiny muted">Saved on this phone · sharing with the other phones and the office</span></div>
        <span class="pill warn">On this phone</span>
        <button type="button" class="btn t slim" data-act="openReq" data-v="${q.id}">Edit</button></div>`)}</div>` : ''}
      ${list.length ? html`<div class="box">${list.map(d => {
        // 2.40.0 (owner): the tag on top, the details in one line, Edit and Delete while the office has not acted
        const open = ['draft', 'requested'].includes(d.status) && d._p === c.project.code && c.kind !== 'viewer';
        const facts = [d.fr.category, d.fr.qty ? `${d.fr.qty} ${d.fr.unit}` : '', d.fr.neededBy ? `needed by ${d.fr.neededBy}` : '', d.fr.location, String(d.fr.date || '').slice(5)].filter(Boolean);
        return html`<div class="li req-card">
        <div class="req-top"><span class="pill ${REQ_TONE[d.status] || ''}">${reqWord(d)}</span>${d.fr.priority === 'Urgent' ? html`<span class="pill bad">Urgent</span>` : ''}${all ? html`<span class="tiny muted">${nameOf(d._p)}</span>` : ''}</div>
        <b>${d.fr.text}</b>
        <div class="req-facts">${facts.map(f => html`<span>${f}</span>`)}</div>
        ${(d.log || []).length ? html`<div class="req-log">${(d.log || []).slice(-4).reverse().map(x => html`<span>${REQ_WORD[x.status] || x.status}${x.level ? ` (${x.level})` : ''} · ${x.byName || x.by} · ${stampOf(x.at)}${x.note ? ` · ${x.note}` : ''}</span>`)}</div>` : ''}
        ${open ? html`<div class="req-acts"><button type="button" class="btn t slim" data-act="openReq" data-v="${d.fr.id}">Edit</button><button type="button" class="btn t slim bad-t" data-act="reqDelete" data-v="${d.fr.id}">Delete</button></div>` : ''}</div>`;
      })}</div>`
      : wait.length ? '' : html`<div class="box pad muted small">No requests yet. Add them with + Request.</div>`}
      ${gone.length ? html`<div class="k">Removed · ${gone.length}</div><div class="box">${gone.map(d => html`<div class="li item gone"><div class="n"><b><s>${all ? `${nameOf(d._p)} · ` : ''}${d.fr.text}</s></b><span class="tiny muted">Removed by ${d.editedBy || 'site'} · ${stampOf(d.editedAt)}</span></div></div>`)}</div>` : ''}
      <p class="muted tiny">Drafts are shared with every phone of this project and go to the office with the day's report. Central Hub's answers show here.</p>`,
  };
}

export function requests(c) {
  const live = c.ui.liveReqs || (c.s.reqCache || {})[c.project.code];   // 2.39.0: the last shared list until the database answers
  if (live) return sharedRequests({ ...c, ui: { ...c.ui, liveReqs: live } });
  const list = allRequests(c.project.code, c.s.drafts);
  const late = list.filter(q => lateRequest(q, c.realToday)).length;
  return {
    tab: 'requests',
    head: head('Requests', `${list.length} written on this phone`, late ? `${late} late` : ''),
    body: html`${list.length ? html`<div class="box">${list.map(q => html`<div class="li item">
        <span class="time ${q.priority === 'Urgent' ? 'urgent' : ''}">${q.priority === 'Urgent' ? 'Urgent' : `#${q.no}`}</span>
        <div class="n"><b>${q.text}</b><span class="${lateRequest(q, c.realToday) ? 'late' : ''}">${requestLine(q)}${lateRequest(q, c.realToday) ? ' · late' : ''}</span></div>
        <span class="pill ${q.sent ? 'info' : 'warn'}">${q.sent ? 'Asked' : 'Not sent'}</span></div>`)}</div>`
      : html`<div class="box pad muted small">No requests yet. Add them on step 8 or with + Request.</div>`}
      <p class="muted tiny">The office moves requests on (Seen, Ordered, Delivered) in Central Hub.</p>`,
  };
}

export function whatsNewSheet() {
  return html`<div class="dim" data-act="seenNew"></div><div class="sheet" role="dialog" aria-label="What's new">
    <div class="grab"></div><b class="big-t">What's new in Field Report 2</b>
    <div class="box">${WHATS_NEW.map(([ic, t, d]) => html`<div class="li"><span class="ic">${icon(ic)}</span><div class="n"><b>${t}</b><span>${d}</span></div></div>`)}</div>
    <button type="button" class="btn p" data-act="seenNew">Start</button></div>`;
}

export function draftSheet(c) {
  const d = c.ui.remote;
  return html`<div class="dim"></div><div class="sheet" role="dialog" aria-label="Newer draft on another phone">
    <div class="grab"></div><b class="big-t">A newer draft on your other phone</b>
    <p class="small">Saved at ${new Date(d.at).toTimeString().slice(0, 5)}${d.by ? ` by ${d.by}` : ''}.${d.photoCount ? ` Its ${d.photoCount} photo${d.photoCount === 1 ? '' : 's'} stay on that phone.` : ''} Load it? The draft on this phone is replaced.</p>
    <button type="button" class="btn p" data-act="loadRemote">Load it</button>
    <button type="button" class="btn t" data-act="keepLocal">Keep this one</button></div>`;
}

/** The report of an earlier day, opened from Reports: a band on top of Today, with the office's comment. */
export function pastBand(c) {
  const k = c.report && c.report.no ? c.s.known[c.fileName] : null;
  const m = k && k.comments && k.comments.length ? k.comments[k.comments.length - 1] : null;
  return html`<div class="past"><div class="spread"><b>${dayLabel(c.today)} · an earlier day</b><button type="button" class="btn t slim" data-act="backToToday">Back to today</button></div>
    ${m ? html`<p class="small"><b>${m.by || 'Office'}:</b> ${m.text}</p>` : ''}</div>`;
}

/* ---------- 3.8.0 (owner, 18 Nov): Request report ---------- */
/** The request of a day of the open project (script REQ map, from projectDays or reqReport). */
export const reqOf = (c, date, code = c.project.code) => (((c.s.reqs || {})[code]) || {})[date] || null;
/** The missing days of the last 14 with their request and a Request report button (Review, the GM's Dashboard). PE and GM only. */
export function missingList(c) {
  if (c.kind !== 'reviewer') return '';
  const rows = monthDays(c.realToday, c.project, c.s.drafts || {}, c.s.known || {}, (c.s.others || {})[c.project.code] || [])
    .filter(x => x.kind === 'missing' && Date.parse(c.realToday) - Date.parse(x.date) <= 14 * 864e5).slice(0, 10);
  if (!rows.length) return '';
  return html`<div class="k">Missing reports · ${c.project.name}</div><div class="box">${rows.map(x => { const r = reqOf(c, x.date); return html`<div class="li">
    <div class="n"><b>${dayLabel(x.date)}${x.no ? ` · #${x.no}` : ''}</b><span>${r ? reqLine(r) : 'No report, not requested'}</span></div>
    <button type="button" class="btn o slim" data-act="reqOpen" data-v="${x.date}" data-n="${x.no || ''}">Request report</button></div>`; })}</div>`;
}
/** The sender's form: who, an optional note (200), the due time (end of today), Send; Cancel request while one is open. */
export function reqSheet(c) {
  const d = c.ui.reqDate, r = reqOf(c, d), gap = reqGap(r), eng = c.ui.reqEng || [];
  return html`<div class="dim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-label="Request report">
    <div class="grab"></div><b class="big-t">Request report · ${dayLabel(d)}${c.ui.reqNo ? ` · #${c.ui.reqNo}` : ''}</b>
    <div class="muted small">${c.project.name}</div>
    ${r ? html`<p class="callout small ${reqOpen(r) ? 'warn' : ''}">${reqLine(r)}</p>` : ''}
    <label class="k" for="reqTo">Send to</label>
    ${eng.length ? html`<select class="fld" id="reqTo" data-ui="reqTo">${eng.map((e, i) => html`<option value="${e.id}" ${(c.ui.reqTo || eng[0].id) === e.id ? 'selected' : ''}>${e.name}${i === 0 && e.n ? ` (usually reports, ${e.n} in 30 days)` : e.n ? ` (${e.n} in 30 days)` : ''}</option>`)}</select>`
      : html`<p class="muted small">${c.ui.reqEngBusy ? 'Finding the site engineers…' : 'The site engineer who usually reports.'}</p>`}
    <textarea class="fld" rows="2" maxlength="200" data-ui="reqNote" placeholder="Note (optional, 200 characters)" aria-label="Note">${c.ui.reqNote || ''}</textarea>
    <label class="k" for="reqDue">Due</label><input class="fld" id="reqDue" type="datetime-local" data-ui="reqDue" value="${c.ui.reqDue || ''}">
    ${gap.ok ? '' : html`<p class="muted small">One request every 4 hours. You can ask again after ${gap.next}.</p>`}
    <div class="two">${reqOpen(r) ? html`<button type="button" class="btn o bad-t" data-act="reqCancel" ${c.ui.busy ? 'disabled' : ''}>Cancel request</button>` : html`<button type="button" class="btn o" data-act="closeSheet">Close</button>`}
    <button type="button" class="btn p" data-act="reqSend" ${c.ui.busy || !gap.ok ? 'disabled' : ''}>${icon('send')}${c.ui.busy ? 'Sending…' : 'Send request'}</button></div></div>`;
}
/** The site engineer's pop-up on opening: date, report #, project, sender, note, due; Start report and Later. */
export function reqPopSheet(c) {
  const r = popReqs(c.s.myReqs, c.ui.reqLater || [])[0];
  if (!r) return '';
  return html`<div class="dim"></div><div class="sheet" role="alertdialog" aria-label="Report requested">
    <div class="grab"></div><b class="big-t">📝 Report requested</b>
    <div class="box pad"><div class="two"><span>Day</span><b>${dayLabel(r.date)}${r.no ? ` · #${r.no}` : ''}</b></div>
      <div class="two"><span>Project</span><b>${r.label || r.proj}</b></div>
      <div class="two"><span>From</span><b>${r.by}</b></div>
      <div class="two"><span>Due</span><b>${String(r.due || '').replace('T', ' ')}</b></div>
      ${r.note ? html`<p class="small">${r.note}</p>` : ''}</div>
    <div class="two"><button type="button" class="btn o" data-act="reqLaterBtn" data-v="${r.proj}|${r.date}">Later</button>
    <button type="button" class="btn p" data-act="reqStart" data-v="${r.date}" data-p="${r.proj}">Start report</button></div></div>`;
}
