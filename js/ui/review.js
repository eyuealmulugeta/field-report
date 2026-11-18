// 2.6.0: the reviewer's screens. Review: the reports of the project waiting for an answer; one report with its
// answers; Crew: the people the site sent, with their wages, to approve.

import { html, icon } from '../core/dom.js';
import { dayLabel, localDay } from '../core/util.js';
import { head, stepHead, isGM } from './parts.js';
import { STATUS, offlineLine, fewOf, fewLine } from '../model/follow.js';
import { REVIEW_FILTERS, reviewRows, KIND_WORD } from '../model/review.js';
import { crewCloses } from '../model/crew.js';
import { engageChecks } from '../model/rating.js';
import { thumb } from './work.js';
import { missingList } from './follow.js';   // 3.8.0


const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** 2.7.0: the project's working hours; the PE or GM with the right sets them. Late attendance = start + 15 min. */
function hoursBox(c) {
  const p = c.project, may = p.hoursEdit, off = (c.ui.hr || {}).off || p.nwDow || [0];
  const start = c.ui.hrStart || p.defStart || '08:00', end = c.ui.hrEnd || p.defEnd || '17:00', rem = c.ui.hrRemind || p.remindAt || end;
  const dis = may ? '' : 'disabled';
  return html`<div class="k">Working hours</div><div class="box pad">
    <div class="two"><label class="small">Start<input class="fld" type="time" data-ui="hrStart" value="${start}" ${dis}></label>
      <label class="small">End<input class="fld" type="time" data-ui="hrEnd" value="${end}" ${dis}></label></div>
    <label class="small">Reminder to send the report<input class="fld" type="time" data-ui="hrRemind" value="${rem}" ${dis}></label>
    <p class="muted tiny">Everyone on this project is reminded at this time when today's report is not sent (it was "Reminder at 17:00" in Me).</p>
    <div class="small">Days off</div><div class="chips">${DAYS.map((d, i) => html`<button type="button" class="chip ${off.includes(i) ? 'on' : ''}" data-act="hrDay" data-v="${i}" ${dis}>${d}</button>`)}</div>
    <p class="muted tiny">Crew photo: on time until ${start}, late attendance until ${crewCloses(start)}, closed after.</p>
    ${may ? html`<button type="button" class="btn p" data-act="hoursSend" ${c.ui.busy ? 'disabled' : ''}>Save the working hours</button>` : html`<p class="muted small">Setting the working hours is not yours to do.</p>`}</div>`;
}

// 3.1.0 (owner, 15 Nov): the day in local time, not UTC (a report sent after 21:00 showed the next day)
const when = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : `${dayLabel(localDay(d))} ${d.toTimeString().slice(0, 5)}`; };
const pill = st => { const s = STATUS[st] || STATUS.submitted; return html`<span class="pill ${s.cls}">${s.label}</span>`; };

