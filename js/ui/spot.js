// 2.7.0: the Spotlight screen: a quick note for Central Hub with photos or videos, and the notes kept on this phone.

import { html, icon } from '../core/dom.js';
import { dayLabel } from '../core/util.js';
import { stepHead } from './parts.js';
import { thumb } from './work.js';
import { newSpot, SPOT_TONES, SPOT_MAX, aboutList, catsFor, PROJECT_ABOUT, VIDEO_SECONDS } from '../model/spot.js';
import { VISIT_TYPES, PURPOSES, VISIT_PHOTOS, visitsOf, visitCounts } from '../model/visit.js';

// 2.49.0 (owner, R3): Spotlight has two tabs, Notes and Visitors
// 2.87.0 (owner, 9 Nov): and Attention (a serious issue for the client), which was its own page
export const spotTabs = t => html`<div class="chips spot-tabs" role="tablist"><button type="button" class="chip ${t === 'notes' ? 'on' : ''}" data-act="spotTab" data-v="notes" aria-selected="${t === 'notes'}">Notes</button><button type="button" class="chip ${t === 'visits' ? 'on' : ''}" data-act="spotTab" data-v="visits" aria-selected="${t === 'visits'}">Visitors</button><button type="button" class="chip ${t === 'attention' ? 'on' : ''}" data-act="spotTab" data-v="attention" aria-selected="${t === 'attention'}">Attention</button></div>`;
const tabs = spotTabs;
const FOOT = html`<p class="muted tiny">All photos are taken live with the camera, not uploaded.</p>`;

function visitForm(c) {
  const v = c.ui.visit, u = k => c.ui[k] || '';
  return html`<p class="muted small">A client, consultant or inspector on site. It goes to Central Hub only, never into the report.</p>
    <div class="chips">${VISIT_TYPES.map(t => html`<button type="button" class="chip ${v.type === t ? 'on' : ''}" data-act="visType" data-v="${t}">${t}</button>`)}</div>
    <label class="lab" for="vn">Name</label><input id="vn" class="fld" data-ui="vName" value="${u('vName')}" placeholder="Full name" autocomplete="off">
    <label class="lab" for="vo">Organisation</label><input id="vo" class="fld" data-ui="vOrg" value="${u('vOrg')}" placeholder="Company or office" autocomplete="off">
    <div class="two"><div><label class="lab" for="vi">Arrived</label><input id="vi" class="fld" type="time" data-ui="vIn" value="${u('vIn')}"></div>
      <div><label class="lab" for="vt">Left</label><input id="vt" class="fld" type="time" data-ui="vOut" value="${u('vOut')}"></div></div>
    <p class="muted tiny">Leave "Left" empty while they are still on site.</p>
    <label class="lab" for="vp">Purpose</label><select id="vp" class="fld" data-ui="vPurpose">${PURPOSES.map(p => html`<option ${u('vPurpose') === p ? 'selected' : ''}>${p}</option>`)}</select>
    <label class="lab" for="vr">Result (optional)</label><input id="vr" class="fld" data-ui="vResult" value="${u('vResult')}" placeholder="e.g. Inspection passed">
    <label class="lab" for="vs">Meeting summary and actions</label><textarea id="vs" class="fld" rows="3" data-ui="vSummary" placeholder="What was agreed, who does what by when">${u('vSummary')}</textarea>
    ${v.media.length ? html`<div class="thumbs">${v.media.map((m, i) => html`<button type="button" class="tb" data-act="visitDrop" data-v="${i}" aria-label="Remove">${thumb(m.id, 'sm')}</button>`)}</div>` : ''}
    <div class="two">${v.media.length < VISIT_PHOTOS ? html`<button type="button" class="btn o" data-act="visitCam" ${c.ui.spotWork ? 'disabled' : ''}>${icon('cam')}Photo</button>` : html`<span></span>`}
      <button type="button" class="btn o" data-act="visitSign">${icon('check')}${v.signId ? 'Signed · sign again' : 'Visitor signs'}</button></div>
    ${v.signId ? html`<div class="thumbs">${thumb(v.signId, 'sm')}</div>` : ''}
    ${FOOT}
    <div class="two"><button type="button" class="btn o" data-act="visitCancel">Cancel</button><button type="button" class="btn p" data-act="visitSave" ${c.ui.busy || c.ui.spotWork ? 'disabled' : ''}>Save visit</button></div>`;
}

