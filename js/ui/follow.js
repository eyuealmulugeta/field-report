// Slice 5: Reports (every day of the month and the office's answer), one day's sheet, Requests,
// "What's new" and the draft found on another phone. Screens return { head, body, foot, tab }.

import { html, icon } from '../core/dom.js';
import { dayLabel } from '../core/util.js';
import { head, isGM } from './parts.js';
import { STATUS, FILTERS, monthDays, counts, allRequests, lateRequest, WHATS_NEW, lastStep, unsharedRequests } from '../model/follow.js';
import { requestLine } from '../model/end.js';
import { canPdf } from './view.js';
import { rateReport, rateLine, checkLines } from '../model/rating.js';

const when = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : `${dayLabel(d.toISOString().slice(0, 10))} ${d.toTimeString().slice(0, 5)}`; };
const pill = kind => html`<span class="pill ${STATUS[kind].cls}">${STATUS[kind].label}</span>`;

const STEP_DONE = { submit: 'Sent', approve: 'Approved', changes: 'Sent back', reopen: 'Reopened', comment: 'Comment', reply: 'Reply', return: 'Returned', office: 'Corrected' };
/** 2.17.0: "Approved by Abel · 1 Nov, 09:12": the report's newest step. */
const stepLine = s => (s && s.at ? `${STEP_DONE[s.kind] || 'Sent'}${s.by ? ` by ${s.by}` : ''} · ${stampOf(s.at)}` : '');
const allOn = c => !!c.ui.allProj && isGM(c);

/** 2.17.0: the GM's All projects: every report sent on the account's projects, newest first, from Central Hub. */
function allReports(c) {
  const since = new Date(Date.parse(`${c.realToday}T00:00:00Z`) - 31 * 864e5).toISOString().slice(0, 10);
  const rows = c.s.projects.flatMap(p => ((c.s.others || {})[p.code] || []).filter(o => o && o.date >= since && !(c.s.hidden || {})[`${p.code}|${o.date}`]).map(o => {
    const k = (o.name && c.s.known[o.name]) || {}, st = k.status || o.status;
    return { ...o, p, kind: st === 'approved' || st === 'changes' ? st : 'submitted', last: lastStep(k.history || o.history) || (o.at ? { kind: 'submit', at: o.at, by: o.by } : null) };
  })).sort((a, b) => b.date.localeCompare(a.date) || Number(b.no) - Number(a.no));
  const f = c.ui.rf || '', n = counts(rows), list = rows.filter(x => !f || x.kind === f);
  return {
    tab: 'reports',
    head: head('Reports', 'All projects · last 31 days', c.ui.checking ? 'Checking…' : ''),
    body: html`<div class="chips">${FILTERS.filter(([k]) => k !== 'missing').map(([k, t]) => html`<button type="button" class="chip ${f === k ? 'on' : ''}" data-act="pick" data-f="ui.rf" data-v="${k}">${t}${k && n[k] ? ` ${n[k]}` : ''}</button>`)}</div>
      ${list.length ? html`<div class="box">${list.map(x => html`<button type="button" class="li day" data-act="openAll" data-p="${x.p.code}" data-v="${x.date}">
        <span class="dnum"><b>${x.date.slice(8)}</b>${dayLabel(x.date).slice(0, 3)}</span>
        <div class="n"><b>${x.p.name} · Report #${x.no}</b><span>${[x.by, stepLine(x.last)].filter(Boolean).join(' · ')}</span></div>${pill(x.kind)}</button>`)}</div>`
        : html`<div class="box pad muted small">Nothing here.</div>`}`,
  };
}

