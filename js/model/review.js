// 2.6.0: the kind of account. A reporter (Site engineer) writes the day's report; a reviewer (Project engineer, Admin)
// approves, sends back and comments, and gives the crew their wages; a viewer only reads. Central Hub's access rules
// decide the rest on the script.

export const kindOf = role => (role === 'coordinator' || role === 'admin' ? 'reviewer' : role === 'viewer' || role === 'exec' ? 'viewer' : 'reporter');
export const KIND_WORD = { reporter: 'Reporter account', reviewer: 'Reviewer account', viewer: 'View-only account' };

export const REVIEW_FILTERS = [['submitted', 'Waiting'], ['changes', 'Sent back'], ['approved', 'Approved'], ['', 'All']];
/** The reports of one project, newest first, filtered by status. */
export const reviewRows = (list, code, f) => (list || []).filter(x => (!code || String(x.name || '').includes(`_${code}_`)) && (!f || (x.status || 'submitted') === f))
  .sort((a, b) => String(b.date + b.no).localeCompare(String(a.date + a.no)));
export const waitingCount = (list, code) => reviewRows(list, code, 'submitted').length;

/** The wages a reviewer gives: each ticked person's typed wage, else the one the site list holds, else their trade's. */
export function crewWages(wait, picks, typed = {}) {
  const out = {};
  for (const x of wait || []) {
    if (!picks[x.id]) continue;
    const t = Number(typed[x.id]), w = t > 0 ? t : Number(x.wage) > 0 ? Number(x.wage) : Number(x.tradeWage) || 0;
    if (w > 0) out[x.id] = w;
  }
  return out;
}
