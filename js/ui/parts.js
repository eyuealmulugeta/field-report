// Pieces every screen uses: the header, the tab bar, chips, number steppers and the day's step list.

import { html, icon } from '../core/dom.js';
import { PHASES, STEPS, stepStatus } from '../model/report.js';

export const TABS = [
  { id: 'today', title: 'Today', icon: 'home' },
  { id: 'reports', title: 'Reports', icon: 'doc' },
  { id: 'requests', title: 'Requests', icon: 'box' },
  { id: 'me', title: 'Me', icon: 'user' },
];

/** 2.6.0: a reviewer or viewer account: Review, Crew and Me. */
export const REVIEW_TABS = [
  { id: 'review', title: 'Review', icon: 'doc' },
  { id: 'crewrev', title: 'Crew', icon: 'users' },
  { id: 'me', title: 'Me', icon: 'user' },
];
export const tabsFor = kind => (kind && kind !== 'reporter' ? REVIEW_TABS : TABS);

export const nav = (on, badges = {}, kind = 'reporter') => html`<nav class="nav">${tabsFor(kind).map(t => html`
  <button type="button" class="${t.id === on ? 'on' : ''}" data-act="go" data-to="${t.id}">${icon(t.icon)}<span>${t.title}${badges[t.id] ? html`<i class="badge">${badges[t.id]}</i>` : ''}</span></button>`)}
</nav>`;

/** Header for a tab: logo, title, subtitle and an optional pill on the right. */
export const head = (title, sub, pill) => html`<header class="hd"><img class="logo" src="icon-192.png" alt="Amistad Prefab"><div class="hd-t"><b>${title}</b><span>${sub}</span></div>${pill ? html`<span class="r pill info">${pill}</span>` : ''}</header>`;

/** Header for a step: a back button, the step and where it sits in the day. */
export const stepHead = (title, sub, back = 'today') => html`<header class="hd"><button type="button" class="bk" data-act="go" data-to="${back}" aria-label="Back">${icon('back')}</button><div class="hd-t"><b>${title}</b><span>${sub}</span></div></header>`;

export const chips = (field, options, value, extra = '') => html`<div class="chips" role="group">${options.map(o => html`
  <button type="button" class="chip ${o === value ? 'on' : ''}" data-act="pick" data-f="${field}" data-v="${o}" aria-pressed="${o === value}">${o}</button>`)}${extra}</div>`;

/** − value + ; i is the row it belongs to, when it sits in a list. */
export const stepper = (act, value, label, i) => html`<div class="stp" ${i == null ? '' : html`data-i="${i}"`}>
  <button type="button" data-act="${act}" data-d="-1" aria-label="Less">−</button><b>${label ?? value}</b><button type="button" data-act="${act}" data-d="1" aria-label="More">+</button></div>`;

const dot = (st, i) => st.state === 'ok' ? html`<span class="dot ok">${icon('check')}</span>`
  : st.state === 'half' ? html`<span class="dot half">${st.count || i + 1}</span>`
  : html`<span class="dot no">${i + 1}</span>`;

/** The day's nine steps in three parts, each with its tick and what is already in. */
export function dayList(r, ready = new Set(), sel = '', keys = false) {
  return PHASES.map(ph => {
    const steps = STEPS.map((s, i) => ({ ...s, i })).filter(s => s.phase === ph.id);
    return html`<div class="phase"><span class="k">${ph.title}</span><span class="t">${ph.note || ''}</span></div>
    <div class="steps">${steps.map(s => {
      const st = stepStatus(r, s.id);
      const open = ready.has(s.id);
      return html`<button type="button" class="st ${open ? '' : 'later'} ${sel === s.id ? 'sel' : ''}" data-act="${open ? 'go' : 'later'}" data-to="${s.id}">
        ${dot(st, s.i)}<div class="n"><b>${s.title}</b><span>${st.line}</span></div>${keys ? html`<kbd>${s.i + 1}</kbd>` : open ? html`<span class="ch">${icon('chev')}</span>` : ''}</button>`;
    })}</div>`;
  });
}

export const kpi = (value, label, cls = '') => html`<div class="kpi ${cls}"><b>${value}</b><span>${label}</span></div>`;
