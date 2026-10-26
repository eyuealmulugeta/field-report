// Slice 4: Requests and tomorrow (step 8) with one request, and Review and send (step 9).
// Each returns { head, body, foot }.

import { html, icon } from '../core/dom.js';
import { plural, dayLabel } from '../core/util.js';
import { pdfName } from '../core/names.js';
import { isDemo } from '../core/api.js';
import { REQUEST_TYPES, PRIORITIES, REQUEST_UNITS, requestReady, requestLine, planReady, planLine, unfinishedWork, checks, canSend, summary, byZone } from '../model/end.js';
import { materialChoices } from '../model/day.js';
import { zonesOf } from '../model/items.js';
import { stepHead, chips, kpi } from './parts.js';
import { canPdf } from './view.js';

const STEP_NAMES = { start: 'Start of day', crew: 'Attendance', work: 'Work done', equipment: 'Equipment', materials: 'Materials', safety: 'Safety', photos: 'Photos', end: 'Tomorrow', me: 'Me', sign: 'Signature' };

export function end(c) {
  const r = c.report, setup = c.project.setup || {};
  const reqs = (r.requests || []).slice().reverse();
  const copy = unfinishedWork(r, setup);
  const zones = zonesOf(setup, c.s.siteZones[c.project.code], r.items);
  return {
    head: stepHead('Requests and tomorrow', 'Step 8 of 9 · End of day'),
    body: html`<div class="k">Requests to the office</div>
      ${reqs.length ? html`<div class="box">${reqs.map(q => html`<button type="button" class="li item" data-act="openReq" data-v="${q.id}">
        <span class="time ${q.priority === 'Urgent' ? 'urgent' : ''}">${q.priority === 'Urgent' ? 'Urgent' : q.at}</span><div class="n"><b>${q.text || 'No item written'}</b><span>${requestLine(q)}</span></div></button>`)}</div>`
        : html`<div class="box pad muted small">No requests yet. Ask for people, material, equipment or tools the site needs.</div>`}
      <button type="button" class="btn s" data-act="newReq">${icon('box')}Add a request</button>

      <div class="k">Plan for tomorrow</div>
      ${copy.length ? html`<button type="button" class="box pad allclear" data-act="copyPlan"><span class="ic">${icon('copy')}</span><div class="small left"><b>Copy unfinished work from today</b><br><span class="muted">${plural(copy.length, 'line')}: ${copy.slice(0, 2).map(planLine).join('; ')}${copy.length > 2 ? '…' : ''}</span></div></button>` : ''}
      ${(r.plan || []).length ? html`<div class="box">${r.plan.map((x, i) => html`<div class="li plan" data-i="${i}">
        <select class="fld slim zone" data-f="plan.${i}.zone" aria-label="Zone"><option value="">Zone</option>${zones.map(z => html`<option ${z === x.zone ? 'selected' : ''}>${z}</option>`)}</select>
        <div class="n">${x.task || x.type ? html`<span>${x.task || x.type}</span>` : ''}<input class="fld slim" data-f="plan.${i}.text" value="${x.text}" placeholder="What is planned" aria-label="What is planned"></div>
        <button type="button" class="mini" data-act="dropPlan" data-i="${i}" aria-label="Remove this line">×</button></div>`)}</div>` : ''}
      <button type="button" class="btn s" data-act="addPlan">${icon('plus')}Add a line</button>

      <label class="lab" for="nt">Notes <span class="muted thin">· optional</span></label>
      <textarea id="nt" class="fld" data-f="notes" rows="2" placeholder="Anything the office should know">${r.notes || ''}</textarea>
      <label class="lab" for="ins">Client engineer's instructions <span class="muted thin">· optional</span></label>
      <textarea id="ins" class="fld" data-f="instructions" rows="2" placeholder="What the client's engineer asked for today">${r.instructions || ''}</textarea>`,
    foot: html`<button type="button" class="btn p" data-act="dayDone" data-v="end">${icon('check')}${r.done.end ? 'Ticked as done' : reqs.length ? 'Done' : 'Done · no requests today'}</button>`,
  };
}

