// Pieces every screen uses: the header, the tab bar, chips, number steppers and the day's step list.

import { html, icon } from '../core/dom.js';
import { PHASES, STEPS, stepStatus, stampLine } from '../model/report.js';

export const TABS = [
  { id: 'today', title: 'Today', icon: 'home' },
  { id: 'att', title: 'Office', icon: 'users' },   // 2.13.1: the page itself says Attendance   // 2.10.0
  { id: 'reports', title: 'Reports', icon: 'doc' },
  { id: 'requests', title: 'Requests', icon: 'box' },
  { id: 'quick', title: 'Quick', icon: 'plus' },   // 2.11.0: the + tab
];   // 2.8.0: Me is the person button at the top right (`head`)

/** 2.6.0: a reviewer or viewer account: Review, Crew and Me. */
export const REVIEW_TABS = [
  { id: 'review', title: 'Review', icon: 'doc' },
  { id: 'crewrev', title: 'Crew', icon: 'users' },
];
/** 2.7.0: one account (owner, 31 Oct): the PM and GM keep every page of the site and get Review as well. A viewer reads only. */
// 2.16.1: Review before Quick (owner, 1 Nov)
export const tabsFor = kind => (kind === 'viewer' ? REVIEW_TABS.filter(t => t.id !== 'crewrev') : kind === 'reviewer' ? [...TABS.filter(t => t.id !== 'quick'), REVIEW_TABS[0], TABS.find(t => t.id === 'quick')] : TABS);

/** 2.16.1: the GM (an exec account, or GM as position) switches project from a list at the top, as in Central Hub. */
/** 2.35.0: the phone is not signed in to Central Hub's database while reports must also go there (data route Both). */
export const dbBar = (ui, waiting = 0) => (ui.liveRoute === 'both' && ui.live === 'signin'
  ? html`<button type="button" class="db-bar" data-act="liveConnect"><b>Not connected to the database.</b> Tap to sign in again${waiting ? ` · ${waiting} report${waiting > 1 ? 's' : ''} waiting` : ''}</button>`
  : '');

export const isGM = c => (c.s.auth || {}).role === 'exec' || /\bgm\b|general manager/i.test((c.s.profile || {}).position || '');
export const TOP_PROJ = new Set(['today', 'att', 'reports', 'requests', 'review']);
// 2.17.0: "All projects" on Reports, Requests and Review
export const ALL_PROJ = new Set(['reports', 'requests', 'review']);
export const projTop = (c, all = false) => html`<div class="proj-top"><select data-proj aria-label="Project">${all ? html`<option value="*" ${c.ui && c.ui.allProj ? 'selected' : ''}>All projects</option>` : ''}${c.s.projects.map(x => html`<option value="${x.code}" ${x.code === c.s.proj && !(all && c.ui && c.ui.allProj) ? 'selected' : ''}>${x.name} · ${x.code}</option>`)}</select></div>`;

export const nav = (on, badges = {}, kind = 'reporter') => html`<nav class="nav">${tabsFor(kind).map(t => html`
  <button type="button" class="${t.id === on ? 'on' : ''}" data-act="go" data-to="${t.id}">${icon(t.icon)}<span>${t.title}${badges[t.id] ? html`<i class="badge">${badges[t.id]}</i>` : ''}</span></button>`)}
</nav>`;

/** Header for a tab: logo, title, subtitle and an optional pill on the right. */
export const head = (title, sub, pill) => html`<header class="hd"><img class="logo" src="icon-192.png" alt="Amistad Prefab"><div class="hd-t"><b>${title}</b><span>${sub}</span></div>${pill ? html`<span class="r pill info">${pill}</span>` : ''}<button type="button" class="mebtn" data-act="go" data-to="me" aria-label="Me: your name, signature and settings">${icon('user')}</button></header>`;

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
      // 2.32.0 (owner): a step with nothing in yet is red, so the reporter sees what is left
      return html`<button type="button" class="st ${open ? '' : 'later'} ${open && st.state === 'no' ? 'empty' : ''} ${sel === s.id ? 'sel' : ''}" data-act="${open ? 'go' : 'later'}" data-to="${s.id}">
        ${dot(st, s.i)}<div class="n"><b>${s.title}</b><span>${[st.line, stampLine((r && r.stamps || {})[s.id])].filter(Boolean).join(' · ')}</span></div>${keys ? html`<kbd>${s.i + 1}</kbd>` : open ? html`<span class="ch">${icon('chev')}</span>` : ''}</button>`;
    })}</div>`;
  });
}

/** 2.8.0: the projects of this account, the open one ticked; a tap switches the project and stays on the page. */
export const projPick = (c, act = 'projHere', always = false) => (c.s.projects.length > (always ? 0 : 1) ? html`<div class="k">Project</div><div class="box">${c.s.projects.map(x => html`<button type="button" class="li ${x.code === c.s.proj ? 'sel' : ''}" data-act="${act}" data-v="${x.code}"><span class="ic ${x.code === c.s.proj ? 'ok' : ''}">${icon(x.code === c.s.proj ? 'check' : 'pin')}</span><div class="n"><b>${x.name}</b><span>${x.code}</span></div></button>`)}</div>` : '');

export const kpi = (value, label, cls = '') => html`<div class="kpi ${cls}"><b>${value}</b><span>${label}</span></div>`;
