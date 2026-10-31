// Attendance and crew. Manpower and man-hours are counted from attendance (owner's answer 2):
// there is no separate Manpower step.

import { sum, hoursBetween } from '../core/util.js';

export const STATES = ['present', 'absent', 'sick', 'leave'];
export const STATE_LETTER = { present: 'P', absent: 'A', sick: 'S', leave: 'L' };

/** Today's attendance rows from the office's crew list, everyone present. Yesterday's overtime is not carried. */
export function rowsFromStaff(staff) {
  return (staff || []).filter(s => s && s.name && s.active !== false)
    .map(s => ({ id: s.id || '', name: s.name, trade: s.trade || '', state: 'present', ot: 0 }));
}

/**
 * Brings saved rows in line with the office's current list: new people are added as present,
 * people the office removed stay only if they were marked today.
 */
export function mergeStaff(rows, staff) {
  const key = r => (r.id || r.name).toLowerCase();
  const have = new Map((rows || []).map(r => [key(r), r]));
  const out = rowsFromStaff(staff).map(r => ({ ...r, ...(have.get(key(r)) || {}), trade: r.trade || (have.get(key(r)) || {}).trade || '' }));
  const inList = new Set(out.map(key));
  for (const r of rows || []) if (!inList.has(key(r)) && (r.state !== 'present' || r.ot || r.added)) out.push(r);
  return out;
}

/** Head count, absentees, man-hours and manpower by trade for the day's working hours. */
export function totals(crew, start, end) {
  const hrs = hoursBetween(start, end) || 8;
  const rows = crew && crew.rows || [];
  const extra = (crew && crew.extra || []).filter(x => x.qty > 0);
  const here = rows.filter(r => r.state === 'present');
  const byTrade = new Map();
  const add = (trade, qty, h) => {
    const t = trade || 'Other';
    const x = byTrade.get(t) || { trade: t, qty: 0, hrs: 0 };
    x.qty += qty; x.hrs += h; byTrade.set(t, x);
  };
  for (const r of here) add(r.trade, 1, hrs + (Number(r.ot) || 0));
  for (const x of extra) add(x.trade, Number(x.qty) || 0, (Number(x.qty) || 0) * hrs);
  const present = here.length + sum(extra, x => x.qty);
  return {
    hrs,
    present,
    away: rows.length - here.length,
    overtime: sum(here, r => r.ot),
    manHours: Math.round(sum([...byTrade.values()], x => x.hrs) * 10) / 10,
    byTrade: [...byTrade.values()].sort((a, b) => b.qty - a.qty),
  };
}

/** The old report's manpower block, so Central Hub keeps reading it: { head, manHours, crew:[{trade, qty, hrs}] }. */
export function manpowerMeta(crew, start, end) {
  const t = totals(crew, start, end);
  return { head: t.present, manHours: t.manHours, crew: t.byTrade.map(x => ({ trade: x.trade, qty: x.qty, hrs: t.hrs })) };
}

/** The office attendance block the Apps Script and Central Hub take: [{ id, name, trade, state, ot }]. */
export const attendanceRows = crew => (crew && crew.rows || []).map(r => ({
  id: r.id || '', name: r.name, trade: r.trade || '', state: r.state, ot: r.state === 'present' ? Number(r.ot) || 0 : 0,
}));

export const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** 2.5.0: the morning crew photo. Until the start hour it is on time, until 15 minutes after it late attendance, after that
 *  the camera is closed (2.7.0: the start hour is the project's, set by the PM or GM; 08:00 when none).
 *  The server's clock decides when there is a connection; without one the phone's clock is used and the photo says so.
 *  A phone clock more than 5 minutes away from the server's makes the time doubtful. No limit on how many. */
export const CREW_ON_TIME = '08:00', LATE_MIN = 15, DOUBT_MIN = 5;
/** The last minute of late attendance: the start hour + 15 minutes. */
export function crewCloses(start = CREW_ON_TIME) {
  const [h, m] = String(/^\d{2}:\d{2}$/.test(start) ? start : CREW_ON_TIME).split(':').map(Number), t = Math.min(h * 60 + m + LATE_MIN, 1439);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
export const CREW_CLOSES = crewCloses();
export const CREW_ST_WORD = { ontime: 'On time', late: 'Late attendance', closed: 'Closed' };
export function crewPhotoState(time, { offline = false, skewMin = 0, start = CREW_ON_TIME } = {}) {
  const on = /^\d{2}:\d{2}$/.test(start) ? start : CREW_ON_TIME;
  const st = time <= on ? 'ontime' : time <= crewCloses(on) ? 'late' : 'closed';
  const tags = [];
  if (offline) tags.push('Taken offline');
  if (Math.abs(skewMin) > DOUBT_MIN) tags.push('Time doubtful');
  return { st, tags };
}

/** 2.5.0: a wage typed for one person that is not the daily wage of their trade: Central Hub flags it for review. */
export function wageDiffers(person, trades) {
  const t = (trades || []).find(x => x.trade === person.trade);
  return Number(person.wage) > 0 && !!t && Number(t.wage) > 0 && Number(person.wage) !== Number(t.wage);
}
