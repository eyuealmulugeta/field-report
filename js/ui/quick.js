// 2.11.0: Quick (the + tab): the features a person uses most, saved on this phone and shown as icons.
// "+" (Edit) shows every feature to add or take away; a tap on an icon opens the feature.

import { html, icon } from '../core/dom.js';
import { head } from './parts.js';

/** Every feature Quick can hold: [id, title, icon, action, route]. */
export const FEATURES = [
  ['photo', 'Activity photo', 'cam', 'logPhoto'],
  ['work', 'Work done', 'check', 'go', 'work'],
  ['att', 'Office attendance', 'users', 'go', 'att'],
  ['delivery', 'Delivery', 'truck', 'logDelivery'],
  ['delay', 'Delay', 'clock', 'logDelay'],
  ['request', 'Request', 'box', 'logReq'],
  ['incident', 'Incident', 'alert', 'logIncident'],
  ['spot', 'Spotlight', 'sun', 'go', 'spot'],
  ['attention', 'Attention', 'bell', 'go', 'attention'],
  ['equipment', 'Equipment', 'tool', 'go', 'equipment'],
  ['materials', 'Materials', 'list', 'go', 'materials'],
  ['safety', 'Safety', 'shield', 'go', 'safety'],
  ['photos', 'Photos', 'cam', 'go', 'photos'],
  ['send', 'Send the report', 'send', 'go', 'send'],
  ['reports', 'Reports', 'doc', 'go', 'reports'],
  ['requests', 'Requests', 'box', 'go', 'requests'],
  ['me', 'Me', 'user', 'go', 'me'],
];
export const QUICK_DEFAULT = ['photo', 'work', 'att', 'delivery', 'request', 'spot', 'send'];
const KEY = 'fr2:quick';

/** The saved list (this phone only); the default until the person changes it. */
export function quickList() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v.filter(id => FEATURES.some(f => f[0] === id)); } catch { /* private window */ }
  return QUICK_DEFAULT;
}
export function quickToggle(id) {
  const now = quickList(), next = now.includes(id) ? now.filter(x => x !== id) : [...now, id];
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not kept */ }
  return next;
}

const tile = f => html`<button type="button" class="qtile" data-act="${f[3]}" ${f[4] ? `data-to="${f[4]}"` : ''}><span class="qic">${icon(f[2])}</span><span>${f[1]}</span></button>`;

export function quick(c) {
  const mine = quickList(), edit = !!c.ui.quickEdit;
  const shown = mine.map(id => FEATURES.find(f => f[0] === id)).filter(Boolean);
  return {
    tab: 'quick',
    head: head('Quick', 'Your most used, one tap away'),
    body: edit
      ? html`<p class="muted small">Tap to add (+) or take away (✓). Saved on this phone.</p>
        <div class="box">${FEATURES.map(f => html`<button type="button" class="li" data-act="quickPin" data-v="${f[0]}"><span class="ic">${icon(f[2])}</span><div class="n"><b>${f[1]}</b></div><span class="qpin ${mine.includes(f[0]) ? 'on' : ''}">${mine.includes(f[0]) ? '✓' : '+'}</span></button>`)}</div>
        <button type="button" class="btn p" data-act="quickEdit">${icon('check')}Done</button>`
      : html`<div class="qgrid">${shown.map(tile)}<button type="button" class="qtile add" data-act="quickEdit" aria-label="Add or take away"><span class="qic">${icon('plus')}</span><span>Add</span></button></div>`,
  };
}
