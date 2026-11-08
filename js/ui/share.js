// 2.66.0 (owner, 7 Nov): Share work for a technician (photos of the work executed, checked for clearness on the phone), and
// Review > Photos for the Site Engineer or PE (approve, or reject with a reason).

import { html, icon } from '../core/dom.js';
import { head, reviewTabs } from './parts.js';
import { MAX_PHOTOS, REJECT_REASONS, reasonWord, SHOT_WORD, SHOT_TONE, sortShots, mayReview } from '../model/shots.js';

const t = at => String(at || '').slice(5, 16).replace('T', ' ');

/** The technician's screen. */
export function share(c) {
  const f = c.ui.sh || {}, p = c.project || {}, tasks = (p.setup || {}).tasks || [];
  const me = String((c.s.auth || {}).email || '').toLowerCase();
  const mine = sortShots(c.ui.shList || []).filter(x => x.by === me).slice(0, 20);
  const photos = f.photos || [];
  return {
    tab: 'share',
    head: head('Share work', p.name || '', mine.filter(x => x.status === 'rejected').length ? `${mine.filter(x => x.status === 'rejected').length} rejected` : ''),
    body: html`${c.ui.live !== 'on' && !c.demo ? html`<p class="callout warn small">Sharing needs the connection to Central Hub. Check the internet, then open this page again.</p>` : ''}
      <div class="box pad sm-form"><b>Photos of the work done</b>
        <div class="sh-photos">${photos.map((x, i) => html`<div class="sh-ph"><img src="${x.url}" alt="Photo ${i + 1}"><button type="button" class="btn t slim" data-act="shDel" data-v="${i}">Remove</button></div>`)}</div>
        ${photos.length < MAX_PHOTOS ? html`<button type="button" class="btn t" data-act="shTake" ${c.ui.shBusy ? 'disabled' : ''}>${icon('cam')}${c.ui.shBusy ? 'Checking the photo…' : photos.length ? 'Another photo' : 'Take a photo'}</button>` : ''}
        ${c.ui.shWhy ? html`<p class="callout bad small">${c.ui.shWhy}. Take it again: hold still, with good light.</p>` : ''}
        ${tasks.length ? html`<label class="lab" for="shTask">Task</label><select id="shTask" class="fld" data-ui="shTask"><option value="">Choose the task…</option>${tasks.map(x => html`<option value="${x.id}" ${x.id === f.taskId ? 'selected' : ''}>${x.name}</option>`)}</select>` : ''}
        <label class="lab" for="shNote">What was done</label><input id="shNote" class="fld" data-ui="shNote" value="${f.note || ''}" placeholder="e.g. Column C3 welded and painted">
        <div class="row"><button type="button" class="btn p" data-act="shSave" ${c.ui.busy ? 'disabled' : ''}>Send</button></div>
        <p class="tiny muted">The Site Engineer or PE approves it. A photo that is not clear is refused on the phone.</p></div>
      <div class="k">Sent</div>
      ${mine.length ? mine.map(x => html`<div class="li item"><span class="time">${t(x.at)}</span><div class="n"><b>${x.taskName || 'Work'}</b><span>${x.note}${x.status === 'rejected' ? ` · ${reasonWord(x.reason)}${x.why ? `: ${x.why}` : ''}` : ''}</span></div><span class="pill ${SHOT_TONE[x.status] || ''}">${SHOT_WORD[x.status] || x.status}</span></div>`) : html`<p class="muted small">Nothing sent yet.</p>`}`,
  };
}

/** Review > Photos. */
export function shots(c) {
  const role = (c.s.auth || {}).role || '', list = sortShots(c.ui.shList || []).slice(0, 60), may = mayReview(role);
  const waiting = list.filter(x => x.status === 'waiting').length;
  return {
    tab: 'shots',
    head: head('Work photos', `${list.length} shared by technicians`, waiting ? `${waiting} waiting` : ''),
    body: html`${reviewTabs('shots')}
      ${list.length ? list.map(x => html`<div class="box pad sh-rev"><div class="row"><b>${x.byName}</b><span class="pill ${SHOT_TONE[x.status] || ''}">${SHOT_WORD[x.status] || x.status}</span></div>
        <div class="muted small">${t(x.at)} · ${x.taskName || 'No task'}${x.geo ? html` · <a href="https://maps.google.com/?q=${x.geo.lat},${x.geo.lng}" target="_blank" rel="noopener">place</a>` : ''}</div>
        <p>${x.note}</p><div class="sh-photos">${(x.photos || []).map((u, i) => html`<img src="${u}" alt="Photo ${i + 1}">`)}</div>
        ${x.status === 'waiting' && may ? html`<div class="row"><button type="button" class="btn p slim" data-act="shOk" data-id="${x.id}">Approve</button>
          <select class="fld slim" data-ui="shWhy.${x.id}" aria-label="Reason">${REJECT_REASONS.map(([v, w]) => html`<option value="${v}">${w}</option>`)}</select>
          <button type="button" class="btn t slim bad-t" data-act="shNo" data-id="${x.id}">Reject</button></div>` : ''}
        ${x.status !== 'waiting' ? html`<div class="tiny muted">${x.status === 'rejected' ? `${reasonWord(x.reason)} · ` : ''}by ${x.decidedByName || ''}</div>` : ''}</div>`)
        : html`<p class="muted small">No work photos yet. Technicians share them from their own account.</p>`}`,
  };
}
