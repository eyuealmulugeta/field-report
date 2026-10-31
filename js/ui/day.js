// Slice 3: Equipment (step 4), Materials received (step 5) with one delivery, Safety and delays (step 6) with one delay,
// and today's Photos (step 7). Each returns { head, body, foot }.

import { html, icon } from '../core/dom.js';
import { plural } from '../core/util.js';
import { EQUIP_STATES, MATERIAL_UNITS, DELAY_CAUSES, PARTIES, INCIDENTS, equipmentChoices, materialChoices, photoNeedsCaption } from '../model/day.js';
import { stepHead, chips, stepper } from './parts.js';
import { thumb } from './work.js';

const camTile = act => html`<button type="button" class="thumb add" data-act="${act}" aria-label="Take a photo">${icon('cam')}</button>`;
const doneBtn = (r, id, label) => html`<button type="button" class="btn p" data-act="dayDone" data-v="${id}">${icon('check')}${r.done[id] ? 'Ticked as done' : label}</button>`;

export function equipment(c) {
  const r = c.report, list = r.equipment, setup = c.project.setup || {};
  const choices = equipmentChoices(setup, list);
  return {
    head: stepHead('Equipment', 'Step 4 of 9 · During the day'),
    body: html`${list.length && r.no > 1 && !r.done.equipment ? html`<div class="soft flex"><span class="ic">${icon('copy')}</span><div class="small"><b>Yesterday's machines</b><br><span class="muted">Change the count or the status; take off what left the site.</span></div></div>` : ''}
      ${list.length ? html`<div class="box">${list.map((e, i) => html`<div class="li eq" data-i="${i}">
        <div class="n"><b>${e.name}</b><span>${e.hrs} h each${e.status !== 'Active' ? ` · ${e.status.toLowerCase()}` : ''}</span></div>
        ${stepper('eqQty', e.qty, e.qty, i)}
        <div class="eq-row">
          <div class="seg wide" role="group" aria-label="Status of ${e.name}">${EQUIP_STATES.map(s => html`<button type="button" class="${e.status === s ? `on ${s}` : ''}" data-act="eqState" data-i="${i}" data-v="${s}" aria-pressed="${e.status === s}">${s}</button>`)}</div>
          ${stepper('eqHrs', e.hrs, `${e.hrs} h`, i)}
        </div></div>`)}</div>`
        : html`<div class="soft small"><b>No equipment on the list.</b><br><span class="muted">Tap the machines on site below, or tick "No equipment today".</span></div>`}
      <div class="lab">Add</div>
      <div class="chips">${choices.map(n => html`<button type="button" class="chip" data-act="addEq" data-v="${n}">+ ${n}</button>`)}<button type="button" class="chip dash" data-act="addEq" data-v="">+ Other</button></div>`,
    foot: doneBtn(r, 'equipment', list.length ? `Done · ${plural(list.reduce((a, e) => a + e.qty, 0), 'machine')}` : 'No equipment today'),
  };
}

export function materials(c) {
  const r = c.report, list = [...r.received].reverse();
  return {
    head: stepHead('Materials received', `Step 5 of 9 · ${plural(r.received.length, 'delivery', 'deliveries')}`),
    body: html`${list.length ? html`<div class="box">${list.map(x => html`<button type="button" class="li item" data-act="openRecv" data-v="${x.id}">
        <span class="time">${x.at}</span><div class="n"><b>${x.name}${x.qty != null && x.qty !== '' ? ` · ${x.qty} ${x.unit}` : ''}</b>${x.note ? html`<span class="clamp">${x.note}</span>` : ''}
        ${x.photos.length ? html`<div class="thumbs">${x.photos.slice(0, 3).map(p => thumb(p, 'sm'))}</div>` : ''}</div></button>`)}</div>`
      : html`<div class="soft small"><b>Nothing received yet today.</b><br><span class="muted">Log each delivery as it arrives, with a photo of the delivery note.</span></div>`}
      <button type="button" class="btn s" data-act="newRecv">${icon('plus')}Add a delivery</button>`,
    foot: list.length ? doneBtn(r, 'materials', 'Done for today') : doneBtn(r, 'materials', 'Nothing received today'),
  };
}

export function delivery(c) {
  const x = c.ui.recv, editing = c.report.received.some(y => y.id === x.id);
  const seen = Object.values(c.s.drafts).flatMap(d => (d.received || []).map(y => y.name));
  const names = materialChoices(c.project.setup, seen).slice(0, 14);
  return {
    head: stepHead('Delivery', `${editing ? 'Edit' : 'New'} · ${x.at}`, 'materials'),
    body: html`<div class="lab">Photo of the delivery <span class="muted thin">· its time is the delivery time</span></div>
      <div class="thumbs big">${x.photos.map(p => thumb(p))}${camTile('recvPhoto')}</div>
      <div class="lab">Material</div>
      ${names.length ? chips('recv.name', names, x.name) : ''}
      <input class="fld" data-f="recv.name" value="${x.name}" placeholder="Material, e.g. Roof sheet 0.5 mm" aria-label="Material">
      <div class="lab">Amount</div>
      <div class="two"><div class="stp"><button type="button" data-act="recvQty" data-d="-1" aria-label="Less">−</button>
        <input class="num" inputmode="decimal" data-f="recv.qty" value="${x.qty ?? ''}" placeholder="0" aria-label="Amount"><button type="button" data-act="recvQty" data-d="1" aria-label="More">+</button></div>
        ${chips('recv.unit', MATERIAL_UNITS, x.unit)}</div>
      <label class="lab" for="rn">Note</label>
      <input id="rn" class="fld" data-f="recv.note" value="${x.note}" placeholder="Supplier, delivery note number, condition">
      ${editing ? html`<button type="button" class="btn t danger" data-act="deleteRecv">Delete this delivery</button>` : ''}`,
    foot: html`<div class="two"><button type="button" class="btn o" data-act="saveRecv" data-v="again">Save, add another</button><button type="button" class="btn p" data-act="saveRecv">${icon('check')}Save</button></div>`,
  };
}

export function safety(c) {
  const r = c.report, s = r.safety, d = [...r.delays].reverse();
  const clear = !s.incident && !r.delays.length;
  return {
    head: stepHead('Safety and delays', 'Step 6 of 9 · During the day'),
    body: html`${clear && !s.done ? html`<button type="button" class="box pad allclear" data-act="allClear"><span class="ic ok">${icon('shield')}</span><div class="small left"><b>No incidents, no delays today</b><br><span class="muted">One tap ticks this step.</span></div></button>` : ''}
      <button type="button" class="box pad tog" data-act="flip" data-f="safety.toolbox"><span><b>Toolbox talk held</b><br><span class="muted small">The short safety talk before work</span></span><span class="sw ${s.toolbox ? 'on' : ''}"></span></button>
      <button type="button" class="box pad tog" data-act="flip" data-f="safety.incident"><span><b>Incident or near miss</b><br><span class="muted small">Anything that hurt someone or nearly did</span></span><span class="sw ${s.incident ? 'on bad' : ''}"></span></button>
      ${s.incident ? html`${chips('safety.kind', INCIDENTS, s.kind)}
        <textarea class="fld" data-f="safety.note" rows="2" placeholder="What happened, who, what was done" aria-label="What happened">${s.note}</textarea>` : ''}
      <div class="k">Delays</div>
      ${d.length ? html`<div class="box">${d.map(x => html`<button type="button" class="li item" data-act="openDelay" data-v="${x.id}">
        <span class="time">${x.at}</span><div class="n"><b>${x.cause} · ${x.hours} h</b><span>${[x.party !== x.cause ? x.party : '', x.idlePeople ? `${x.idlePeople} people idle` : '', x.note].filter(Boolean).join(' · ')}</span></div></button>`)}</div>`
        : html`<div class="box pad muted small">No delay logged.</div>`}
      <button type="button" class="btn s" data-act="newDelay">${icon('clock')}Log a delay</button>`,
    foot: html`<button type="button" class="btn p" data-act="dayDone" data-v="safety" ${s.incident && !s.kind ? 'disabled' : ''}>${icon('check')}${r.done.safety ? 'Ticked as done' : 'Done'}</button>`,
  };
}

export function delay(c) {
  const x = c.ui.delay, editing = c.report.delays.some(y => y.id === x.id);
  const tasks = (c.project.setup || {}).tasks || [];
  return {
    head: stepHead('Delay', `${editing ? 'Edit' : 'New'} · ${x.at}`, 'safety'),
    body: html`<div class="lab">Cause</div>${chips('delay.cause', DELAY_CAUSES, x.cause)}
      <div class="lab">Responsible</div>${chips('delay.party', PARTIES, x.party)}
      <div class="two"><div><div class="lab">Hours lost</div>${stepper('delayNum', x.hours, `${x.hours} h`)}</div>
        <div><div class="lab">People idle</div><div class="stp" data-k="idlePeople"><button type="button" data-act="delayPpl" data-d="-1" aria-label="Less">−</button><b>${x.idlePeople}</b><button type="button" data-act="delayPpl" data-d="1" aria-label="More">+</button></div></div></div>
      <label class="lab" for="die">Equipment idle</label>
      <input id="die" class="fld" data-f="delay.idleEquipment" value="${x.idleEquipment}" placeholder="e.g. Crane, 2 hours">
      ${tasks.length ? html`<div class="lab">Work affected</div>
        <div class="chips">${tasks.map(t => html`<button type="button" class="chip ${t.id === x.taskId ? 'on' : ''}" data-act="pick" data-f="delay.taskId" data-v="${t.id}">${t.name}</button>`)}</div>` : ''}
      <label class="lab" for="dn">Details</label>
      <textarea id="dn" class="fld" data-f="delay.note" rows="2" placeholder="What happened and what was done">${x.note}</textarea>
      ${editing ? html`<button type="button" class="btn t danger" data-act="deleteDelay">Delete this delay</button>` : ''}`,
    foot: html`<button type="button" class="btn p" data-act="saveDelay" ${x.cause ? '' : 'disabled'}>${icon('check')}Save the delay</button>`,
  };
}

export function photos(c) {
  const r = c.report, list = [...r.photos].reverse();
  const missing = r.photos.filter(photoNeedsCaption).length;
  const work = id => r.items.find(i => i.id === id);
  return {
    head: stepHead('Photos', `Step 7 of 9 · ${plural(r.photos.length, 'photo')} today`),
    body: html`${missing ? html`<p class="callout warn">${plural(missing, 'photo')} without a caption or work item. Tap to add one, so the office knows what it shows.</p>` : ''}
      <div class="ptiles">${list.map(p => html`<button type="button" class="ptile ${photoNeedsCaption(p) ? 'need' : ''}" data-act="openPhoto" data-v="${p.id}">
        ${thumb(p.id, 'tile')}<span><b>${p.at}${p.zone ? ` · ${p.zone}` : ''}</b>${p.caption || (work(p.itemId) ? `${p.captionKind}: ${work(p.itemId).text || work(p.itemId).task || 'work'}` : html`<em>Add a caption</em>`)}</span></button>`)}
        <button type="button" class="ptile add" data-act="logPhoto">${icon('cam')}<span><b>Take a photo</b></span></button></div>`,
    foot: doneBtn(r, 'photos', r.photos.length ? `Done · ${plural(r.photos.length, 'photo')}` : 'No photos today'),
  };
}
