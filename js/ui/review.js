// 2.6.0: the reviewer's screens. Review: the reports of the project waiting for an answer; one report with its
// answers; Crew: the people the site sent, with their wages, to approve.

import { html, icon } from '../core/dom.js';
import { dayLabel } from '../core/util.js';
import { head, stepHead } from './parts.js';
import { STATUS, offlineLine } from '../model/follow.js';
import { REVIEW_FILTERS, reviewRows, KIND_WORD } from '../model/review.js';
import { crewCloses } from '../model/crew.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** 2.7.0: the project's working hours; the PM or GM with the right sets them. Late attendance = start + 15 min. */
function hoursBox(c) {
  const p = c.project, may = p.hoursEdit, off = (c.ui.hr || {}).off || p.nwDow || [0];
  const start = c.ui.hrStart || p.defStart || '08:00', end = c.ui.hrEnd || p.defEnd || '17:00', rem = c.ui.hrRemind || p.remindAt || end;
  const dis = may ? '' : 'disabled';
  return html`<div class="k">Working hours</div><div class="box pad">
    <div class="two"><label class="small">Start<input class="fld" type="time" data-ui="hrStart" value="${start}" ${dis}></label>
      <label class="small">End<input class="fld" type="time" data-ui="hrEnd" value="${end}" ${dis}></label></div>
    <label class="small">Reminder to send the report<input class="fld" type="time" data-ui="hrRemind" value="${rem}" ${dis}></label>
    <div class="small">Days off</div><div class="chips">${DAYS.map((d, i) => html`<button type="button" class="chip ${off.includes(i) ? 'on' : ''}" data-act="hrDay" data-v="${i}" ${dis}>${d}</button>`)}</div>
    <p class="muted tiny">Crew photo: on time until ${start}, late attendance until ${crewCloses(start)}, closed after.</p>
    ${may ? html`<button type="button" class="btn p" data-act="hoursSend" ${c.ui.busy ? 'disabled' : ''}>Save the working hours</button>` : html`<p class="muted small">Setting the working hours is not yours to do.</p>`}</div>`;
}

const when = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : `${dayLabel(d.toISOString().slice(0, 10))} ${d.toTimeString().slice(0, 5)}`; };
const pill = st => { const s = STATUS[st] || STATUS.submitted; return html`<span class="pill ${s.cls}">${s.label}</span>`; };

export function review(c) {
  const rv = c.ui.rv || {}, f = rv.f ?? 'submitted', list = reviewRows(rv.list, c.project.code, f);
  return {
    tab: 'review',
    head: head('Review', `${c.project.name} · ${KIND_WORD[c.kind]}`, rv.busy ? 'Checking…' : ''),
    body: html`<button type="button" class="btn o" data-act="revLoad" ${rv.busy ? 'disabled' : ''}>${rv.busy ? 'Checking with the office…' : rv.list ? 'Check again' : 'Show the reports'}</button>
      <div class="chips">${REVIEW_FILTERS.map(([k, t]) => html`<button type="button" class="chip ${f === k ? 'on' : ''}" data-act="revFilter" data-v="${k}">${t}</button>`)}</div>
      ${!rv.list ? html`<p class="muted">Reports sent by the site appear here for you to ${c.kind === 'viewer' ? 'read' : 'approve, send back or comment on'}.</p>`
        : list.length ? html`<div class="box">${list.map(x => html`<button type="button" class="li" data-act="revOpen" data-v="${x.name}">
          <div class="n"><b>${dayLabel(x.date)} · No. ${x.no}</b><span>${x.preparedBy || x.uploadedBy || 'Site'} · ${x.crew || 0} crew${x.delayH ? ` · delays ${x.delayH} h` : ''}${x.requests ? ` · ${x.requests} requests` : ''}</span></div>${pill(x.status)}<span class="ch">${icon('chev')}</span></button>`)}</div>`
        : html`<p class="muted">No report here.</p>`}
      ${c.kind === 'reviewer' ? html`<button type="button" class="btn o" data-act="go" data-to="crewrev">${icon('users')}Crew and working hours${(c.project.crewWait || []).length ? ` · ${c.project.crewWait.length} waiting` : ''}</button>` : ''}`,
  };
}

