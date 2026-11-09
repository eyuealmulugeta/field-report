// 2.54.0 (owner, 6 Nov): the GM's Dashboard on the phone: this week's days, the photos and videos the site sent on the
// day chosen (the same as Central Hub's Dashboard), a photo opens full screen, a video opens in Drive.

import { html, icon } from '../core/dom.js';
import { stepHead } from './parts.js';

/** Monday to Sunday of the week of `today`, as YYYY-MM-DD. */
export function weekOf(today) {
  const t = new Date(`${today}T00:00:00Z`), back = (t.getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(t.getTime() + (i - back) * 864e5).toISOString().slice(0, 10));
}

/** 2.81.0 (owner, 9 Nov): the same day a week earlier or later, never past today. */
export const weekStep = (day, n, today) => { const d = new Date(Date.parse(`${day}T00:00:00Z`) + n * 7 * 864e5).toISOString().slice(0, 10); return d > today ? today : d; };

export function media(c) {
  const code = c.project.code, day = c.ui.mDay || c.realToday, k = `${code}|${day}`;
  const photos = (c.ui.mPhotos || {})[k], vids = ((c.ui.mVids || {})[code] || []).filter(v => v.date === day);
  const urls = c.ui.mUrl || {};
  // 2.81.0 (owner, 9 Nov): arrows to the weeks before; the day tabs follow the week of the day chosen
  const week = weekOf(day), now = week.includes(c.realToday);
  const nav = html`<div class="m-week"><button type="button" class="chip" data-act="mediaDay" data-v="${weekStep(day, -1, c.realToday)}" aria-label="Previous week">◀</button><b>${now ? 'This week' : `${week[0].slice(8)}/${week[0].slice(5, 7)} – ${week[6].slice(8)}/${week[6].slice(5, 7)}`}</b><button type="button" class="chip" data-act="mediaDay" data-v="${weekStep(day, 1, c.realToday)}" aria-label="Next week" ${now ? 'disabled' : ''}>▶</button>${now ? '' : html`<button type="button" class="chip" data-act="mediaDay" data-v="${c.realToday}">Today</button>`}</div>`;
  const tabs = html`${nav}<div class="chips m-days">${week.map(d => html`<button type="button" class="chip ${d === day ? 'on' : ''}" data-act="mediaDay" data-v="${d}" ${d > c.realToday ? 'disabled' : ''}>${new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })} ${d.slice(8)}</button>`)}</div>`;
  const big = c.ui.mBig ? html`<div class="m-big" data-act="mediaBig" data-v=""><img src="${c.ui.mBig}" alt="Site photo"><span class="muted small">Tap to close</span></div>` : '';
  return {
    head: stepHead('Dashboard', `${c.project.name} · photos and videos from site`, 'today'),
    body: html`${tabs}${big}
      ${photos === undefined ? html`<p class="muted">Getting the photos from the site…</p>` : ''}
      ${vids.length ? html`<div class="k">Videos · ${vids.length}</div><div class="box">${vids.map(v => html`<a class="li" href="https://drive.google.com/file/d/${v.fileId}/view" target="_blank" rel="noopener">${icon('cam')}<div class="n"><b>${v.time || ''} · ${v.gal ? 'Video from gallery' : 'Video'}</b><span>${v.byName || ''}</span></div><span class="ch">${icon('chev')}</span></a>`)}</div>` : ''}
      ${photos && photos.length ? html`<div class="k">Photos · ${photos.length}</div><div class="m-grid">${photos.map(p => html`<button type="button" class="m-tile" data-act="mediaBig" data-v="${p.id}">${urls[p.id] ? html`<img src="${urls[p.id]}" alt="${p.caption || 'Site photo'}">` : html`<span class="muted tiny">Loading…</span>`}<span class="tiny">${[p.time, p.zone || p.task, p.caption].filter(Boolean).join(' · ')}</span></button>`)}</div>` : ''}
      ${photos && !photos.length && !vids.length ? html`<p class="empty">No photos or videos from the site on this day.</p>` : ''}
      ${c.ui.mErr ? html`<p class="callout bad">${c.ui.mErr}</p>` : ''}
      <p class="muted tiny">Videos go to Central Hub only, never into the client's report.</p>`,
  };
}