export function request(c) {
  const q = c.ui.req, editing = (c.report.requests || []).some(x => x.id === q.id);
  const seen = Object.values(c.s.drafts).flatMap(d => (d.received || []).map(y => y.name));
  const names = q.category === 'Material' ? materialChoices(c.project.setup, seen).slice(0, 10) : [];
  return {
    head: stepHead('Request', `${editing ? 'Edit' : 'New'} · ${q.at}`, 'end'),
    body: html`<div class="lab">Type</div>${chips('req.category', REQUEST_TYPES, q.category)}
      <div class="lab">What is needed</div>
      ${names.length ? chips('req.text', names, q.text) : ''}
      <input class="fld" data-f="req.text" value="${q.text}" placeholder="${q.category === 'Manpower' ? 'e.g. Two welders for the trusses' : 'e.g. Self-drilling screws 5.5 x 25'}" aria-label="What is needed">
      <div class="lab">Amount</div>
      <div class="two"><div class="stp"><button type="button" data-act="reqQty" data-d="-1" aria-label="Less">−</button>
        <input class="num" inputmode="decimal" data-f="req.qty" value="${q.qty ?? ''}" placeholder="0" aria-label="Amount"><button type="button" data-act="reqQty" data-d="1" aria-label="More">+</button></div>
        ${chips('req.unit', REQUEST_UNITS, q.unit)}</div>
      <div class="two"><div><label class="lab" for="nb">Needed by</label><input id="nb" class="fld" type="date" data-f="req.neededBy" value="${q.neededBy}" min="${c.today}"></div>
        <div><div class="lab">Priority</div>${chips('req.priority', PRIORITIES, q.priority)}</div></div>
      <label class="lab" for="rl">Where on site <span class="muted thin">· optional</span></label>
      <input id="rl" class="fld" data-f="req.location" value="${q.location}" placeholder="Zone or area">
      ${editing ? html`<button type="button" class="btn t danger" data-act="deleteReq">Delete this request</button>` : ''}`,
    foot: html`<div class="two"><button type="button" class="btn o" data-act="saveReq" data-v="again">Save, add another</button><button type="button" class="btn p" data-act="saveReq" ${requestReady(q) ? '' : 'disabled'}>${icon('check')}Save</button></div>`,
  };
}

/** The signature: the saved one, or a pad to sign once. */
function signBox(c) {
  const sig = c.s.profile.sig;
  if (sig) return html`<div class="box pad sigbox"><img src="${sig}" alt="Your signature"><div class="spread small"><span class="muted">Signed as ${c.s.profile.name}${c.s.profile.position ? `, ${c.s.profile.position}` : ''}</span><button type="button" class="btn t slim" data-act="clearSig">Sign again</button></div></div>`;
  return html`<div class="box pad sigbox"><canvas id="sigpad" width="600" height="200" aria-label="Sign here with your finger"></canvas>
    <span class="muted small">Sign with your finger. It is kept on this phone for the next reports.</span>
    <div class="spread"><button type="button" class="btn t slim" data-act="wipeSig">Clear</button><button type="button" class="btn s slim" data-act="saveSig">${icon('check')}Use this signature</button></div></div>`;
}

/** After sending: where the report is, and the PDF to open or share. */
function sentCard(c) {
  const r = c.report, s = r.sent || {};
  const t = x => (x ? new Date(x).toTimeString().slice(0, 5) : '');
  const stepsDone = [['Prepared', t(r.created)], ['Sent', t(r.sentAt)], ['With the office', s.status === 'submitted' || s.status === 'approved' || s.status === 'changes' ? 'waiting for review' : ''], ['Approved', s.status === 'approved' ? 'done' : '']];
  return html`<div class="box pad"><div class="spread"><b>${s.unchanged ? 'Already sent, no changes' : 'Sent to the office'}</b><span class="pill ok">Version ${s.version || 1}</span></div>
    <ol class="tl">${stepsDone.map(([k, v]) => html`<li class="${v ? 'on' : ''}"><b>${k}</b><span>${v || '–'}</span></li>`)}</ol>
    <div class="muted tiny">${s.name || ''}</div></div>`;
}