export function reports(c) {
  if (allOn(c)) return allReports(c);
  const rows = monthDays(c.realToday, c.project, c.s.drafts, c.s.known, (c.s.others || {})[c.project.code]).filter(x => !(c.s.hidden || {})[`${c.project.code}|${x.date}`]);
  const n = counts(rows), f = c.ui.rf || '';
  const list = rows.filter(x => !f || x.kind === f);
  return {
    tab: 'reports',
    head: head('Reports', `${c.project.name} · this month`, c.ui.checking ? 'Checking…' : ''),
    // 2.1.1: the button sits at the top; a footer hides the bottom bar (Home, Today…) on a tab page
    body: html`<button type="button" class="btn o" data-act="checkStatus" ${c.ui.checking ? 'disabled' : ''}>${c.ui.checking ? 'Checking with the office…' : 'Check again'}</button>
      <div class="chips">${FILTERS.map(([k, t]) => html`<button type="button" class="chip ${f === k ? 'on' : ''}" data-act="pick" data-f="ui.rf" data-v="${k}">${t}${k && n[k] ? ` ${n[k]}` : ''}</button>`)}</div>
      ${list.length ? html`<div class="box">${list.map(x => html`<button type="button" class="li day" data-act="openDay" data-v="${x.date}">
        <span class="dnum"><b>${x.date.slice(8)}</b>${dayLabel(x.date).slice(0, 3)}</span>
        <div class="n"><b>${x.no ? `Report #${x.no}` : x.kind === 'off' ? 'Day off' : x.kind === 'today' ? 'Today' : 'No report'}${x.version > 1 ? ` · version ${x.version}` : ''}</b>
          <span>${x.other ? `Sent by ${x.by || 'another phone'}` : x.comment ? (x.comment.text ? `${x.comment.by || 'Office'}: ${x.comment.text}` : x.comment.kind === 'approve' ? `Approved by ${x.comment.by || 'the office'}` : '') :x.changed ? 'Changed since sent' : x.kind === 'nowork' ? `No work: ${x.report.nowork.reason}` : ''}${x.last && x.last.at ? ` · ${stepLine(x.last)}` : ''}</span></div>
        ${pill(x.kind)}</button>`)}</div>`
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

export function daySheet(c) {
  const x = monthDays(c.realToday, c.project, c.s.drafts, c.s.known, (c.s.others || {})[c.project.code]).find(y => y.date === c.ui.daySel);
  if (!x) return '';
  const k = (x.name && c.s.known[x.name]) || {};
  const comments = k.comments || [];
  // 2.13.0: every step of the report with its date and time (approved, sent back, reopened, comments), newest first
  const steps = (k.history && k.history.length ? k.history : comments).filter(m => m.at).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const canWrite = x.kind !== 'approved' && x.kind !== 'nowork';
  return html`<div class="dim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-label="Report of ${dayLabel(x.date)}">
    <div class="grab"></div><div class="spread"><b class="big-t">${dayLabel(x.date)}${x.no ? ` · #${x.no}` : ''}</b>${pill(x.kind)}</div>
    ${x.name ? html`<div class="muted tiny">${x.name}${x.version ? ` · version ${x.version}` : ''}</div>` : ''}
    ${steps.length ? html`<div class="box">${steps.slice(0, 8).map(m => html`<div class="li"><span class="ic ${m.kind === 'changes' ? 'bad' : m.kind === 'approve' ? 'ok' : ''}">${icon(m.kind === 'approve' ? 'check' : 'doc')}</span>
      <div class="n"><b>${m.text || STEP[m.kind] || m.kind}</b><span>${STEP[m.kind] && m.text ? `${STEP[m.kind]} · ` : ''}${m.by || 'Office'} · ${stampOf(m.at)}</span></div></div>`)}</div>` : ''}
    ${x.report && x.report.start ? (rt => html`<div class="soft small"><b>${rateLine(rt)}</b><ul class="checks">${checkLines(rt).map(l => html`<li>${l}</li>`)}</ul></div>`)(rateReport(x.report)) : ''}
    ${(x.report && x.report.edits || []).length ? html`<div class="k">Log · who entered and when</div><div class="box">${x.report.edits.slice().reverse().slice(0, 10).map(e => html`<div class="li"><span class="ic">${icon('doc')}</span><div class="n"><b>${e.by}</b><span>Entered · ${stampOf(new Date(e.at).toISOString())}</span></div></div>`)}</div>` : ''}
    ${officeLine(steps)}
    ${x.kind === 'changes' ? html`<p class="callout bad">The office sent this report back. Open it, fix what they asked, and send it again.</p>` : ''}
    ${x.name && comments.length && x.kind !== 'approved' ? html`<textarea class="fld" rows="2" data-ui="replyText" placeholder="Reply to the office">${c.ui.replyText || ''}</textarea>
      <button type="button" class="btn o" data-act="replySend" data-v="${x.name}">${icon('send')}Send the reply</button>` : ''}
    ${x.kind === 'missing' ? html`<p class="small muted">No report on this phone for this day.</p>` : ''}
    ${canWrite && x.date !== c.realToday ? html`<button type="button" class="btn p" data-act="openPast" data-v="${x.date}">${icon('doc')}${x.report && x.report.start ? 'Open and correct' : 'Write this report'}</button>` : ''}
    ${x.date === c.realToday ? html`<button type="button" class="btn p" data-act="go" data-to="today">Open today</button>` : ''}
    ${x.report && x.report.start ? html`<button type="button" class="btn o" data-act="viewReport" data-v="${x.date}" data-back="reports">${icon('doc')}View the report</button>` : ''}
    ${x.report && x.report.start && canPdf(c) ? html`<button type="button" class="btn t" data-act="dayPdf" data-v="${x.date}">${icon('send')}Share the PDF</button>` : ''}
    ${x.kind !== 'missing' ? html`<button type="button" class="btn t" data-act="dayHide" data-v="${x.date}">Remove from phone</button>` : ''}
    <button type="button" class="btn t" data-act="closeSheet">Close</button></div>`;
}

/** 2.14.0: the words and colours of a shared request's state (Central Hub's approval). */
export const REQ_WORD = { draft: 'Draft', requested: 'Waiting for approval', approved: 'Approved', arranging: 'Being arranged', fulfilled: 'Delivered', rejected: 'Rejected', cancelled: 'Cancelled', deleted: 'Deleted' };
const REQ_TONE = { draft: 'warn', requested: 'info', approved: 'ok', arranging: 'info', fulfilled: 'ok', rejected: 'bad' };

/** 2.14.0: the project's requests from every phone, each with who did what and when. */
function sharedRequests(c) {
  const me = String((c.s.auth || {}).email || '').toLowerCase();
  // 2.17.0: the GM's All projects: every project's requests, each with its project
  const all = allOn(c), mine = new Set(c.ui.liveReqs.map(d => d.id));
  const nameOf = code => (c.s.projects.find(p => p.code === code) || {}).name || code;
  const tag = (list, code) => list.map(d => ({ ...d, _p: code }));
  const list = [...tag(c.ui.liveReqs, c.project.code), ...(all ? Object.entries(c.ui.reqAll || {}).filter(([k]) => k !== c.project.code).flatMap(([k, l]) => tag(l.filter(d => !mine.has(d.id)), k)) : [])]
    .filter(d => d.status !== 'deleted' && d.fr).sort((a, b) => String(b.editedAt || b.date).localeCompare(String(a.editedAt || a.date)));
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
      ${list.length ? html`<div class="box">${list.map(d => html`<div class="li item">
        <span class="time ${d.fr.priority === 'Urgent' ? 'urgent' : ''}">${d.fr.priority === 'Urgent' ? 'Urgent' : String(d.fr.date || '').slice(5)}</span>
        <div class="n"><b>${all ? `${nameOf(d._p)} · ` : ''}${d.fr.text}</b><span>${[d.fr.qty ? `${d.fr.qty} ${d.fr.unit}` : '', d.fr.neededBy ? `needed by ${d.fr.neededBy}` : '', d.fr.location].filter(Boolean).join(' · ')}</span>
          ${(d.log || []).slice(-4).reverse().map(x => html`<span class="tiny muted">${REQ_WORD[x.status] || x.status} · ${x.byName || x.by} · ${stampOf(x.at)}${x.note ? ` · ${x.note}` : ''}</span>`)}</div>
        <span class="pill ${REQ_TONE[d.status] || ''}">${REQ_WORD[d.status] || d.status}</span>
        ${d.status === 'draft' && d._p === c.project.code ? html`<button type="button" class="btn t slim" data-act="openReq" data-v="${d.fr.id}">Edit</button>` : ''}
        ${d.status === 'requested' && d.by === me && d._p === c.project.code ? html`<button type="button" class="mini" data-act="reqCancel" data-v="${d.fr.id}" aria-label="Withdraw">✕</button>` : ''}</div>`)}</div>`
      : wait.length ? '' : html`<div class="box pad muted small">No requests yet. Add them with + Request.</div>`}
      <p class="muted tiny">Drafts are shared with every phone of this project and go to the office with the day's report. Central Hub's answers show here.</p>`,
  };
}

export function requests(c) {
  if (c.ui.liveReqs) return sharedRequests(c);
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
      <p class="muted tiny">The office moves requests on (Seen, Ordered, Delivered) in Central Hub; that comes to this page in version 2.2.</p>`,
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