export function review(c) {
  // 2.17.0: the GM's All projects; each line with when it was sent and the last answer
  const all = !!c.ui.allProj && isGM(c);
  // 2.37.0 (owner): the list opens on All
  const rv = c.ui.rv || {}, f = rv.f ?? '', list = reviewRows(rv.list, all ? '' : c.project.code, f, { day: c.ui.revDay || '', q: c.ui.revQ || '' });
  const projOf = x => (c.s.projects.find(p => String(x.name || '').includes(`_${p.code}_`)) || {}).name || '';
  return {
    tab: c.kind === 'viewer' ? 'review' : 'me',
    head: head('Review', `${all ? 'All projects' : c.project.name} · ${KIND_WORD[c.kind]}`, rv.busy ? 'Refreshing…' : ''),
    body: html`<div class="k">Reports of ${all ? 'all projects' : c.project.name}</div><div class="row2">
        <button type="button" class="btn o" data-act="revLoad" ${rv.busy ? 'disabled' : ''}>${rv.busy ? 'Refreshing…' : rv.list ? 'Refresh' : 'Show the reports'}</button>
        ${c.kind === 'reviewer' ? html`<button type="button" class="btn o" data-act="go" data-to="crewrev">${icon('users')}Crew & Hours${(c.project.crewWait || []).length ? ` · ${c.project.crewWait.length} waiting` : ''}</button>` : ''}</div>
      <div class="chips">${REVIEW_FILTERS.map(([k, t]) => html`<button type="button" class="chip ${f === k ? 'on' : ''}" data-act="revFilter" data-v="${k}">${t}${rv.list ? ` · ${reviewRows(rv.list, all ? '' : c.project.code, k).length}` : ''}</button>`)}</div>
      <div class="row2"><input class="fld" type="date" data-ui="revDay" value="${c.ui.revDay || ''}" aria-label="Day"><input class="fld" type="search" data-ui="revQ" value="${c.ui.revQ || ''}" placeholder="Search: number, name, date" aria-label="Search the reports"></div>   <!-- 3.4.0 -->
      ${all ? '' : missingList(c)}
      ${!rv.list ? html`<p class="muted">Reports sent by the site appear here for you to ${c.kind === 'viewer' ? 'read' : 'approve, send back or comment on'}.</p>`
        : list.length ? html`<div class="box">${list.map(x => html`<button type="button" class="li" data-act="revOpen" data-v="${x.name}">
          <div class="n"><b>${all ? `${projOf(x)} · ` : ''}${dayLabel(x.date)} · No. ${x.no}</b><span>${x.preparedBy || x.uploadedBy || 'Site'}${x.uploadedAt ? ` · sent ${when(x.uploadedAt)}` : ''}${x.reviewedBy ? ` · ${x.reviewedBy} ${when(x.reviewedAt)}` : ''} · ${x.crew || 0} crew${x.delayH ? ` · delays ${x.delayH} h` : ''}${x.requests ? ` · ${x.requests} requests` : ''}</span></div>${pill(x.status)}<span class="ch">${icon('chev')}</span></button>`)}</div>`
        : html`<p class="muted">No report here.</p>`}`,
  };
}

/** The project code in a report's file name (YYYY-MM-DD_CC_PROJ_NNN.pdf). */
const projCode = (c, x) => ((c.s.projects || []).find(p => String(x.name || '').includes(`_${p.code}_`)) || c.project || {}).code || '';

