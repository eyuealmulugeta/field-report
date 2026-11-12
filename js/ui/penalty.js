// 2.57.0 (owner, R3): Review > Penalties. Give a penalty (person, day, reason, amount); the PE or GM approves or rejects.

import { html, icon } from '../core/dom.js';
import { head, reviewTabs } from './parts.js';
import { REASONS, reasonWord, PEN_WORD, PEN_TONE, mayGive, mayDecide, sortPenalties } from '../model/penalty.js';

const money = n => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ETB`;

export function penalties(c) {
  const role = (c.s.auth || {}).role || '', me = String((c.s.auth || {}).email || '').toLowerCase();
  const list = sortPenalties(c.ui.pens || []), staff = c.project.staff || [], f = c.ui;
  const waiting = list.filter(p => p.status === 'waiting').length;
  const form = c.ui.penOpen ? html`<div class="box pad pen-form">
      <label class="lab" for="penWho">Person</label>
      <select id="penWho" class="fld" data-ui="penWho"><option value="">Choose…</option>${staff.map(s => html`<option value="${s.id}" ${String(s.id) === String(f.penWho || '') ? 'selected' : ''}>${s.name}${s.trade || s.title ? ` · ${s.trade || s.title}` : ''}</option>`)}</select>
      <label class="lab" for="penDate">Day</label>
      <input id="penDate" class="fld" type="date" data-ui="penDate" value="${f.penDate || c.realToday}" max="${c.realToday}">
      <label class="lab">Reason</label>
      <div class="seg wide" role="group" aria-label="Reason">${REASONS.map(([v, w]) => html`<button type="button" class="${f.penReason === v ? 'on' : ''}" data-act="penReason" data-v="${v}" aria-pressed="${f.penReason === v}">${w}</button>`)}</div>
      <label class="lab" for="penAmt">Amount (ETB)</label>
      <input id="penAmt" class="fld" type="number" inputmode="decimal" min="1" step="1" data-ui="penAmt" value="${f.penAmt || ''}" placeholder="e.g. 200">
      <div class="row"><button type="button" class="btn p" data-act="penSave" ${c.ui.busy ? 'disabled' : ''}>Send for approval</button><button type="button" class="btn t" data-act="penClose">Cancel</button></div>
      <p class="tiny muted">The Project Engineer or the GM approves it. Once approved it is taken off the person's pay in Central Hub.</p></div>` : '';
  return {
    tab: 'penalties',
    head: head('Penalties', `${list.length} on this project`, waiting ? `${waiting} waiting` : ''),
    body: html`${reviewTabs('penalties', c)}
      ${c.ui.live !== 'on' && !c.demo ? html`<p class="callout warn small">Penalties need the connection to Central Hub. Check the internet, then open this page again.</p>` : ''}
      ${mayGive(role) && !c.ui.penOpen ? html`<button type="button" class="btn o wide" data-act="penOpen">${icon('plus')}Give a penalty</button>` : ''}
      ${form}
      ${list.length ? html`<div class="box">${list.map(p => {
        const mine = String(p.by || '').toLowerCase() === me;
        return html`<div class="li item">
          <span class="time">${String(p.date || '').slice(5)}</span>
          <div class="n"><b>${p.name} · ${money(p.amount)}</b><span>${reasonWord(p.reason)} · given by ${p.byName || p.by}${p.decidedByName ? ` · ${p.status} by ${p.decidedByName}` : ''}</span></div>
          <span class="pill ${PEN_TONE[p.status] || ''}">${PEN_WORD[p.status] || p.status}</span>
          ${p.status === 'waiting' && mayDecide(role) && !mine ? html`<button type="button" class="btn p slim" data-act="penDecide" data-v="approved" data-id="${p.id}" ${c.ui.busy ? 'disabled' : ''}>Approve</button><button type="button" class="btn t slim bad-t" data-act="penDecide" data-v="rejected" data-id="${p.id}" ${c.ui.busy ? 'disabled' : ''}>Reject</button>` : ''}
          ${p.status === 'waiting' && mine ? html`<button type="button" class="btn t slim" data-act="penDecide" data-v="cancelled" data-id="${p.id}" ${c.ui.busy ? 'disabled' : ''}>Cancel</button>` : ''}
        </div>`;
      })}</div>` : html`<p class="muted">No penalties on this project.</p>`}`,
  };
}
