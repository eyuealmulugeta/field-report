// trial.2: the report as a plain page with its photos, for everyone. The report PDF itself is for the Admin only
// (and Central Hub): this page has no download, share or print. Same sections as the PDF (js/pdf.js).

import { html, icon } from '../core/dom.js';
import { dayLabel } from '../core/util.js';
import { pdfName } from '../core/names.js';
import { totals } from '../model/crew.js';
import { summary, byZone, requestReady, planReady, planLine } from '../model/end.js';
import { photoCaption } from '../pdf.js';
import { stepHead, kpi } from './parts.js';
import { thumb } from './work.js';

/** Only the Admin may see, share or download the report PDF. */
export const canPdf = c => ((c.s.auth || {}).role || 'engineer') === 'admin';

const sec = (title, inner) => html`<div class="k">${title}</div><div class="box pad rv-sec">${inner}</div>`;
const none = text => html`<p class="small muted">${text}</p>`;
const qty = x => (x.qty != null && x.qty !== '' ? `${x.qty} ${x.unit}` : '');

export function view(c) {
  const r = c.s.drafts[c.ui.viewKey || ''] || c.report;
  if (!r) return { head: stepHead('Report', '', 'reports'), body: html`<div class="box pad muted small">This report is not on this phone.</div>` };
  const p = c.project, st = r.start || {}, s = summary(r), t = totals(r.crew, st.start, st.end);
  const back = c.ui.viewBack || 'send';
  const reqs = (r.requests || []).filter(requestReady), plan = (r.plan || []).filter(planReady), zones = byZone(r.items);
  return {
    head: stepHead(`Report #${r.no}`, `${dayLabel(r.date)} · ${p.name}`, back),
    body: html`<div class="rview">
      <div class="kpis">${kpi(s.present, 'Present')}${kpi(s.manHours, 'Man-hours')}${kpi(s.items, 'Work items')}${kpi(s.photos, 'Photos')}</div>
      ${sec('Information', html`<p class="small">${pdfName(p, r.date, r.no)}</p>
        <p class="small">${st.start || ''}–${st.end || ''} · ${[st.cond, st.tempC !== '' && st.tempC != null ? `${st.tempC} °C` : '', st.wind, st.ground].filter(Boolean).join(', ') || 'No weather'} · ${st.location || ''}</p>
        <p class="small muted">Prepared by ${[c.s.profile.name, c.s.profile.position].filter(Boolean).join(', ')}</p>`)}
      ${sec('Work done by zone', zones.length ? zones.map(z => html`<div class="small"><b>${z.zone}</b><ul>${z.lines.map(l => html`<li>${l}</li>`)}</ul></div>`) : none('No work logged.'))}
      ${sec('Manpower and equipment', html`<p class="small">${t.byTrade.map(x => `${x.qty} ${x.trade} (${x.hrs} h)`).join(', ') || 'No crew'} · ${t.present} present, ${t.manHours} man-hours</p>
        <p class="small">${r.equipment.length ? r.equipment.map(e => `${e.qty} × ${e.name}, ${e.hrs} h${e.status !== 'Active' ? ` (${e.status.toLowerCase()})` : ''}`).join('; ') : 'No equipment'}</p>`)}
      ${sec('Safety and delays', html`<p class="small">Toolbox talk ${r.safety.toolbox ? 'held' : 'not held'} · ${r.safety.incident ? `${s.safety}: ${r.safety.note || 'no description'}` : 'No incidents'}</p>
        ${r.delays.length ? html`<ul class="small">${r.delays.map(x => html`<li>${x.at} · ${x.cause}${x.party ? ` (${x.party})` : ''} · ${x.hours} h${x.note ? ` · ${x.note}` : ''}</li>`)}</ul>` : none('No delays.')}`)}
      ${sec('Materials received', r.received.length ? html`<ul class="small">${r.received.map(x => html`<li>${x.at} · ${x.name}${qty(x) ? ` · ${qty(x)}` : ''}${x.note ? ` · ${x.note}` : ''}</li>`)}</ul>` : none('Nothing received.'))}
      ${sec('Requests', reqs.length ? html`<ul class="small">${reqs.map(q => html`<li>${q.priority === 'Urgent' ? 'URGENT · ' : ''}${q.category} · ${q.text}${qty(q) ? ` · ${qty(q)}` : ''}${q.neededBy ? ` · by ${dayLabel(q.neededBy)}` : ''}</li>`)}</ul>` : none('No requests.'))}
      ${sec('Plan for tomorrow', html`${plan.length ? html`<ul class="small">${plan.map(x => html`<li>${planLine(x)}</li>`)}</ul>` : none('No plan given.')}
        ${String(r.notes || '').trim() ? html`<p class="small"><b>Notes:</b> ${r.notes}</p>` : ''}
        ${String(r.instructions || '').trim() ? html`<p class="small"><b>Client engineer's instructions:</b> ${r.instructions}</p>` : ''}`)}
      <div class="k">Photos</div>
      ${r.photos.length ? html`<div class="rv-photos">${r.photos.map(ph => html`<figure>${thumb(ph.id, 'rv')}<figcaption class="tiny muted">${photoCaption(ph, r.items)}</figcaption></figure>`)}</div>`
        : none('No photos.')}
      ${canPdf(c) ? '' : html`<p class="tiny muted center">${icon('doc')} The report PDF goes to the office only.</p>`}
    </div>`,
  };
}
