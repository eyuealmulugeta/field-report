// 2.73.0 (owner, 8 Nov, R4): Discuss in Field Report, the same conversations as Central Hub's Discuss: the project's channel
// (company/main/messages, channel = the Central Hub project id) and one-to-one chats (company/main/direct, members =
// the two emails, sorted). The sender corrects a message within 1 minute and deletes it for everyone in the first 5 minutes, then only from their own view. Pure helpers.

export const MAX_LENGTH = 2000;
export const EDIT_MS = 60e3;   // 2.73.1 (owner): 1 minute
export const TAKE_BACK_MS = 5 * 60e3;   // 2.73.1 (owner): delete for everyone in 5 minutes, then only from my view
export const takeBackOk = (m, now = Date.now()) => !m.deleted && now - Number(m.sentMs || Date.parse(m.at) || 0) < TAKE_BACK_MS;
const hidden = (m, me) => (m.hiddenFor || []).includes(low(me));
export const DM = 'dm:';
export const low = s => String(s || '').trim().toLowerCase();
export const pairOf = (a, b) => [a, b].map(low).sort();
export const isDm = id => String(id || '').startsWith(DM);
export const otherOf = (m, me) => (m.members || []).find(x => x !== low(me)) || '';
export const newId = (now = Date.now()) => `msg_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** The messages of one conversation, oldest first, at most `max`. open: '' = the project channel, 'dm:<email>' = a chat. */
export function threadOf({ ch = [], dm = [], open = '', me = '', max = 200 }) {
  const list = (isDm(open) ? dm.filter(m => otherOf(m, me) === low(open.slice(DM.length))) : ch).filter(m => !hidden(m, me));
  return [...list].sort((a, b) => String(a.at || '').localeCompare(String(b.at || ''))).slice(-max);
}

/** The one-to-one chats, newest first: [{ email, name, last, at }]. Names come from the messages the other person sent. */
export function chatsOf(dm = [], me = '') {
  const by = new Map();
  for (const m of dm) {
    const e = otherOf(m, me);
    if (!e || hidden(m, me)) continue;
    const x = by.get(e) || { email: e, name: '', last: '', at: '' };
    if (m.by === e && m.name) x.name = m.name;
    if (String(m.at || '') >= x.at) { x.at = String(m.at || ''); x.last = m.deleted ? 'Message deleted' : m.text; }
    by.set(e, x);
  }
  return [...by.values()].sort((a, b) => b.at.localeCompare(a.at));
}

/** People to start a chat with: everyone who wrote in the project channel (not me), by name. */
export function peopleOf(ch = [], me = '') {
  const by = new Map();
  for (const m of ch) if (m.by && m.by !== low(me) && !by.has(m.by)) by.set(m.by, { email: m.by, name: m.name || m.by, title: m.title || '' });
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Messages from others newer than `seen` (ms), for the ring and the note. */
export const freshOf = (list = [], me = '', seen = 0) => list.filter(m => m.by !== low(me) && !m.deleted && Number(m.sentMs || Date.parse(m.at) || 0) > seen);

/** The record written for a new message. */
export function messageOf({ text, me, name = '', title = '', open = '', pid = '', now = Date.now() }) {
  const base = { id: newId(now), by: low(me), name, title, text: String(text || '').trim().slice(0, MAX_LENGTH), at: new Date(now).toISOString(), sentMs: now, from: 'Field Report' };
  return isDm(open) ? { sec: 'direct', rec: { ...base, members: pairOf(me, open.slice(DM.length)) } } : { sec: 'messages', rec: { ...base, channel: pid } };
}
export const mayEdit = (m, me, now = Date.now()) => m.by === low(me) && !m.deleted && now - Number(m.sentMs || 0) < EDIT_MS;
