// 2.73.0 (owner, 8 Nov, R4): Discuss: talk with Central Hub. The project's channel and one-to-one chats, the same as
// Central Hub's Discuss page; new messages from others ring and show a note.
// 2.74.1 (owner): a proper chat page: conversations along the top with unread counts, bubbles grouped by day, the
// writing box fixed at the bottom; tap your own message to Edit (first minute) or Delete.

import { html } from '../core/dom.js';
import { head } from './parts.js';
import { threadOf, chatsOf, peopleOf, isDm, DM, mayEdit, takeBackOk, low } from '../model/chat.js';
import { tagOf, tick } from '../model/receipts.js';   // 2.84.0

const pad = n => String(n).padStart(2, '0');
const hm = at => { const d = new Date(at); return isNaN(d) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dayLabel(at, now = new Date()) {
  const d = new Date(at); if (isNaN(d)) return '';
  const k = x => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`, y = new Date(now); y.setDate(y.getDate() - 1);
  return k(d) === k(now) ? 'Today' : k(d) === k(y) ? 'Yesterday' : `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}
export const initials = s => { const w = String(s || '?').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase(); };
const HUES = [212, 160, 28, 280, 350, 190, 100, 250];
const hue = s => HUES[[...String(s || '')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % HUES.length];
const face = (key, name, cls = '') => html`<span class="av ${cls}" style="--h:${hue(key)}" aria-hidden="true">${initials(name || key)}</span>`;
const ms = m => Number(m.sentMs || Date.parse(m.at) || 0);
/** Messages from others newer than the time this conversation was last opened. */
export const unreadIn = (list, me, read = 0) => list.filter(m => m.by !== low(me) && !m.deleted && ms(m) > read).length;

export function chat(c) {
  const u = c.ui.chat || {}, me = low((c.s.auth || {}).email), open = u.open || '', p = c.project || {}, read = c.ui.chatRead || {};
  const ch = u.ch || [], dm = u.dm || [];
  // 2.85.0 (owner, 9 Nov, D5): names and positions from the Manpower Directory (Central Hub directory/people), never emails
  const dir = c.ui.people || {}, ppl = dir.people || [];
  const who0 = e => ppl.find(p => p.e === e);
  const nm = (e, fb = '') => { const p = who0(e); return p ? `${p.n}${p.t ? ` · ${p.t}` : ''}` : (fb || 'Colleague'); };
  const chats = chatsOf(dm, me).map(x => ({ ...x, name: (who0(x.email) || {}).n || x.name || 'Colleague', title: (who0(x.email) || {}).t || '' }));
  const people = peopleOf(ch, me).filter(x => !chats.some(y => y.email === x.email));
  const list = threadOf({ ch, dm, open, me });
  const other = isDm(open) ? open.slice(DM.length) : '';
  const who = other ? (who0(other) || {}).n || (chats.find(x => x.email === other) || people.find(x => x.email === other) || {}).name || 'Colleague' : `${p.name || 'Project'} channel`;
  // 2.86.0 (owner, 9 Nov): only Discuss's own link counts: a drop of the reports link no longer shows "Connecting" here
  const off = c.ui.live !== 'on' && !c.ui.chatLive;
  const convs = [{ id: '', name: `${p.code || 'Project'} channel`, n: unreadIn(ch, me, read['']), ch: true },
    ...chats.map(x => ({ id: DM + x.email, name: x.name || x.email, email: x.email, n: unreadIn(threadOf({ dm, open: DM + x.email, me }), me, read[DM + x.email]) }))];
  if (other && !convs.some(x => x.id === open)) convs.push({ id: open, name: who, email: other, n: 0 });
  const editing = u.edit ? list.find(m => m.id === u.edit) : null;
  let lastDay = '', lastBy = '';
  const rows = list.map(m => {
    const day = dayLabel(m.at), mine = m.by === me, first = day !== lastDay || m.by !== lastBy;
    const sep = day !== lastDay ? html`<div class="cday"><span>${day}</span></div>` : '';
    lastDay = day; lastBy = m.by;
    const sel = u.sel === m.id && mine && !m.deleted;
    return html`${sep}<div class="crow ${mine ? 'me' : ''} ${first ? 'first' : ''}">
      ${!mine ? (first ? face(m.by, m.name) : html`<span class="av sp"></span>`) : ''}
      <div class="cb ${m.deleted ? 'gone' : ''} ${sel ? 'sel' : ''}" ${mine && !m.deleted ? html`data-act="chatSel" data-v="${m.id}" role="button" tabindex="0" aria-label="Your message: tap for Edit or Delete"` : ''}>
        ${!mine && first && !other ? html`<span class="cn">${(who0(m.by) || {}).n || m.name || 'Colleague'}${(who0(m.by) || {}).t || m.title ? html` <i>${(who0(m.by) || {}).t || m.title}</i>` : ''}${m.from === 'Field Report' ? '' : html` <i>· Central Hub</i>`}</span>` : ''}
        <span class="ct">${m.deleted ? 'This message was deleted' : m.text}</span>
        <span class="cm">${m.edited && !m.deleted ? 'edited · ' : ''}${hm(m.at)}${mine && !m.deleted ? rtag(tagOf(m, [...((c.ui.rcpt || {}).ch || []), ...((c.ui.rcpt || {}).dm || [])], me, r => nm(r.who, r.name))) : ''}</span>
      </div></div>
      ${sel ? html`<div class="cact">${mayEdit(m, me) ? html`<button type="button" data-act="chatFix" data-v="${m.id}">Edit</button>` : ''}<button type="button" class="del" data-act="chatDel" data-v="${m.id}">${takeBackOk(m) ? 'Delete for everyone' : 'Delete for me'}</button></div>` : ''}`;
  });
  return {
    tab: 'chat',
    head: head('Discuss', who, ''),
    body: html`<div class="chat">
      <div class="cconv" role="tablist" aria-label="Conversations">
        <button type="button" class="cc new ${u.pick ? 'on' : ''}" data-act="chatPick" aria-expanded="${!!u.pick}"><span class="av ch" aria-hidden="true">+</span><span class="ccn">New chat</span></button>
        ${convs.map(x => html`<button type="button" role="tab" class="cc ${open === x.id ? 'on' : ''}" data-act="chatOpen" data-v="${x.id}" aria-selected="${open === x.id}">
          ${x.ch ? html`<span class="av ch" aria-hidden="true">#</span>` : face(x.email, x.name)}<span class="ccn">${x.name}</span>${x.n ? html`<i class="cun">${x.n}</i>` : ''}</button>`)}
      </div>
      ${u.pick ? picker(c, ppl, dir, me, people) : ''}
      ${off ? offLine(c.ui.live) : ''}
      <div class="clog">${rows.length ? rows : html`<div class="cempty">${other ? face(other, who, 'big') : html`<span class="av ch big" aria-hidden="true">#</span>`}<b>${who}</b><span>${other ? 'Only the two of you read this chat.' : 'Everyone on this project in Central Hub and Field Report reads this channel.'}</span><span>Say hello 👋</span></div>`}</div>
      <div class="cbox">
        ${editing ? html`<div class="cedit"><span>Editing your message</span><button type="button" data-act="chatEditCancel">Cancel</button></div>` : ''}
        <div class="cin"><textarea rows="1" data-ui="chatText" placeholder="${other ? `Message ${who}` : 'Message the project'}" aria-label="Message" maxlength="2000">${c.ui.chatText || ''}</textarea>
          <button type="button" class="csend" data-act="chatSend" aria-label="${editing ? 'Save the edit' : 'Send'}" ${off || u.busy ? 'disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-6 16-3-7z"/></svg></button></div>
        <p class="chint">Tap your message to edit it (first minute) or delete it. Deleted in the first 5 minutes it goes for everyone; after that only from your view.</p>
      </div>
    </div>`,
  };
}

/** 2.84.0 (owner, 9 Nov): Sent / Delivered / Seen under one's own message; in the channel, who (tap and hold). */
const rtag = t => html` <b class="rc rc-${t.k}" title="${t.names}">${tick(t)} ${t.text}</b>`;

/**
 * 2.85.0 (owner, 9 Nov, D3/D4): a new chat: the person is chosen, not typed: Project (All only for the Admin and the GM),
 * Position and Name, from the Manpower Directory; only the people on that project.
 */
function picker(c, ppl, dir, me, fallback) {
  const s = c.s || {}, role = (s.auth || {}).role, all = role === 'admin' || role === 'exec';
  const mine = (dir.projects || []).filter(p => all || (s.projects || []).some(x => x.code === p.code));
  const here = mine.find(p => p.code === (c.project || {}).code) || mine[0] || {};
  const fp = c.ui.chatFP || (all ? '@all' : here.id || '');
  const inProj = ppl.filter(p => p.e !== me && (fp === '@all' || (p.p || []).includes('@all') || (p.p || []).includes(fp)));
  const positions = [...new Set(inProj.map(p => p.t).filter(Boolean))].sort();
  const list = inProj.filter(p => !c.ui.chatFT || p.t === c.ui.chatFT);
  if (!ppl.length) return html`<div class="cpick"><b>Start a chat</b>${fallback.length ? fallback.map(x => html`<button type="button" class="cperson" data-act="chatOpen" data-v="${DM + x.email}">${face(x.email, x.name)}<span><b>${x.name}</b><i>${x.title || ''}</i></span></button>`) : html`<p class="muted small">The people list is being prepared by Central Hub; try again in a few minutes.</p>`}</div>`;
  return html`<div class="cpick"><b>Start a chat</b>
    <label class="cpl">Project<select class="fld" data-ui="chatFP">${all ? html`<option value="@all" ${fp === '@all' ? 'selected' : ''}>All projects</option>` : ''}${mine.map(p => html`<option value="${p.id}" ${p.id === fp ? 'selected' : ''}>${p.name}</option>`)}</select></label>
    <label class="cpl">Position<select class="fld" data-ui="chatFT"><option value="">All positions</option>${positions.map(t => html`<option value="${t}" ${t === c.ui.chatFT ? 'selected' : ''}>${t}</option>`)}</select></label>
    <label class="cpl">Name<select class="fld" data-ui="chatFW"><option value="">Choose a person (${list.length})</option>${list.map(p => html`<option value="${p.e}">${p.n}${p.t ? ` · ${p.t}` : ''}</option>`)}</select></label>
  </div>`;
}

/** 2.79.0 (owner, 9 Nov): what Discuss says when the live link is not on, with the one thing that mends it. */
export function offLine(live) {
  if (live === 'none') return html`<p class="callout warn small">This project is not linked to your email in Central Hub: ask the Admin.</p>`;
  if (live === 'signin') return html`<button type="button" class="callout warn small li" data-act="liveConnect"><b>Discuss needs one sign-in on this phone.</b> Tap to connect</button>`;
  return html`<button type="button" class="callout warn small li" data-act="liveRetry"><b>Connecting to Central Hub…</b> It tries again by itself; tap to try now</button>`;
}
