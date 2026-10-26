// Slice 2: Work done (the list and one item), Photo, and the listening banner of voice entry.

import { html, icon } from '../core/dom.js';
import { cachedUrl } from '../core/photos.js';
import { canListen } from '../core/voice.js';
import { UNITS, CAPTIONS, zonesOf, itemLine } from '../model/items.js';
import { openPlanned } from '../model/report.js';
import { stepHead, chips } from './parts.js';

/** A photo thumbnail; main.js fills in the picture after drawing. */
export const thumb = (id, cls = '') => html`<img class="thumb ${cls}" data-photo="${id}" src="${cachedUrl(id) || 'data:,'}" alt="">`;

const camTile = act => html`<button type="button" class="thumb add" data-act="${act}" aria-label="Take a photo">${icon('cam')}</button>`;

/** Today's work as a table (computer); sel = the item open beside it. */
export function workTable(items, sel) {
  return html`<div class="box tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Where</th><th>Task or work</th><th>What was done</th><th>Amount</th><th>Photos</th></tr></thead><tbody>
    ${items.map(i => html`<tr class="${i.id === sel ? 'sel' : ''}" data-act="openItem" data-v="${i.id}"><td><span class="time">${i.at}</span></td><td>${i.zone}</td><td>${i.task || i.type}</td>
      <td>${i.text}${i.milestoneId ? html` <span class="pill ok">Milestone</span>` : ''}</td><td><b>${i.qty != null && i.qty !== '' ? `${i.qty} ${i.unit}` : ''}</b></td><td>${i.photos.slice(0, 3).map(p => thumb(p, 'xs'))}</td></tr>`)}
    <tr data-act="newItem" class="add"><td colspan="6">+ Add work done <kbd>N</kbd></td></tr></tbody></table></div>`;
}

/** Today's activities planned yesterday: one tap logs one, with where and what already filled. */
export function plannedBox(r) {
  const left = openPlanned(r);
  if (!left.length) return '';
  return html`<div class="box"><div class="li head"><span class="k brand">Planned for today · from yesterday's report</span></div>
    ${left.map(p => html`<div class="li"><span class="ic">${icon('list')}</span><div class="n"><b>${[p.zone, p.task || p.type].filter(Boolean).join(' · ') || 'Planned work'}</b>${p.text ? html`<span>${p.text}</span>` : ''}</div>
      <button type="button" class="btn s sm" data-act="logPlan" data-v="${p.id}">Log it</button></div>`)}</div>`;
}

export function work(c) {
  const r = c.report, items = [...r.items].reverse();
  if (c.wide) {
    return {
      head: stepHead('Work done', `Step 3 of 9 · ${items.length} logged`),
      body: html`${plannedBox(r)}${items.length ? workTable(items) : html`<div class="soft small"><b>Nothing logged yet.</b><br><span class="muted">Press <kbd>N</kbd> the moment work is done.</span></div><button type="button" class="btn s narrow-btn" data-act="newItem">${icon('plus')}Add work done</button>`}`,
      foot: html`<button type="button" class="btn p" data-act="workDone" ${items.length ? '' : 'disabled'}>${icon('check')}${r.done.work ? 'Ticked as done' : 'Done for today'}</button>`,
    };
  }
  return {
    head: stepHead('Work done', `Step 3 of 9 · ${items.length} logged`),
    body: html`${plannedBox(r)}${items.length ? html`<div class="box">${items.map(i => html`
      <button type="button" class="li item" data-act="openItem" data-v="${i.id}">
        <span class="time">${i.at}</span>
        <div class="n"><b>${itemLine(i) || 'Work'}</b>${i.text ? html`<span class="clamp">${i.text}</span>` : ''}
          ${i.photos.length ? html`<div class="thumbs">${i.photos.slice(0, 4).map(p => thumb(p, 'sm'))}</div>` : ''}</div>
        ${i.milestoneId ? html`<span class="pill ok">Milestone</span>` : ''}</button>`)}</div>`
      : html`<div class="soft small"><b>Nothing logged yet.</b><br><span class="muted">Use + on the Today page the moment work is done, or add it here.</span></div>`}
      <button type="button" class="btn s" data-act="newItem">${icon('plus')}Add work done</button>`,
    foot: html`<button type="button" class="btn p" data-act="workDone" ${items.length ? '' : 'disabled'}>${icon('check')}${r.done.work ? 'Ticked as done' : 'Done for today'}</button>`,
  };
}