export function rev(c) {
  const rv = c.ui.rv || {}, x = rv.open;
  if (!x) return review(c);
  const may = c.kind === 'reviewer', st = x.status || 'submitted';
  const hist = (x.history || []).slice(-8).reverse();
  const to = x.preparedBy || x.uploadedBy || 'the sender';
  return {
    head: stepHead(`No. ${x.no} · ${dayLabel(x.date)}`, `${x.preparedBy || x.uploadedBy || 'Site'} · version ${x.version || 1}`, 'review'),
    body: html`<div class="box pad"><div class="two"><span>Status</span>${pill(st)}</div>
        <div class="two"><span>Sent by</span><b>${x.preparedBy || x.uploadedBy || '—'}</b></div>
        <div class="two"><span>Sent</span><b>${when(x.uploadedAt)}</b></div>
        ${offlineLine(x.pressedAt, x.uploadedAt) ? html`<p class="callout warn small">${offlineLine(x.pressedAt, x.uploadedAt)}</p>` : ''}
        <div class="two"><span>Crew · delays · requests</span><b>${x.crew || 0} · ${x.delayH || 0} h · ${x.requests || 0}</b></div>
        ${x.reviewedBy ? html`<div class="two"><span>Last answer</span><b>${x.reviewedBy} · ${when(x.reviewedAt)}</b></div>` : ''}
        ${x.url ? html`<a class="btn o" href="${x.url}" target="_blank" rel="noopener">${icon('doc')}Open the report (PDF)</a>` : ''}</div>
      ${hist.length ? html`<div class="k">What happened</div><div class="box">${hist.map(h => html`<div class="li"><span class="ic ${h.kind === 'changes' ? 'bad' : h.kind === 'approve' ? 'ok' : ''}">${icon(h.kind === 'approve' ? 'check' : 'doc')}</span>
        <div class="n"><b>${h.text || h.kind}</b><span>${h.by || ''} · ${when(h.at)}</span></div></div>`)}</div>` : ''}
      ${may ? html`<div class="k">Your answer</div><div class="box pad">
        <textarea class="fld" rows="3" data-ui="revText" placeholder="Comment or what to change: it goes to ${to} only">${c.ui.revText || ''}</textarea>
        <div class="two">${st !== 'approved' ? html`<button type="button" class="btn o" data-act="revDo" data-v="changes" ${rv.busy ? 'disabled' : ''}>Send back</button><button type="button" class="btn p" data-act="revDo" data-v="approve" ${rv.busy ? 'disabled' : ''}>${icon('check')}Approve</button>`
          : html`<button type="button" class="btn o" data-act="revDo" data-v="reopen" ${rv.busy ? 'disabled' : ''}>Reopen for the site</button>`}</div>
        <button type="button" class="btn t" data-act="revDo" data-v="comment" ${rv.busy ? 'disabled' : ''}>Comment only</button>
        <p class="muted small">Approving signs the report with your signature (set it under Me).</p></div>` : ''}`,
  };
}

export function crewrev(c) {
  const wait = c.project.crewWait || [], picks = (c.ui.rv || {}).picks || {}, may = c.project.crewApprove;
  return {
    tab: 'review',
    head: stepHead('Crew and working hours', `${c.project.name} · sent by the site`, 'review'),
    body: html`${wait.length ? html`<div class="box pad"><p class="muted small">Tick the people to approve and give their daily wage. Central Hub adds them to the crew of ${c.project.name}.</p>
        ${wait.map(x => { const on = !!picks[x.id], wage = c.ui[`cw_${x.id}`]; return html`<div class="cl-row"><label class="check"><input type="checkbox" data-act="crewPick" data-v="${x.id}" ${on ? 'checked' : ''} ${may ? '' : 'disabled'}> <b>${x.name}</b></label>
          <span class="muted">${x.trade || 'no trade'}</span>
          <input class="fld slim" inputmode="decimal" data-ui="cw_${x.id}" value="${wage ?? (x.wage || '')}" placeholder="${x.tradeWage || 'Daily wage'}" aria-label="Daily wage of ${x.name}" ${may ? '' : 'disabled'}></div>`; })}
        ${may ? html`<button type="button" class="btn p" data-act="crewOkSend" ${c.ui.busy ? 'disabled' : ''}>Approve the ticked people</button>` : html`<p class="muted small">Approving crew is not yours to do.</p>`}</div>`
      : html`<p class="muted">Nobody is waiting. When the site sends its crew list, the names appear here.</p>`}
      ${hoursBox(c)}`,
  };
}
