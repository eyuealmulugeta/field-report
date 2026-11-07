// 2.57.0 (owner, 6-7 Nov, R3): penalties. The Site Engineer gives one with a reason and an amount; the Project Engineer
// or the GM approves or rejects it. An approved one is taken off the person's pay in Central Hub and shows on attendance.
// Kept in Central Hub's database: projects/<id>/penalties/<id>.

export const REASONS = [['misconduct', 'Misconduct'], ['late', 'Late start'], ['early', 'Early finish']];
export const reasonWord = k => (REASONS.find(([v]) => v === k) || [])[1] || k || '';
export const PEN_WORD = { waiting: 'Waiting for PE or GM', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
export const PEN_TONE = { waiting: 'warn', approved: 'bad', rejected: 'ok', cancelled: '' };

/** Field Report roles: engineer (Site Engineer), coordinator (Project Engineer / manager), exec (GM), admin, viewer. */
export const mayGive = role => ['engineer', 'coordinator', 'admin', 'exec'].includes(role);
export const mayDecide = role => ['coordinator', 'exec', 'admin'].includes(role);

/** Why this penalty cannot be saved, or ''. */
export function penaltyProblem(f, staff = []) {
  if (!f.personId || !staff.some(s => String(s.id) === String(f.personId))) return 'Choose the person.';
  if (!REASONS.some(([v]) => v === f.reason)) return 'Choose the reason.';
  const a = Number(f.amount);
  if (!(a > 0)) return 'Enter the amount in ETB.';
  if (a > 100000) return 'The amount looks too big. Check it.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f.date || ''))) return 'Choose the day.';
  return '';
}

/** The record written to Central Hub. */
export function penaltyRecord(f, { staff, email, byName, at, pid, id }) {
  const s = staff.find(x => String(x.id) === String(f.personId)) || {};
  return {
    id, projectId: pid, site: true, date: f.date, personId: String(s.id), name: s.name || '', trade: s.trade || s.title || '',
    reason: f.reason, amount: Math.round(Number(f.amount) * 100) / 100, currency: 'ETB', status: 'waiting',
    by: email, byName: byName || email, at,
    log: [{ at, by: email, byName: byName || email, status: 'waiting', note: 'Given on site' }],
  };
}

/** Newest first; the ones waiting on top. */
export const sortPenalties = list => [...(list || [])].sort((a, b) => (a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1) || String(b.date).localeCompare(String(a.date)) || String(b.at).localeCompare(String(a.at)));

/** Approved penalties of one person between two days (both included): what is taken off. */
export const penaltyTotal = (list, personId, from, to) => (list || []).filter(p => p.status === 'approved' && String(p.personId) === String(personId) && p.date >= from && p.date <= to).reduce((s, p) => s + (Number(p.amount) || 0), 0);
