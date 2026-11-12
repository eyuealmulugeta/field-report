// 2.95.0 (owner, 12 Nov, R6): the GM's Overview, the first tab of the Dashboard (phone and computer). Everything on it
// comes live from Central Hub and redraws the moment something changes. The Admin and the GM see it; the Executive
// does not (owner: "no").
import { html } from '../core/dom.js';
import { board } from '../model/gm.js';
import { monthDays, STATUS } from '../model/follow.js';
import { openPOs } from '../model/store.js';

const wd = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });
const card = (v, label, sub = '', tone = '') => html`<div class="gm-kpi ${tone}"><b>${v}</b><span>${label}</span>${sub ? html`<small>${sub}</small>` : ''}</div>`;

export function boardBody(c) {
  const p = c.project, s = c.s, today = c.realToday;
  const rows = monthDays(today, p, s.drafts || {}, s.known || {}, (s.others || {})[p.code] || []);
  const sm = c.ui.smList || [];
  const b = board({ rows, marks: c.ui.marksOf === p.code ? c.ui.marks || {} : {}, team: c.ui.teamOf === p.code ? c.ui.team || [] : [], reqs: c.ui.liveReqs || [],
    sm, pos: openPOs(c.ui.poList || [], sm, today).length, pens: c.ui.pens || [], shots: c.ui.shList || [], spots: (c.ui.spotLive || []).filter(x => x.proj === p.code), today });
  const st = STATUS[b.day.kind] || STATUS.today;
  const live = c.ui.live === 'on';
  return html`<div class="gm">
    <div class="gm-live ${live ? 'on' : ''}"><i></i>${live ? 'Live: changes show here at once' : 'Not live: showing what this phone has (sign in with Google under Me to go live)'}</div>
    <div class="gm-grid">
      ${card(html`<span class="pill ${st.cls}">${b.day.kind === 'today' ? 'Not sent yet' : st.label}</span>`, "Today's report", b.day.no ? `#${b.day.no}${b.day.late ? ` · ${b.day.late}` : ''}` : '')}
      ${card(b.crew.total ? `${b.crew.present}/${b.crew.total}` : b.crew.present, 'Crew present today', b.crew.total ? `${b.crew.rate}% · ${b.crew.absent} absent` : `${b.crew.absent} absent`)}
      ${card(`${b.k.onTime}%`, 'Reports sent, last 7 days', `${b.k.toReview} to approve · ${b.k.sentBack} sent back`, b.k.onTime < 70 ? 'warn' : '')}
      ${card(b.req.open, 'Open requests', b.req.urgent ? `${b.req.urgent} urgent` : 'none urgent', b.req.urgent ? 'bad' : '')}
      ${card(b.k.pos, 'Open purchase orders', `${b.k.store} store movements waiting`)}
      ${card(html`👍 ${b.spot.pos} · 👎 ${b.spot.neg}`, 'Spotlight today', `${b.spot.visit} visitor${b.spot.visit === 1 ? '' : 's'}`, b.spot.neg ? 'warn' : '')}
    </div>
    <div class="gm-cols">
      <section class="gm-box"><h3>Needs you</h3>
        ${b.needs.length ? b.needs.map(n => html`<button type="button" class="li gm-need" data-act="gmGo" data-to="${n.to}"><span class="gm-n">${n.n}</span><span class="grow">${n.text}</span><span class="muted">›</span></button>`)
          : html`<p class="muted small">Nothing waits for you on this project.</p>`}</section>
      <section class="gm-box"><h3>Reports, last 7 days</h3>
        <div class="gm-week">${b.week.map(r => { const x = STATUS[r.kind] || STATUS.today; return html`<div class="gm-day ${x.cls}" title="${r.date}: ${x.label}"><span>${wd(r.date)}</span><i></i><small>${r.date === today && r.kind === 'today' ? 'Today' : x.label}</small></div>`; })}</div>
      </section>
    </div>
    <p class="muted tiny">Figures for ${p.name}. Approving and deciding stay on their own pages; this page only shows.</p>
  </div>`;
}
