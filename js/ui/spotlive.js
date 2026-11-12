// 2.92.0 (owner, 12 Nov): Spotlight live, for the Admin and the GM. Notes and visitors appear here the moment a phone
// sends them (siteSpots, written after the script keeps them; core/live.js saveSpot). A tab of Review and of the
// Dashboard. A note about a person is never shown to that person: the database lets only the Admin and the GM read it.
import { html } from '../core/dom.js';
import { stepHead, reviewTabs } from './parts.js';

const day = iso => String(iso || '').slice(0, 10);
const time = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toTimeString().slice(0, 5); };
const label = d => { const t = new Date(`${d}T00:00:00`); return Number.isNaN(+t) ? d : t.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); };

/** Newest first, for one project (or all), with a tone filter; '' = all, 'pos', 'neg', 'visit'. */
export function spotRows(list, { proj = '', f = '' } = {}) {
  return (list || []).filter(x => x && (!proj || x.proj === proj)
    && (!f || (f === 'visit' ? !!x.visit : !x.visit && x.tone === f)))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// 2.98.0 (owner, 12 Nov: "start playing the spotlight video by default and fix the frame"): a video plays by itself
// (muted, as phones allow) across the card in its own shape; a tap opens the app's player with sound
const media = (x, urls = {}) => (x.media || []).length ? html`<div class="sl-media">${x.media.map(m => /^video/.test(m.type)
  ? html`<button type="button" class="sl-vbox" data-act="vidPlay" data-k="spot" data-p="${x.proj}" data-n="${x.id}" data-f="${m.fileId}" data-t="${x.about || 'Spotlight video'}" aria-label="Play the video with sound"><video muted autoplay loop playsinline preload="metadata" poster="https://drive.google.com/thumbnail?id=${m.fileId}&sz=w800" src="${urls[m.fileId] || ''}"></video><i>▶ Tap for sound</i></button>`
  : html`<a class="sl-tile" href="https://drive.google.com/file/d/${m.fileId}/view" target="_blank" rel="noopener"><img src="https://drive.google.com/thumbnail?id=${m.fileId}&sz=w400" alt="Photo from the site" loading="lazy"></a>`)}</div>` : '';

function card(x, all, urls = {}) {
  const v = x.visit;
  const tag = v ? html`<span class="pill">Visitor</span>` : html`<span class="pill ${x.tone === 'neg' ? 'bad' : 'ok'}">${x.tone === 'neg' ? '👎 Negative' : '👍 Positive'}</span>`;
  const title = v ? `${v.type || 'Visitor'} · ${v.name || ''}${v.org ? `, ${v.org}` : ''}` : `${x.cat} · ${x.about}`;
  const sub = v ? [v.purpose, `${v.tin || ''}–${v.tout || 'on site'}`].filter(Boolean).join(' · ') : '';
  return html`<div class="sl-card"><div class="sl-top">${tag}<b>${all ? `${x.proj} · ` : ''}${title}</b><span class="muted tiny">${time(x.at)}</span></div>
    ${sub ? html`<div class="muted small">${sub}</div>` : ''}${x.note ? html`<p class="sl-note">${x.note}</p>` : ''}${media(x, urls)}
    <div class="muted tiny">by ${x.byName || x.by}</div></div>`;
}

/** The list itself (Review and Dashboard). */
export function spotBody(c) {
  const live = c.ui.spotLive, all = !!c.ui.allProj, f = c.ui.slF || '';
  const rows = spotRows(live, { proj: all ? '' : c.project.code, f });
  const chips = html`<div class="chips">${[['', 'All'], ['pos', '👍 Positive'], ['neg', '👎 Negative'], ['visit', 'Visitors']].map(([k, t]) => html`<button type="button" class="chip ${f === k ? 'on' : ''}" data-act="slFilter" data-v="${k}">${t}</button>`)}</div>`;
  // 2.97.0 (owner: "spotlight is not loading"): without the live link it says so at once, with the one tap that opens it
  const off = live === null || (live === undefined && c.ui.live !== 'on');
  if (off) return html`${chips}<p class="callout warn small">Spotlight live is not open on this device. Tap below to connect; Central Hub's Spotlight page has every note.</p><button type="button" class="btn o" data-act="liveConnect">Connect Spotlight live</button>`;
  if (live === undefined) return html`${chips}<p class="muted">Connecting to the live Spotlight…</p>`;
  const days = [...new Set(rows.map(x => day(x.at)))];
  return html`${chips}<p class="muted tiny">Live: a note shows here the moment the phone sends it. For the Admin and the GM only.</p>
    ${rows.length ? days.map(d => html`<div class="k">${label(d)}</div>${rows.filter(x => day(x.at) === d).map(x => card(x, all, c.ui.slVurl || {}))}`) : html`<p class="empty">No Spotlight note or visitor yet.</p>`}`;
}

/** Review > Spotlight. */
export function spotlive(c) {
  return { tab: 'reports', head: stepHead('Spotlight', `${c.ui.allProj ? 'All projects' : c.project.name} · live`, 'today'), body: html`${reviewTabs('spotlive', c)}${spotBody(c)}` };
}