export function item(c) {
  const it = c.ui.item, setup = c.project.setup || {};
  const zones = zonesOf(setup, c.s.siteZones[c.project.code], c.report.items);
  const tasks = setup.tasks || [], types = setup.activities || c.project.activities || [];
  const many = tasks.length > 10 && !c.ui.allTasks;
  const shown = many ? tasks.filter((t, i) => i < 10 || t.id === it.taskId) : tasks;
  const editing = c.report.items.some(x => x.id === it.id);
  const mile = setup.milestones || [];
  const form = html`${c.ui.listening || c.ui.heard ? listening(c) : ''}
      <div class="lab">Where</div>
      ${chips('item.zone', zones, it.zone, html`<button type="button" class="chip dash" data-act="addZone">+ Zone</button>`)}
      ${tasks.length ? html`<div class="lab">Task from the schedule</div>
        <div class="chips">${shown.map(t => html`<button type="button" class="chip ${t.id === it.taskId ? 'on' : ''}" data-act="pickTask" data-v="${t.id}">${t.name}</button>`)}
        ${many ? html`<button type="button" class="chip dash" data-act="allTasks">All ${tasks.length}…</button>` : ''}</div>` : ''}
      ${types.length ? html`<div class="lab">Work type</div>${chips('item.type', types, it.type)}` : ''}
      <label class="lab" for="wt">What was done</label>
      <div class="fld-mic"><textarea id="wt" class="fld big" data-f="item.text" rows="2" placeholder="Completed welding for 4 beams and 5 columns">${it.text}</textarea>
        <button type="button" class="mic ${c.ui.listening ? 'on' : ''}" data-act="sayItem" aria-label="Say it">${icon('mic')}</button></div>
      <div class="lab">Amount</div>
      <div class="two"><div class="stp"><button type="button" data-act="qty" data-d="-1" aria-label="Less">−</button>
        <input class="num" inputmode="decimal" data-f="item.qty" value="${it.qty ?? ''}" placeholder="0" aria-label="Amount"><button type="button" data-act="qty" data-d="1" aria-label="More">+</button></div>
        ${chips('item.unit', UNITS, it.unit)}</div>
      <div class="lab">Photos</div>
      <div class="thumbs big">${it.photos.map(p => thumb(p))}${camTile('itemPhoto')}</div>
      ${mile.length ? html`<button type="button" class="box pad tog" data-act="toggleMile"><span><b>Reached a milestone</b>${it.milestoneId ? html`<br><span class="muted small">${(mile.find(m => m.id === it.milestoneId) || {}).name || ''}</span>` : ''}</span><span class="sw ${it.milestoneId || c.ui.mileOpen ? 'on' : ''}"></span></button>
        ${c.ui.mileOpen ? html`<div class="chips">${mile.map(m => html`<button type="button" class="chip ${m.id === it.milestoneId ? 'on' : ''}" data-act="pickMile" data-v="${m.id}">${m.name}${m.payment ? ' · payment' : ''}</button>`)}</div>` : ''}` : ''}
      ${editing ? html`<button type="button" class="btn t danger" data-act="deleteItem">Delete this item</button>` : ''}`;
  return {
    head: stepHead('Work done', `${editing ? 'Edit' : `Item ${c.report.items.length + 1}`} · ${it.at}`, 'work'),
    body: c.wide ? html`<div class="split">${workTable([...c.report.items].reverse(), it.id)}<div class="box pad form-col">${form}${c.ui.drop ? '' : html`<p class="muted tiny">Photos: drag them here or paste (Ctrl V). Esc closes · Ctrl S saves.</p>`}</div></div>` : form,
    foot: html`<div class="two"><button type="button" class="btn o" data-act="saveItem" data-v="again">Save, add another</button><button type="button" class="btn p" data-act="saveItem">${icon('check')}Save</button></div>`,
  };
}

function listening(c) {
  return html`<div class="soft flex listen ${c.ui.listening ? 'on' : ''}"><span class="ic">${icon('mic')}</span>
    <div class="small"><b>${c.ui.listening ? 'Listening…' : 'Heard'}</b><br><span class="muted">${c.ui.heard || 'Say where, what and how much. "Zone C2, welded 4 beams and 5 columns"'}</span></div></div>`;
}

export function photo(c) {
  const p = c.ui.photo, setup = c.project.setup || {};
  const zones = zonesOf(setup, c.s.siteZones[c.project.code], c.report.items);
  const items = [...c.report.items].reverse().slice(0, 8);
  return {
    head: stepHead('Photo', `${c.report.photos.length + (c.ui.photoEditing ? 0 : 1)} today · ${p.at}`, c.ui.photoBack || 'today'),
    body: html`<div class="shot">${thumb(p.id, 'full')}<span class="stamp">${c.today} · ${p.at}${p.zone ? ` · ${p.zone}` : ''}</span></div>
      <div class="lab">Where</div>${chips('photo.zone', zones, p.zone, html`<button type="button" class="chip dash" data-act="addZone">+ Zone</button>`)}
      <div class="lab">Caption</div>${chips('photo.captionKind', CAPTIONS, p.captionKind)}
      <input class="fld" data-f="photo.caption" value="${p.caption}" placeholder="What it shows (optional)" aria-label="Caption">
      ${items.length ? html`<div class="lab">It shows this work</div>
        <div class="box">${items.map(i => html`<button type="button" class="li" data-act="photoItem" data-v="${i.id}"><span class="dot ${p.itemId === i.id ? 'ok' : 'no'}">${p.itemId === i.id ? icon('check') : ''}</span><div class="n"><b>${itemLine(i) || 'Work'}</b><span>${i.at}${i.text ? ` · ${i.text}` : ''}</span></div></button>`)}</div>` : ''}
      <button type="button" class="btn t danger" data-act="dropPhoto">${c.ui.photoEditing ? 'Delete this photo' : 'Discard'}</button>`,
    foot: c.ui.photoEditing ? html`<button type="button" class="btn p" data-act="savePhoto">${icon('check')}Save</button>`
      : html`<div class="two"><button type="button" class="btn o" data-act="savePhoto" data-v="again">${icon('cam')}Save, take another</button><button type="button" class="btn p" data-act="savePhoto">${icon('check')}Save</button></div>`,
  };
}

export const voiceHint = () => (canListen() ? '' : ' (needs Chrome on Android)');
