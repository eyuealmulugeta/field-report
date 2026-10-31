// Slice 5: Reports (every day of the month and the office's answer), one day's sheet, Requests,
// "What's new" and the draft found on another phone. Screens return { head, body, foot, tab }.

import { html, icon } from '../core/dom.js';
import { dayLabel } from '../core/util.js';
import { head } from './parts.js';
import { STATUS, FILTERS, monthDays, counts, allRequests, lateRequest, WHATS_NEW } from '../model/follow.js';
import { requestLine } from '../model/end.js';
import { canPdf } from './view.js';

const when = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : `${dayLabel(d.toISOString().slice(0, 10))} ${d.toTimeString().slice(0, 5)}`; };
const pill = kind => html`<span class="pill ${STATUS[kind].cls}">${STATUS[kind].label}</span>`;

export function reports(c) {
  const rows = monthDays(c.realToday, c.project, c.s.drafts, c.s.known);
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
          <span>${x.comment ? (x.comment.text ? `${x.comment.by || 'Office'}: ${x.comment.text}` : x.comment.kind === 'approve' ? `Approved by ${x.comment.by || 'the office'}` : '') :x.changed ? 'Changed since sent' : x.kind === 'nowork' ? `No work: ${x.report.nowork.reason}` : ''}</span></div>
        ${pill(x.kind)}</button>`)}</div>`
        : html`<div class="box pad muted small">Nothing here.</div>`}
      <p class="muted tiny center">The office's answers are checked when the app opens and every 10 minutes${c.s.knownAt ? ` · last ${new Date(c.s.knownAt).toTimeString().slice(0, 5)}` : ''}.</p>`,
  };
}

/** One day: status, the office's comments and history, and what can be done. */
export function daySheet(c) {
  const x = monthDays(c.realToday, c.project, c.s.drafts, c.s.known).find(y => y.date === c.ui.daySel);
  if (!x) return '';
  const k = (x.name && c.s.known[x.name]) || {};
  const comments = k.comments || [];
  const canWrite = x.kind !== 'approved' && x.kind !== 'nowork';
  return html`<div class="dim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-label="Report of ${dayLabel(x.date)}">
    <div class="grab"></div><div class="spread"><b class="big-t">${dayLabel(x.date)}${x.no ? ` · #${x.no}` : ''}</b>${pill(x.kind)}</div>
    ${x.name ? html`<div class="muted tiny">${x.name}${x.version ? ` · version ${x.version}` : ''}</div>` : ''}
    ${comments.length ? html`<div class="box">${comments.slice(-3).reverse().map(m => html`<div class="li"><span class="ic ${m.kind === 'changes' ? 'bad' : m.kind === 'approve' ? 'ok' : ''}">${icon(m.kind === 'approve' ? 'check' : 'doc')}</span>
      <div class="n"><b>${m.text || (m.kind === 'approve' ? 'Approved' : m.kind)}</b><span>${m.by || 'Office'} · ${when(m.at)}</span></div></div>`)}</div>` : ''}
    ${x.kind === 'changes' ? html`<p class="callout bad">The office sent this report back. Open it, fix what they asked, and send it again.</p>` : ''}
    ${x.kind === 'missing' ? html`<p class="small muted">No report on this phone for this day.</p>` : ''}
    ${canWrite && x.date !== c.realToday ? html`<button type="button" class="btn p" data-act="openPast" data-v="${x.date}">${icon('doc')}${x.report && x.report.start ? 'Open and correct' : 'Write this report'}</button>` : ''}
    ${x.date === c.realToday ? html`<button type="button" class="btn p" data-act="go" data-to="today">Open today</button>` : ''}
    ${x.report && x.report.start ? html`<button type="button" class="btn o" data-act="viewReport" data-v="${x.date}" data-back="reports">${icon('doc')}View the report</button>` : ''}
    ${x.report && x.report.start && canPdf(c) ? html`<button type="button" class="btn t" data-act="dayPdf" data-v="${x.date}">${icon('send')}Share the PDF</button>` : ''}
    <button type="button" class="btn t" data-act="closeSheet">Close</button></div>`;
}

export function requests(c) {
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
