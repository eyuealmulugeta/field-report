// 2.34.0 (owner, 3 Nov, Phase G3): an urgent notice from the GM (sent from Central Hub, urgent/<id>) covers the
// screen until "I've read it" or a different reply is sent. Central Hub shows the GM who read it. Its own layer,
// like the install box; main.js feeds it from live.js (onUrgent).

import { html } from '../core/dom.js';

let pop = null;
const when = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** The notices this account has not answered yet, oldest first. Pure, for the tests. */
export const waitingFor = (list, me) => {
  const e = String(me || '').toLowerCase();
  return (list || []).filter(n => (n.emails || []).includes(e) && !(n.answers || {})[e] && n.from !== e).sort((a, b) => String(a.at).localeCompare(String(b.at)));
};

/** Show the first notice waiting (or nothing). `answer(id, { kind, text, at, name })` returns a promise. */
export function showUrgent(list, me, name, answer) {
  const n = waitingFor(list, me)[0];
  if (!n) { if (pop) pop.remove(); pop = null; return; }
  if (pop && pop.dataset.id === n.id) return;   // the same notice: keep what is being typed
  if (pop) pop.remove();
  pop = document.createElement('div');
  pop.className = 'urgent-pop';
  pop.dataset.id = n.id;
  pop.setAttribute('role', 'alertdialog');
  pop.setAttribute('aria-modal', 'true');
  pop.setAttribute('aria-label', 'Urgent notice');
  pop.innerHTML = String(html`<div class="urgent-card">
    <div class="urgent-tag">Urgent notice</div>
    <p class="urgent-text">${n.text}</p>
    <p class="urgent-from">From ${n.fromName || 'the GM'} · ${when(n.at)}</p>
    <textarea maxlength="300" rows="2" placeholder="Or write a different reply" aria-label="Your reply"></textarea>
    <p class="urgent-err" hidden></p>
    <div class="urgent-acts"><button type="button" data-u="reply">Send reply</button><button type="button" data-u="read" class="primary">I've read it</button></div>
  </div>`);
  const el = pop;
  el.addEventListener('click', async e => {
    const b = e.target.closest('button[data-u]');
    if (!b) return;
    const text = el.querySelector('textarea').value.trim(), err = el.querySelector('.urgent-err');
    if (b.dataset.u === 'reply' && !text) { err.hidden = false; err.textContent = "Write your reply first, or tap I've read it."; return; }
    b.disabled = true;
    try { await answer(n.id, { kind: b.dataset.u, text: b.dataset.u === 'reply' ? text : '', at: new Date().toISOString(), name: name || '' }); }
    catch (x) { b.disabled = false; err.hidden = false; err.textContent = 'Not sent. Check the connection and try again.'; }
  });
  document.body.appendChild(el);
}
