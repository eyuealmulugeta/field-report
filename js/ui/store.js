// 2.61.0 (owner, 7 Nov, R5): Review > Store. What is in the store, receive / issue / return / transfer out / weekly
// count, each waiting for the PM; the stock card of an item; the keeper and the minimums (PM, PE or GM).

import { html, icon } from '../core/dom.js';
import { head, reviewTabs } from './parts.js';
import { KINDS, kindWord, MOVE_WORD, MOVE_TONE, UNITS, mayApprove, mayRecord, maySetKeeper, bookOf, itemsOf, lowOf, countDue, sortMoves, cardOf, moveLine, openPOs } from '../model/store.js';

const n = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

function form(c, book, items, pos = []) {
  const f = c.ui.sm || {}, k = f.kind;
  const po = pos.find(p => p.id === f.poId);
  if (po) items = po.lines.map(l => ({ item: l.item, unit: l.unit }));
  const others = (c.s.projects || []).filter(p => p.code !== c.s.proj);
  if (k === 'count') {
    const rows = Object.values(book).sort((a, b) => a.item.localeCompare(b.item));
    return html`<div class="box pad sm-form"><b>Stock count</b>
      <label class="lab" for="smDate">Day</label><input id="smDate" class="fld" type="date" data-ui="smDate" value="${f.date || c.realToday}" max="${c.realToday}">
      ${rows.length ? rows.map(e => html`<div class="sm-cnt"><span>${e.item}<small class="muted"> · books ${n(e.qty)} ${e.unit}</small></span><input class="fld slim" type="number" inputmode="decimal" min="0" data-ui="smCnt.${e.key}" value="${(f.cnt || {})[e.key] ?? ''}" placeholder="Counted" aria-label="Counted ${e.item}"></div>`) : html`<p class="muted">Nothing in the store yet.</p>`}
      <label class="lab" for="smNote">Note</label><input id="smNote" class="fld" data-ui="smNote" value="${f.note || ''}" placeholder="Optional">
      <div class="row"><button type="button" class="btn p" data-act="smSave" ${c.ui.busy ? 'disabled' : ''}>Send for approval</button><button type="button" class="btn t" data-act="smClose">Cancel</button></div>
      <p class="tiny muted">The PE or the GM approves the differences. Then the store's books show what was counted.</p></div>`;
  }
  return html`<div class="box pad sm-form"><b>${kindWord(k)}</b>
    ${k === 'receive' && pos.length ? html`<label class="lab" for="smPo">Purchase order</label><select id="smPo" class="fld" data-ui="smPo"><option value="">No PO (cash or other)</option>${pos.map(p => html`<option value="${p.id}" ${p.id === f.poId ? 'selected' : ''}>${p.number} · ${p.supplier}</option>`)}</select>
      ${po ? html`<p class="tiny muted">Still to come: ${po.lines.filter(l => l.left > 0).map(l => `${l.item} ${n(l.left)} ${l.unit}`).join(', ')}</p>` : ''}` : ''}
    <label class="lab" for="smDate">Day</label><input id="smDate" class="fld" type="date" data-ui="smDate" value="${f.date || c.realToday}" max="${c.realToday}">
    <label class="lab" for="smItem">Item</label><input id="smItem" class="fld" list="smItems" data-ui="smItem" value="${f.item || ''}" placeholder="e.g. Cement 50 kg" autocomplete="off">
    <datalist id="smItems">${items.map(i => html`<option value="${i.item}">${i.unit}</option>`)}</datalist>
    <div class="row2"><div><label class="lab" for="smQty">Quantity</label><input id="smQty" class="fld" type="number" inputmode="decimal" min="0" data-ui="smQty" value="${f.qty || ''}"></div>
      <div><label class="lab" for="smUnit">Unit</label><select id="smUnit" class="fld" data-ui="smUnit"><option value="">Unit…</option>${[...new Set([...UNITS, ...items.map(i => i.unit)])].map(u => html`<option ${u === f.unit ? 'selected' : ''}>${u}</option>`)}</select></div></div>
    ${k === 'receive' ? html`<label class="lab" for="smSup">Supplier</label><input id="smSup" class="fld" data-ui="smSup" value="${f.supplier || ''}" placeholder="Supplier, or Transfer from (project)">
      <label class="lab">Delivery note</label>${f.photo ? html`<img class="sm-photo" src="${f.photo}" alt="Delivery note">` : ''}<button type="button" class="btn t slim" data-act="smCam">${icon('cam')}${f.photo ? 'Take again' : 'Take a photo'}</button>` : ''}
    ${k === 'issue' || k === 'return' ? html`<label class="lab" for="smTo">${k === 'issue' ? 'Given to' : 'Brought back by'}</label><input id="smTo" class="fld" list="smPeople" data-ui="smTo" value="${f.to || ''}" placeholder="Name or crew">
      <datalist id="smPeople">${(c.project && c.project.staff || []).map(s => html`<option value="${s.name}">`)}</datalist>` : ''}
    ${k === 'issue' ? html`<label class="lab" for="smZone">For (activity or zone)</label><input id="smZone" class="fld" data-ui="smZone" value="${f.zone || ''}" placeholder="e.g. Zone B roofing">
      <label class="lab">Receiver's signature</label>${f.sig ? html`<img class="sm-sig" src="${f.sig}" alt="Signature">` : ''}<button type="button" class="btn t slim" data-act="smSign">${f.sig ? 'Sign again' : 'Receiver signs'}</button>` : ''}
    ${k === 'transfer' ? html`<label class="lab" for="smProj">To project</label><select id="smProj" class="fld" data-ui="smProj"><option value="">Choose…</option>${others.map(p => html`<option value="${p.code}" ${p.code === f.toProject ? 'selected' : ''}>${p.name} · ${p.code}</option>`)}</select>` : ''}
    <label class="lab" for="smNote">Note</label><input id="smNote" class="fld" data-ui="smNote" value="${f.note || ''}" placeholder="Optional">
    <div class="row"><button type="button" class="btn p" data-act="smSave" ${c.ui.busy ? 'disabled' : ''}>Send for approval</button><button type="button" class="btn t" data-act="smClose">Cancel</button></div>
    <p class="tiny muted">The PM approves it; until then it shows as waiting and the books do not change.</p></div>`;
}

export function store(c) {
  const auth = c.s.auth || {}, role = auth.role || '', me = String(auth.email || '').toLowerCase();
  const all = c.ui.smList || [], keeper = all.find(m => m.id === 'keeper') || null;
  const book = bookOf(all), items = itemsOf(all, c.ui.liveReqs || []), list = sortMoves(all);
  const pos = openPOs(c.ui.poList || [], all, c.realToday);   // 2.62.0 (R6)
  const low = lowOf(book, (keeper && keeper.mins) || {}), due = countDue(all, c.realToday);
  const waiting = list.filter(m => m.status === 'waiting').length, may = mayRecord(role, me, keeper);
  const card = c.ui.smCard ? cardOf(all, c.ui.smCard) : null, cardItem = c.ui.smCard && book[c.ui.smCard];
  const rows = Object.values(book).filter(e => e.qty || e.waiting).sort((a, b) => a.item.localeCompare(b.item));
  return {
    tab: 'store',
    head: head('Store', `${rows.length} items · keeper ${keeper && (keeper.keeperName || keeper.keeper) || 'not set'}`, waiting ? `${waiting} waiting` : ''),
    body: html`${reviewTabs('store')}
      ${c.ui.live !== 'on' && !c.demo ? html`<p class="callout warn small">The store needs the connection to Central Hub. Check the internet, then open this page again.</p>` : ''}
      ${due.due ? html`<p class="callout warn small">Weekly stock count due${due.last ? ` (last ${due.last})` : ''}.</p>` : ''}
      ${low.length ? html`<p class="callout warn small">Low: ${low.map(e => `${e.item} ${n(e.qty)} ${e.unit}`).join(', ')}. <button type="button" class="btn t slim" data-act="go" data-to="requests">Make a material request</button></p>` : ''}
      ${may && !c.ui.sm ? html`<div class="seg wide sm-kinds" role="group" aria-label="Record">${KINDS.map(([v, w]) => html`<button type="button" data-act="smOpen" data-v="${v}">${w}</button>`)}</div>` : ''}
      ${!may && !c.ui.sm ? html`<p class="tiny muted">Only the store keeper, the Site Engineer, the PM or the GM records movements.</p>` : ''}
      ${c.ui.sm ? form(c, book, items, pos) : ''}
      ${pos.length && !c.ui.sm ? html`<div class="k">Deliveries still to come</div>${pos.map(p => html`<div class="li item"><div class="n"><b>${p.number} · ${p.supplier}</b><span>${p.lines.filter(l => l.left > 0).map(l => `${l.item} ${n(l.left)} of ${n(l.qty)} ${l.unit}${l.waiting ? ` (${n(l.waiting)} waiting)` : ''}`).join(', ')}</span></div><span class="pill ${p.late ? 'bad' : ''}">${p.late ? 'Late' : p.due ? `By ${String(p.due).slice(5)}` : 'Open'}</span></div>`)}` : ''}
      ${card ? html`<div class="box pad"><div class="row"><b>${cardItem ? `${cardItem.item} · ${n(cardItem.qty)} ${cardItem.unit}` : 'Stock card'}</b><button type="button" class="btn t slim" data-act="smCard" data-v="">Close</button></div>
        ${card.map(x => html`<div class="li item"><span class="time">${String(x.date).slice(5)}</span><div class="n"><b>${kindWord(x.kind)} ${x.diff != null ? `${n(x.qty)} (diff ${x.diff > 0 ? '+' : ''}${n(x.diff)})` : n(x.qty)}</b><span>${[x.who, x.by].filter(Boolean).join(' · ')}</span></div><span class="pill ${MOVE_TONE[x.status] || ''}">${x.status === 'approved' ? `= ${n(x.bal)}` : MOVE_WORD[x.status]}</span></div>`)}</div>` : ''}
      <div class="k">In the store</div>
      ${rows.length ? html`<div class="box">${rows.map(e => html`<button type="button" class="li" data-act="smCard" data-v="${e.key}"><div class="n"><b>${e.item}</b><span>${e.last ? `last ${e.last}` : ''}${e.waiting ? ` · ${e.waiting > 0 ? '+' : ''}${n(e.waiting)} waiting` : ''}</span></div><span class="pill ${low.some(l => l.key === e.key) ? 'warn' : 'info'}">${n(e.qty)} ${e.unit}</span></button>`)}</div>` : html`<p class="muted">Nothing in the store yet. Start with Receive.</p>`}
      <div class="k">Movements</div>
      ${list.length ? html`<div class="box">${list.slice(0, 60).map(m => {
        const mine = String(m.by || '').toLowerCase() === me;
        return html`<div class="li item"><span class="time">${String(m.date || '').slice(5)}</span>
          <div class="n"><b>${moveLine(m)}</b><span>${m.supplier ? `${m.supplier} · ` : ''}${m.zone ? `${m.zone} · ` : ''}by ${m.byName || m.by}${m.decidedByName ? ` · ${m.status} by ${m.decidedByName}` : ''}</span></div>
          <span class="pill ${MOVE_TONE[m.status] || ''}">${m.status === 'waiting' && m.kind === 'count' ? 'Waiting for PE or GM' : MOVE_WORD[m.status] || m.status}</span>
          ${m.status === 'waiting' && mayApprove(role) && !mine ? html`<button type="button" class="btn p slim" data-act="smDecide" data-v="approved" data-id="${m.id}" ${c.ui.busy ? 'disabled' : ''}>Approve</button><button type="button" class="btn t slim bad-t" data-act="smDecide" data-v="rejected" data-id="${m.id}" ${c.ui.busy ? 'disabled' : ''}>Reject</button>` : ''}
          ${m.status === 'waiting' && mine ? html`<button type="button" class="btn t slim" data-act="smDecide" data-v="cancelled" data-id="${m.id}" ${c.ui.busy ? 'disabled' : ''}>Cancel</button>` : ''}
        </div>`;
      })}</div>` : html`<p class="muted">No movements yet.</p>`}
      ${maySetKeeper(role) ? html`<div class="k">Store keeper and minimums</div><div class="box pad">
        <label class="lab" for="smKeep">Keeper's sign-in email (the store keeper, or the person delegated)</label>
        <input id="smKeep" class="fld" type="email" data-ui="smKeep" value="${c.ui.smKeep ?? (keeper && keeper.keeper) ?? ''}" placeholder="name@example.com">
        <label class="lab" for="smKeepName">Name</label><input id="smKeepName" class="fld" data-ui="smKeepName" value="${c.ui.smKeepName ?? (keeper && keeper.keeperName) ?? ''}">
        ${rows.length ? html`<div class="lab">Minimum per item (a request is suggested at or under it)</div>${rows.map(e => html`<div class="sm-cnt"><span>${e.item} <small class="muted">${e.unit}</small></span><input class="fld slim" type="number" inputmode="decimal" min="0" data-ui="smMin.${e.key}" value="${(c.ui.smMin || {})[e.key] ?? ((keeper && keeper.mins) || {})[e.key] ?? ''}" aria-label="Minimum ${e.item}"></div>`)}` : ''}
        <button type="button" class="btn o" data-act="smKeeper" ${c.ui.busy ? 'disabled' : ''}>Save</button></div>` : ''}`,
  };
}