export function send(c) {
  const r = c.report, p = c.project;
  const list = checks(r, c.s.profile), ok = canSend(list), warns = list.filter(x => x.level === 'warn').length;
  const sum = summary(r), zones = byZone(r.items);
  const reqs = (r.requests || []).filter(requestReady), plan = (r.plan || []).filter(planReady);
  const changed = r.sentAt && r.updated > r.sentAt + 1000;
  const file = pdfName(p, r.date, r.no);
  const busy = c.ui.sending;
  return {
    head: stepHead('Review and send', `Step 9 of 9 · ${file}`),
    body: html`${r.sentAt ? sentCard(c) : ''}
      ${changed ? html`<p class="callout warn">Changed after sending. Send again so the office has the new version.</p>` : ''}
      ${r.queuedAt && !r.sentAt ? html`<p class="callout warn">Saved on this phone at ${new Date(r.queuedAt).toTimeString().slice(0, 5)}. It goes to the office by itself when there is a connection.</p>` : ''}
      <div class="kpis four">${kpi(sum.present, 'Present')}${kpi(html`${sum.manHours}<small>h</small>`, 'Man-hours')}${kpi(sum.items, 'Work items')}${kpi(sum.photos, 'Photos')}</div>
      ${list.length ? html`<div class="k">${warns ? `${plural(warns, 'thing')} to look at · sending still works` : 'Before sending'}</div>
        <div class="box">${list.map(x => html`<button type="button" class="li chk ${x.level}" data-act="${x.step === 'sign' ? 'toSign' : 'go'}" data-to="${x.step}">
          <span class="ic ${x.level === 'need' ? 'bad' : 'warn'}">${icon('alert')}</span><div class="n"><b>${x.text}</b><span>${STEP_NAMES[x.step] || ''}</span></div><span class="ch">${icon('chev')}</span></button>`)}</div>`
        : html`<div class="soft small"><b>Everything is in.</b> <span class="muted">Sign and send.</span></div>`}
      <div class="k">The report</div>
      <div class="box pad prev">
        <div class="spread"><b>Report #${r.no} · ${dayLabel(r.date)}</b><span class="muted small">${p.name}</span></div>
        <p class="small muted">${r.start.start}–${r.start.end} · ${[r.start.cond, r.start.tempC !== '' && r.start.tempC != null ? `${r.start.tempC} °C` : '', r.start.ground].filter(Boolean).join(', ')} · ${r.start.location}</p>
        <b class="small">Work done</b>
        ${zones.length ? zones.map(z => html`<div class="small"><b>${z.zone}</b><ul>${z.lines.map(l => html`<li>${l}</li>`)}</ul></div>`) : html`<p class="small muted">No work logged.</p>`}
        <b class="small">Equipment</b><p class="small">${r.equipment.length ? r.equipment.map(e => `${e.qty} × ${e.name}${e.status !== 'Active' ? ` (${e.status.toLowerCase()})` : ''}`).join(', ') : 'None'}</p>
        <b class="small">Safety and delays</b><p class="small">${sum.safety}${r.safety.toolbox ? ' · toolbox talk held' : ''}${r.delays.length ? ` · ${plural(r.delays.length, 'delay')}, ${sum.delayHours} h` : ' · no delays'}</p>
        <b class="small">Materials received</b><p class="small">${r.received.length ? r.received.map(x => `${x.name}${x.qty != null && x.qty !== '' ? ` ${x.qty} ${x.unit}` : ''}`).join(', ') : 'Nothing received'}</p>
        <b class="small">Requests</b><p class="small">${reqs.length ? reqs.map(q => `${q.priority === 'Urgent' ? 'URGENT ' : ''}${q.text}`).join('; ') : 'None'}</p>
        <b class="small">Tomorrow</b><p class="small">${plan.length ? plan.map(planLine).join('; ') : 'No plan given'}</p>
      </div>
      <button type="button" class="btn o" data-act="viewReport">${icon('doc')}View the report with photos</button>
      ${canPdf(c) ? html`<button type="button" class="btn t" data-act="openPdf" ${busy ? 'disabled' : ''}>${icon('doc')}${c.ui.pdfBusy ? 'Making the PDF…' : 'See the PDF'}</button>` : ''}
      <div class="k" id="sign">Signature</div>${signBox(c)}`,
    foot: r.sentAt && !changed
      ? html`<div class="two">${canPdf(c) ? html`<button type="button" class="btn o" data-act="sharePdf">${icon('send')}Share the PDF</button>` : html`<button type="button" class="btn o" data-act="viewReport">${icon('doc')}View the report</button>`}<button type="button" class="btn p" data-act="go" data-to="today">${icon('check')}Back to Today</button></div>`
      : html`<button type="button" class="btn p" data-act="sendReport" ${ok && !busy ? '' : 'disabled'}>${icon('send')}${busy ? c.ui.sending : !ok ? 'Sign to send' : changed ? 'Send the new version' : warns ? 'Send anyway' : 'Send the report'}</button>
        <div class="center muted tiny">${isDemo() ? 'Demo: nothing leaves this browser.' : 'Goes to the office with the photos. Saved on the phone if there is no connection.'}</div>`,
  };
}
