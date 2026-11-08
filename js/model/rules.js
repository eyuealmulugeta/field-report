// 2.60.0 (owner, 7 Nov, Phase G6): the person's access rules from Central Hub (Settings, Access rules), sent by the script
// at sign-in and with every notifications check. A page or a right they may not see is hidden by any means: the tab bar,
// the buttons, the links, the notifications and the address. No rules (null): the account's role decides, as before.

/** The day's steps: they belong to the daily report. */
export const STEP_SCREENS = new Set(['attention', 'start', 'crew', 'work', 'item', 'photo', 'equipment', 'materials', 'delivery', 'safety', 'delay', 'photos', 'end', 'request', 'send']);
/** Each page and the features that open it (any one is enough). */
const SCREEN = {
  today: ['fr_report'], att: ['fr_crewphoto', 'fr_crew'], reports: ['fr_review'], rev: ['fr_review'], review: ['fr_review'],
  requests: ['fr_requests'], penalties: ['fr_penalty'], store: ['fr_store'], spot: ['fr_spot'], crewrev: ['fr_hours'], quick: ['fr_quick'], media: ['fr_media'],
  share: ['fr_shots'], shots: ['fr_shots'],   // 2.66.0
};
/** Buttons that open something without a page of their own: [feature, S sees or D does]. */
const ACT = { spotOpen: ['fr_spot', 'S'], mediaOpen: ['fr_media', 'S'], penOpen: ['fr_penalty', 'D'], penSave: ['fr_penalty', 'D'], smOpen: ['fr_store', 'D'], smSave: ['fr_store', 'D'], noWork: ['fr_report', 'D'] };
const DECIDE = new Set(['revDo', 'dayRev', 'notifAct']);

/** Keep only a clean { feature: 'SDN' } object, or null. */
export const cleanRules = r => (r && typeof r === 'object' && !Array.isArray(r)
  ? Object.fromEntries(Object.entries(r).filter(([k]) => /^(fr|ch)_[a-z]{2,12}$/.test(k)).map(([k, v]) => [k, String(v || '').replace(/[^SDN]/g, '')]))
  : null);
/** Has the person this flag (S by default) of the feature? Always, when there are no rules. */
// 2.61.0: a feature Central Hub has not set for the person yet (added after their rules were saved) is allowed
const LATER = new Set(['fr_store', 'fr_shots']);
export const has = (rules, feat, flag = 'S') => !rules || (LATER.has(feat) && !(feat in rules)) || String(rules[feat] || '').includes(flag);
/** May the person open this page? */
export function screenOk(rules, screen) {
  const f = STEP_SCREENS.has(screen) && screen !== 'crew' ? ['fr_report'] : SCREEN[screen === 'crew' ? 'att' : screen];
  if (OWN_OFF[screen] && OFF.has(OWN_OFF[screen])) return false;   // 2.74.0
  if (f && f.every(k => OFF.has(k))) return false;
  if (!rules) return true;
  return !f || f.some(k => has(rules, k) && !OFF.has(k));
}
/* 2.74.0 (owner, 8 Nov): features the Admin switched off in Central Hub (Settings, Apps) are hidden on every phone, for
   everyone, whatever their access; nothing is deleted. Kept on the phone so it holds offline. */
let OFF = new Set();
const OWN_OFF = { chat: 'fr_chat' };
export const setOff = list => { OFF = new Set((Array.isArray(list) ? list : []).filter(k => /^fr_[a-z]{2,12}$/.test(k))); };
export const isOff = k => OFF.has(k);
/** May a notification's link (#go=what/...) be opened? */
export function linkOk(rules, link) {
  if (!rules || !link) return true;
  const what = String(link).replace(/^#go=/, '').split('/')[0];
  const to = { day: 'reports', act: 'reports', review: 'reports' }[what] || what;
  return screenOk(rules, to) && (what !== 'act' || has(rules, 'fr_approve', 'D'));
}
/** May the person use this button (data-act and its data-*)? */
export function actOk(rules, act, d = {}) {
  if (ACT[act] && OFF.has(ACT[act][0])) return false;   // 2.74.0: switched off in Central Hub
  if (DECIDE.has(act) && ['approve', 'changes', 'reopen'].includes(d.v) && OFF.has('fr_approve')) return false;
  if (!rules) return true;
  if (act === 'go') return screenOk(rules, d.to);
  if (DECIDE.has(act) && ['approve', 'changes', 'reopen'].includes(d.v)) return has(rules, 'fr_approve', 'D');
  if (act === 'inboxGo') return linkOk(rules, d.v);
  const a = ACT[act];
  return !a || has(rules, a[0], a[1]);
}
/** The first page the person may open, for an address they may not. */
export const firstOk = rules => ['today', 'reports', 'att', 'quick'].find(s => screenOk(rules, s)) || 'me';
/** Notifications whose page is hidden are not shown at all. */
export const inboxOk = (rules, items, link) => (rules ? items.filter(x => linkOk(rules, link(x))) : items);
/** Remove from the drawn page every button the person may not use (the tab bar, links, approve buttons). */
export function hideOff(root, rules) {
  if (!rules || !root) return 0;
  let n = 0;
  root.querySelectorAll('[data-act]').forEach(el => { if (!actOk(rules, el.dataset.act, el.dataset)) { el.remove(); n++; } });
  return n;
}
