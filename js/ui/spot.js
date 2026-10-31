// 2.7.0: the Spotlight screen: a quick note for Central Hub with photos or videos, and the notes kept on this phone.

import { html, icon } from '../core/dom.js';
import { dayLabel } from '../core/util.js';
import { stepHead } from './parts.js';
import { thumb } from './work.js';
import { SPOT_CATS, SPOT_TONES, SPOT_MAX, aboutList } from '../model/spot.js';

export function spot(c) {
  const s = c.ui.spot, mine = (c.s.spots || []).filter(x => x.proj === c.project.code).slice(0, 15);
  const back = 'today';
  return {
    head: stepHead('Spotlight', `${c.project.name} · for Central Hub only`, back),
    body: html`<p class="muted small">A good or bad thing you saw on site, about a person or the project. It does not go in the report. The Project Manager and the office are told.</p>
      <label class="lab" for="spa">About</label>
      <select id="spa" class="fld" data-ui="spotAbout">${aboutList(c.project.staff).map(n => html`<option ${(c.ui.spotAbout || aboutList()[0]) === n ? 'selected' : ''}>${n}</option>`)}</select>
      <div class="chips">${SPOT_TONES.map(([k, t]) => html`<button type="button" class="chip ${s.tone === k ? 'on' : ''}" data-act="spotTone" data-v="${k}">${k === 'pos' ? '👍' : '👎'} ${t}</button>`)}</div>
      <div class="chips">${SPOT_CATS.map(k => html`<button type="button" class="chip ${s.cat === k ? 'on' : ''}" data-act="spotCat" data-v="${k}">${k}</button>`)}</div>
      <textarea class="fld" rows="3" data-ui="spotNote" placeholder="What did you see?">${c.ui.spotNote || ''}</textarea>
      ${s.media.length ? html`<div class="thumbs">${s.media.map((m, i) => html`<button type="button" class="tb" data-act="spotDrop" data-v="${i}" aria-label="Remove">${m.kind === 'video' ? html`<span class="thumb sm vid">${icon('cam')}<small>video</small></span>` : thumb(m.id, 'sm')}</button>`)}</div><p class="muted tiny">Tap one to remove it.</p>` : ''}
      ${s.media.length < SPOT_MAX ? html`<div class="two"><button type="button" class="btn o" data-act="spotCam" ${c.ui.spotWork ? 'disabled' : ''}>${icon('cam')}Photo</button><button type="button" class="btn o" data-act="spotVid" ${c.ui.spotWork ? 'disabled' : ''}>${icon('cam')}Video</button></div>
        <button type="button" class="btn t" data-act="spotGallery" ${c.ui.spotWork ? 'disabled' : ''}>${icon('doc')}From the gallery</button>` : ''}
      ${c.ui.spotWork ? html`<p class="callout warn small">${c.ui.spotWork}</p>` : ''}
      <button type="button" class="btn p" data-act="spotSave" ${c.ui.busy || c.ui.spotWork ? 'disabled' : ''}>Send to Central Hub</button>
      ${mine.length ? html`<div class="k">Your notes on this phone</div><div class="box">${mine.map(x => html`<div class="li"><span class="ic ${x.tone === 'neg' ? 'bad' : 'ok'}">${icon(x.tone === 'neg' ? 'alert' : 'check')}</span>
        <div class="n"><b>${x.cat} · ${x.about}</b><span>${dayLabel(x.date)} ${x.time} · ${x.sent ? 'sent' : 'waiting for a connection'}${x.media.length ? ` · ${x.media.length} file${x.media.length > 1 ? 's' : ''}` : ''}</span></div></div>`)}</div>` : ''}`,
  };
}