export function rev(c) {
  const rv = c.ui.rv || {}, x = rv.open;
  if (!x) return review(c);
  const may = c.kind === 'reviewer', st = x.status || 'submitted';
  const full = (c.ui.remoteRep || {})[`${projCode(c, x)}|${x.date}`], photos = (full && full.photos) || [];
  const few = fewOf(full);   // 3.7.0 (owner): the office sees why the report has fewer than 12 photos
  const hist = [...(x.history || []).map(h => (few && h.kind === 'submit' && !h.text ? { ...h, text: fewLine(few) } : h))].reverse();   // 3.4.0 (owner): the full event log
  const score = full ? engageChecks(full) : [], comments = x.comments || [];
  const to = x.preparedBy || x.uploadedBy || 'the sender';
  return {
    head: stepHead(`No. ${x.no} · ${dayLabel(x.date)}`, `${x.preparedBy || x.uploadedBy || 'Site'} · version ${x.version || 1}`, 'reports'),   // 2.68.0: back to Reports
    body: html`<div class="box pad"><div class="two"><span>Status</span>${pill(st)}</div>
        <div class="two"><span>Sent by</span><b>${x.preparedBy || x.uploadedBy || '—'}</b></div>
        <div class="two"><span>Sent</span><b>${when(x.uploadedAt)}</b></div>
        ${offlineLine(x.pressedAt, x.uploadedAt) ? html`<p class="callout warn small">${offlineLine(x.pressedAt, x.uploadedAt)}</p>` : ''}
        ${few ? html`<p class="callout warn small"><b>Only ${few.n} of 12 photos.</b> Reason: ${few.why}</p>` : ''}
        <div class="two"><span>Crew · delays · requests</span><b>${x.crew || 0} · ${x.delayH || 0} h · ${x.requests || 0}</b></div>
        ${x.reviewedBy ? html`<div class="two"><span>Last answer</span><b>${x.reviewedBy} · ${when(x.reviewedAt)}</b></div>` : ''}
        <button type="button" class="btn p" data-act="viewReport" data-v="${x.date}" data-p="${projCode(c, x)}" data-back="rev">${icon('doc')}Open the report and its photos</button>   <!-- 3.1.0 (owner): Review opens the report -->
        ${x.url ? html`<a class="btn o" href="${x.url}" target="_blank" rel="noopener">${icon('doc')}View PDF</a>` : isGM(c) ? html`<button type="button" class="btn o" data-act="pdfOpen" data-n="${x.name}">${icon('doc')}View PDF</button>` : ''}</div>
      ${photos.length ? html`<div class="k">Photos · ${photos.length}</div><div class="box pad"><div class="thumbs">${photos.map(p => thumb(p.id))}</div></div>` : rv.fullBusy ? html`<p class="muted small">Reading the photos…</p>` : ''}
      ${score.length ? html`<div class="k">Scorecard</div><div class="box">${score.map(s => html`<div class="li"><span class="ic ${s.v >= 1 ? 'ok' : s.v > 0 ? '' : 'bad'}">${icon(s.v >= 1 ? 'check' : 'doc')}</span><div class="n"><b>${s.label}</b><span>${s.why}</span></div></div>`)}</div>` : ''}
      ${comments.length ? html`<div class="k">Comments · ${x.commentCount || comments.length}</div><div class="box">${comments.map(m => html`<div class="li"><div class="n"><b>${m.text || ''}</b><span>${m.by || ''} · ${when(m.at)}</span></div></div>`)}</div>` : ''}
      ${hist.length ? html`<div class="k">Event log</div><div class="box">${hist.map(h => html`<div class="li"><span class="ic ${h.kind === 'changes' ? 'bad' : h.kind === 'approve' ? 'ok' : ''}">${icon(h.kind === 'approve' ? 'check' : 'doc')}</span>
        <div class="n"><b>${h.text || h.kind}</b><span>${h.by || ''} · ${when(h.at)}</span></div></div>`)}</div>` : ''}
      ${may ? html`<div class="k">Your answer</div><div class="box pad">
        <textarea class="fld" rows="3" data-ui="revText" placeholder="Comment or what to change: it goes to ${to} only">${c.ui.revText || ''}</textarea>
        <div class="two">${st !== 'approved' ? html`<button type="button" class="btn o" data-act="revDo" data-v="changes" ${rv.busy ? 'disabled' : ''}>Send back</button><button type="button" class="btn p" data-act="revDo" data-v="approve" ${rv.busy ? 'disabled' : ''}>${icon('check')}Approve</button>`
          : html`<button type="button" class="btn o" data-act="revDo" data-v="reopen" ${rv.busy ? 'disabled' : ''}>Reopen for the site</button>`}</div>
        <div class="two"><button type="button" class="btn o" data-act="revDo" data-v="comment" ${rv.busy ? 'disabled' : ''}>Comment</button><button type="button" class="btn t bad-t" data-act="revHide" ${rv.busy ? 'disabled' : ''}>Remove</button></div>
        <p class="muted small">Approving signs the report with your signature (set it under Me).</p></div>` : ''}`,
  };
}

export function crewrev(c) {
  const wait = c.project.crewWait || [], picks = (c.ui.rv || {}).picks || {}, may = c.project.crewApprove;
  return {
    tab: 'review',
    head: stepHead('Crew & Hours', `${c.project.name} · sent by the site`, 'review'),
    body: html`${wait.length ? html`<div class="box pad"><p class="muted small">Tick the people to approve and give their daily wage. Central Hub adds them to the crew of ${c.project.name}.</p>
        ${wait.map(x => { const on = !!picks[x.id], wage = c.ui[`cw_${x.id}`]; return html`<div class="cl-row"><label class="check"><input type="checkbox" data-act="crewPick" data-v="${x.id}" ${on ? 'checked' : ''} ${may ? '' : 'disabled'}> <b>${x.name}</b></label>
          <span class="muted">${x.trade || 'no trade'}</span>
          <input class="fld slim" inputmode="decimal" data-ui="cw_${x.id}" value="${wage ?? (x.wage || '')}" placeholder="${x.tradeWage || 'Daily wage'}" aria-label="Daily wage of ${x.name}" ${may ? '' : 'disabled'}></div>`; })}
        ${may ? html`<button type="button" class="btn p" data-act="crewOkSend" ${c.ui.busy ? 'disabled' : ''}>Approve the ticked people</button>` : html`<p class="muted small">Approving crew is not yours to do.</p>`}</div>`
      : html`<p class="muted">Nobody is waiting. When the site sends its crew list, the names appear here.</p>`}
      ${hoursBox(c)}`,
  };
}
