// 2.73.0 (owner, 8 Nov, R4): Discuss: talk with Central Hub. The project's channel and one-to-one chats, the same as
// Central Hub's Discuss page; new messages from others ring and show a note.

import { html } from '../core/dom.js';
import { head } from './parts.js';
import { threadOf, chatsOf, peopleOf, isDm, DM, mayEdit } from '../model/chat.js';

const t = at => { const d = new Date(at); return isNaN(d) ? '' : `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function chat(c) {
  const u = c.ui.chat || {}, me = String((c.s.auth || {}).email || '').toLowerCase(), open = u.open || '', p = c.project || {};
  const chats = chatsOf(u.dm || [], me), people = peopleOf(u.ch || [], me).filter(x => !chats.some(y => y.email === x.email));
  const list = threadOf({ ch: u.ch || [], dm: u.dm || [], open, me });
  const who = isDm(open) ? (chats.find(x => x.email === open.slice(DM.length)) || {}).name || open.slice(DM.length) : `${p.name || 'Project'} channel`;
  const off = c.ui.live !== 'on';
  return {
    tab: 'chat',
    head: head('Discuss', who, ''),
    body: html`${off ? html`<p class="callout warn small">Discuss needs the connection to Central Hub. ${c.ui.live === 'none' ? 'This project is not linked to your email in Central Hub: ask the Admin.' : 'Check the internet, then open this page again.'}</p>` : ''}
      <div class="chat-tabs"><button type="button" class="chip-b ${open ? '' : 'on'}" data-act="chatOpen" data-v="">${p.code || 'Project'} channel</button>
        ${chats.map(x => html`<button type="button" class="chip-b ${open === DM + x.email ? 'on' : ''}" data-act="chatOpen" data-v="${DM + x.email}">${x.name || x.email}</button>`)}</div>
      <div class="chat-list">${list.length ? list.map(m => html`<div class="msg ${m.by === me ? 'mine' : ''}">
          <div class="msg-h"><b>${m.by === me ? 'You' : m.name || m.by}</b><span class="tiny muted">${m.title ? `${m.title} · ` : ''}${t(m.at)}${m.edited ? ' · edited' : ''}${m.from === 'Field Report' ? '' : ' · Central Hub'}</span></div>
          <div class="msg-t">${m.deleted ? html`<i class="muted">This message was deleted</i>` : m.text}</div>
          ${m.by === me && !m.deleted ? html`<div class="msg-a">${mayEdit(m, me) ? html`<button type="button" class="mini" data-act="chatFix" data-v="${m.id}">Correct</button>` : ''}<button type="button" class="mini" data-act="chatDel" data-v="${m.id}">Delete</button></div>` : ''}
        </div>`) : html`<p class="muted small">No messages yet. Write the first one.</p>`}</div>
      <div class="chat-send"><textarea class="fld" rows="2" data-ui="chatText" placeholder="Message to ${who}" aria-label="Message">${c.ui.chatText || ''}</textarea>
        <button type="button" class="btn p" data-act="chatSend" ${off || u.busy ? 'disabled' : ''}>Send</button></div>
      ${people.length ? html`<div class="k">Start a chat</div><div class="chat-tabs">${people.map(x => html`<button type="button" class="chip-b" data-act="chatOpen" data-v="${DM + x.email}">${x.name}${x.title ? html` <span class="muted">${x.title}</span>` : ''}</button>`)}</div>` : ''}
      <p class="tiny muted">Everyone on this project in Central Hub and Field Report reads the channel. A chat is read only by the two of you. You can correct a message within 30 seconds and delete it at any time.</p>`,
  };
}
