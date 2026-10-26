// The computer and tablet layout (docs/desktop-proposal.html): a menu on the left, the day's steps in the middle,
// the open step in a workspace on the right. The phone layout is untouched.

import { html, icon } from '../core/dom.js';
import { dayLabel } from '../core/util.js';
import { doneCount } from '../model/report.js';
import { totals } from '../model/crew.js';
import { itemLine } from '../model/items.js';
import { TABS, dayList, kpi } from './parts.js';
import { thumb, plannedBox } from './work.js';
import { READY, weekStrip } from './screens.js';
import { isDemo } from '../core/api.js';

/** 'desk' (1200 px and wider), 'tab' (768–1199) or 'phone'. */
export const layoutOf = w => (w >= 1200 ? 'desk' : w >= 768 ? 'tab' : 'phone');

export function rail(c, on) {
  const p = c.project, saved = c.report && c.report.updated;
  const time = saved ? new Date(saved).toTimeString().slice(0, 5) : '';
  return html`<aside class="rail">
    <div class="brand"><img class="logo" src="icon-192.png" alt="Amistad Prefab"><div class="wide-only"><b>Field Report</b><span>Amistad Prefab</span></div></div>
    <button type="button" class="proj wide-only" data-act="go" data-to="me" title="Change project"><div><b>${p.name}</b><span>${p.code}${p.location ? ` · ${p.location}` : ''}</span></div></button>
    ${TABS.map(t => html`<button type="button" class="navi ${t.id === on ? 'on' : ''}" data-act="go" data-to="${t.id}" title="${t.title}">${icon(t.icon)}<span class="wide-only">${t.title}</span></button>`)}
    <button type="button" class="log" data-act="fab" title="Log now (N)">${icon('plus')}<span class="wide-only">Log now</span><kbd class="wide-only">N</kbd></button>
    <div class="rail-foot wide-only">${time ? html`<span><b>● Saved</b> on this computer · ${time}</span>` : ''}<span>${c.s.profile.name}${c.s.profile.position ? ` · ${c.s.profile.position}` : ''}</span>${isDemo() ? html`<span class="pill warn">Demo</span>` : ''}</div>
  </aside>`;
}

/** The day column: the date, the progress and the nine steps, the open one highlighted. */
export function dayPane(c, sel) {
  const r = c.report, n = doneCount(r);
  return html`<section class="dayc">
    <div class="soft"><div class="spread"><b class="big-t">${dayLabel(c.today)}</b><span class="k brand">Report #${r.no}</span></div>
      <div class="bar gap"><i style="width:${Math.round(n / 9 * 100)}%"></i></div><span class="muted small">${n} of 9 done</span></div>
    ${dayList(r, READY, sel, true)}
  </section>`;
}

/** Today on a computer: everything logged so far at a glance. */
export function glance(c) {
  const r = c.report, s = r.start, t = totals(r.crew, s.start, s.end);
  const items = [...r.items].reverse();
  return {
    head: html`<header class="hd"><div class="hd-t"><b>Today at a glance</b><span>Everything logged so far · the office sees it when the report is sent</span></div>
      <div class="r row-btns"><button type="button" class="btn o sm" data-act="noWork">No work today</button><button type="button" class="btn s sm" data-act="go" data-to="crew">Attendance</button></div></header>`,
    body: html`<div class="kpis five">${kpi(t.present, 'Present')}${kpi(t.away, 'Not here', t.away ? 'warn' : '')}${kpi(html`${t.manHours}<small>h</small>`, 'Man-hours')}${kpi(r.items.length, 'Work items')}${kpi(r.photos.length, 'Photos')}</div>
      ${plannedBox(r)}
      <div class="grid2 top">
        <div class="box pad"><div class="k">Work done today</div>
          ${items.length ? items.slice(0, 6).map(i => html`<button type="button" class="li item" data-act="openItem" data-v="${i.id}"><span class="time">${i.at}</span><div class="n"><b>${itemLine(i) || 'Work'}</b><span class="clamp">${i.text}</span></div></button>`)
            : html`<p class="muted small">Nothing yet. Press <kbd>N</kbd> or Log now the moment work is done.</p>`}</div>
        <div class="box pad"><div class="k">Needs you</div><p class="muted small">Nothing from the office.</p>
          <div class="k">This week</div>${weekStrip(c)}</div>
      </div>
      ${r.photos.length ? html`<div class="box pad"><div class="k">Today's photos</div><div class="tiles">${r.photos.map(p => thumb(p.id))}</div></div>` : ''}`,
  };
}
