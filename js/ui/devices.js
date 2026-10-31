// trial.2: the Admin's list of devices (script 7.28.0). A person signing in on a new device is refused with
// "Unauthorized user" until the Admin taps Approve; the Admin's own new devices are allowed and only reported.

import { html, icon } from '../core/dom.js';

const when = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
export const isAdmin = c => ((c.s.auth || {}).role || '') === 'admin';
export const waiting = c => (c.ui.devs || []).filter(d => d.st === 'wait');

/** Today: a line for the Admin when a device waits. */
export function devBanner(c) {
  const n = isAdmin(c) ? waiting(c).length : 0;
  return n ? html`<button type="button" class="li callout warn" data-act="go" data-to="me"><span class="ic warn">${icon('alert')}</span>
    <div class="n"><b>${n} new device${n === 1 ? '' : 's'} waiting</b><span>Someone signed in on a new device. Approve or deny it in Me.</span></div></button>` : '';
}

/** Me: every device, waiting ones first, with Approve and Deny. */
export function devicesBox(c) {
  if (!isAdmin(c)) return '';
  const list = c.ui.devs, me = (c.s.auth || {}).email || '';
  return html`<div class="k">Devices${list && waiting(c).length ? ` · ${waiting(c).length} waiting` : ''}</div>
    ${!list ? html`<button type="button" class="btn o" data-act="devices">Show devices</button>`
      : !list.length ? html`<div class="box pad muted small">No devices yet.</div>`
      : html`<div class="box">${list.map(d => {
        const mine = d.email === me && d.dev === c.devId;
        return html`<div class="li dev ${d.st}"><div class="n"><b>${d.name || d.email.split('@')[0]} · ${d.email}${mine ? ' (this phone)' : ''}</b>
          <span>${d.mode === 'app' ? 'Installed app · ' : d.mode === 'browser' ? 'Browser · ' : ''}${d.ip ? `IP ${d.ip} · ${d.loc ? `${d.loc} (approximate)` : 'place not known'}` : 'IP not known'}${d.ua ? ` · ${d.ua}` : ''}</span>
          <span>First seen ${when(d.first)}${d.note && d.st === 'ok' ? ` · ${d.note}, kept without an alert` : d.at && d.st !== 'wait' ? ` · ${d.st === 'ok' ? 'approved' : 'denied'} by ${d.by} ${when(d.at)}` : ''}</span>
          <span class="two">${d.st !== 'ok' ? html`<button type="button" class="btn p slim" data-act="devDecide" data-email="${d.email}" data-dev="${d.dev}" data-v="approve">Approve</button>` : ''}${d.st !== 'deny' && !mine ? html`<button type="button" class="btn o slim bad" data-act="devDecide" data-email="${d.email}" data-dev="${d.dev}" data-v="deny">Deny</button>` : ''}</span></div>
          <span class="pill ${d.st === 'wait' ? 'warn' : d.st === 'ok' ? 'ok' : 'bad'}">${d.st === 'wait' ? 'Waiting' : d.st === 'ok' ? 'Approved' : 'Denied'}</span></div>`;
      })}</div>`}
    <p class="muted tiny">A denied phone is signed out at its next connection. The place comes from the IP address and is only approximate. On an iPhone, the installed app and the browser count as two devices.</p>
    ${refusedBox(c)}`;
}

const WHY = { wait: 'Waiting for approval', deny: 'Phone refused', gone: 'Phone not on the list', suspended: 'Suspended', blocked: 'Blocked', nostorage: 'Browser keeps no data', oldapp: 'Old app', noaccess: 'Email has no access' };

/** 2.2.0: the last refused sign-ins and why, so the Admin can tell a phone that waits from one that was refused. */
function refusedBox(c) {
  const list = c.ui.refused || [];
  if (!list.length) return '';
  return html`<div class="k">Refused sign-ins · last ${list.length}</div>
    <div class="box">${list.map(r => html`<div class="li"><div class="n"><b>${r.name || r.email.split('@')[0]} · ${r.email}</b>
      <span>${WHY[r.why] || r.why}${r.n > 1 ? ` · ${r.n} times` : ''} · ${when(r.at)} · ${r.mode === 'app' ? 'Installed app' : r.mode === 'browser' ? 'Browser' : 'App type not known'}${r.ua ? ` · ${r.ua}` : ''}</span></div></div>`)}</div>`;
}