function visitList(c) {
  const list = visitsOf(c.s.spots, c.project.code), today = c.today, n = visitCounts(list, today);
  const row = x => html`<div class="li"><span class="ic ${x.visit.tout || x.date !== today ? 'ok' : 'warn'}">${icon('user')}</span>
    <div class="n"><b>${x.visit.type} · ${x.visit.name}</b><span>${[x.visit.org, `${x.visit.tin}–${x.visit.tout || (x.date === today ? 'on site' : '?')}`, x.visit.purpose].filter(Boolean).join(' · ')}${x.date !== today ? ` · ${dayLabel(x.date)}` : ''} · ${x.sent ? 'sent' : 'waiting for a connection'}</span></div>
    ${!x.visit.tout && x.date === today ? html`<button type="button" class="btn o sm" data-act="visitLeft" data-v="${x.id}">Left now</button>` : ''}</div>`;
  const now = list.filter(x => x.date === today), before = list.filter(x => x.date !== today);
  return html`<div class="vcount"><div><b>${n.today}</b><small>today</small></div><div><b>${n.onSite}</b><small>still on site</small></div><div><b>${n.month}</b><small>this month</small></div></div>
    <button type="button" class="btn p" data-act="visitNew">${icon('plus')}Log a visitor</button>
    ${now.length ? html`<div class="k">Today</div><div class="box">${now.map(row)}</div>` : html`<p class="muted small">No visitor logged today.</p>`}
    ${before.length ? html`<div class="k">Earlier</div><div class="box">${before.slice(0, 15).map(row)}</div>` : ''}
    <p class="muted tiny">Visits logged on this phone. Central Hub keeps them all.</p>`;
}

export function spot(c) {
  const s = c.ui.spot || newSpot(), mine = (c.s.spots || []).filter(x => x.proj === c.project.code && !x.visit).slice(0, 15);
  const tab = c.ui.spotTab === 'visits' ? 'visits' : 'notes';
  if (tab === 'visits') return { head: stepHead('Spotlight', `${c.project.name} · for Central Hub only`, 'today'), body: html`${tabs(tab)}${c.ui.visit ? visitForm(c) : visitList(c)}` };
  const back = 'today';
  const list = aboutList(c.project.staff, c.s.profile.position), about = list.includes(c.ui.spotAbout) ? c.ui.spotAbout : list[0];
  return {
    head: stepHead('Spotlight', `${c.project.name} · for Central Hub only`, back),
    body: html`${tabs(tab)}<p class="muted small">A good or bad thing you saw on site, about a person or the project. It does not go in the report. HR and the Admin are told; the person never sees it.</p>${list.length === 1 ? html`<p class="muted tiny">Notes about a person are written by Tiers 1, 2 and 3, about the tier below.</p>` : ''}
      <label class="lab" for="spa">About</label>
      <select id="spa" class="fld" data-ui="spotAbout">${list.map(n => html`<option ${about === n ? 'selected' : ''}>${n}</option>`)}</select>
      <div class="chips">${SPOT_TONES.map(([k, t]) => html`<button type="button" class="chip ${s.tone === k ? 'on' : ''}" data-act="spotTone" data-v="${k}">${k === 'pos' ? '👍' : '👎'} ${t}</button>`)}</div>
      <div class="chips">${catsFor(about).map(k => html`<button type="button" class="chip ${s.cat === k ? 'on' : ''}" data-act="spotCat" data-v="${k}">${k}</button>`)}</div>
      <textarea class="fld" rows="3" data-ui="spotNote" placeholder="What did you see?">${c.ui.spotNote || ''}</textarea>
      ${s.media.length ? html`<div class="thumbs">${s.media.map((m, i) => html`<button type="button" class="tb" data-act="spotDrop" data-v="${i}" aria-label="Remove">${m.kind === 'video' ? html`<span class="thumb sm vid">${icon('cam')}<small>video</small></span>` : thumb(m.id, 'sm')}</button>`)}</div><p class="muted tiny">Tap one to remove it.</p>` : ''}
      ${s.media.length < SPOT_MAX ? html`<div class="two"><button type="button" class="btn o" data-act="spotCam" ${c.ui.spotWork ? 'disabled' : ''}>${icon('cam')}Photo</button><button type="button" class="btn o" data-act="spotVid" ${c.ui.spotWork ? 'disabled' : ''}>${icon('cam')}Video</button></div>
        <button type="button" class="btn o" data-act="spotGal" ${c.ui.spotWork ? 'disabled' : ''}>${icon('doc')}Gallery</button>
        <p class="muted tiny">Up to ${SPOT_MAX} photos or videos. A video is at most ${VIDEO_SECONDS} seconds.</p>` : ''}
      ${c.ui.spotWork ? html`<p class="callout warn small">${c.ui.spotWork}</p>` : ''}
      <button type="button" class="btn p" data-act="spotSave" ${c.ui.busy || c.ui.spotWork ? 'disabled' : ''}>Send to Central Hub</button>
      ${mine.length ? html`<div class="k">Your notes on this phone</div><div class="box">${mine.map(x => html`<div class="li"><span class="ic ${x.tone === 'neg' ? 'bad' : 'ok'}">${icon(x.tone === 'neg' ? 'alert' : 'check')}</span>
        <div class="n"><b>${x.cat} · ${x.about}</b><span>${dayLabel(x.date)} ${x.time} · ${x.sent ? 'sent' : 'waiting for a connection'}${x.media.length ? ` · ${x.media.length} file${x.media.length > 1 ? 's' : ''}` : ''}</span></div></div>`)}</div>` : ''}`,
  };
}
