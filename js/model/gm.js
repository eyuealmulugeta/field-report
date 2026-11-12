// 2.95.0 (owner, 12 Nov, R6): the GM's Overview on the Dashboard. One picture of the project from the data the phone
// already gets live from Central Hub: the reports and their review, today's crew marks, requests, the store, open
// purchase orders, penalties, technicians' work photos and Spotlight. Pure: the page (ui/gm.js) draws it.

const OPEN_REQ = new Set(['requested', 'gm', 'approved', 'arranging']);
const WAIT_REQ = new Set(['requested', 'gm']);

/**
 * rows: Reports' day rows (model/follow.js monthDays, newest first). marks: today's attendance marks by person.
 * team: the project's people (active false = left). reqs: shared requests. sm: store movements. pos: open POs (count).
 * pens: penalties. shots: work photos. spots: Spotlight notes and visitors. today: YYYY-MM-DD.
 */
export function board({ rows = [], marks = {}, team = [], reqs = [], sm = [], pos = 0, pens = [], shots = [], spots = [], today = '' } = {}) {
  const days = rows.filter(r => r && r.date <= today);
  const last14 = days.slice(0, 14), last7 = days.slice(0, 7);
  const day = days.find(r => r.date === today) || { date: today, kind: 'today' };
  const count = (list, k) => list.filter(r => r.kind === k).length;
  const sentDays = last7.filter(r => ['approved', 'changes', 'submitted'].includes(r.kind)).length;
  const workDays = last7.filter(r => !['off', 'nowork'].includes(r.kind) && !(r.date === today && r.kind === 'today')).length;

  const people = (team || []).filter(m => m && m.active !== false);
  const st = Object.values(marks || {}).map(m => (m && m.state) || '');
  const crew = { present: st.filter(s => s === 'present').length, absent: st.filter(s => s === 'absent').length, total: people.length };
  crew.rate = crew.total ? Math.round((crew.present / crew.total) * 100) : 0;

  const live = (reqs || []).filter(d => d && d.status !== 'deleted');
  const open = live.filter(d => OPEN_REQ.has(d.status));
  const req = { open: open.length, urgent: open.filter(d => ((d.fr || {}).priority || d.priority) === 'Urgent').length, waiting: live.filter(d => WAIT_REQ.has(d.status)).length };

  const todaySpots = (spots || []).filter(x => x && String(x.at || '').slice(0, 10) === today);
  const spot = { pos: todaySpots.filter(x => !x.visit && x.tone === 'pos').length, neg: todaySpots.filter(x => !x.visit && x.tone === 'neg').length, visit: todaySpots.filter(x => x.visit).length };

  const waiting = list => (list || []).filter(x => x && x.status === 'waiting').length;
  const k = {
    toReview: count(last14, 'submitted'), sentBack: count(last14, 'changes'), missing: count(last14, 'missing'),
    onTime: workDays ? Math.round((sentDays / workDays) * 100) : 0,
    store: waiting(sm), pens: waiting(pens), shots: waiting(shots), pos: Number(pos) || 0,
  };
  const needs = [
    [k.toReview, 'report', 'reports to approve', 'rev'],
    [req.waiting, 'request', 'requests waiting for approval', 'requests'],
    [k.store, 'store movement', 'store movements to approve', 'store'],
    [k.pens, 'penalty', 'penalties to decide', 'penalties'],
    [k.shots, 'work photo', 'work photos to check', 'media:work'],
    [k.missing, 'missing report', 'missing reports in the last 14 days', 'reports'],
  ].filter(([n]) => n > 0).map(([n, one, many, to]) => ({ n, text: n === 1 ? `1 ${one}` : `${n} ${many}`, to }));
  return { day, week: last7.slice().reverse(), crew, req, spot, k, needs };
}
