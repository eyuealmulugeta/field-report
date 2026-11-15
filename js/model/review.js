// 2.6.0: the kind of account. A reporter (Site engineer) writes the day's report; a reviewer (Project engineer, Admin)
// approves, sends back and comments, and gives the crew their wages; a viewer only reads. Central Hub's access rules
// decide the rest on the script.

// 2.66.0 (owner): a technician only shares photos of the work done
export const kindOf = role => (role === 'technician' ? 'technician' : role === 'coordinator' || role === 'admin' ? 'reviewer' : role === 'viewer' || role === 'exec' ? 'viewer' : 'reporter');
export const KIND_WORD = { reporter: 'Site', reviewer: 'Approve, send back, comment', viewer: 'View only', technician: 'Share work photos' };

// 3.4.0 (owner, 15 Nov): one Review hub: Pending, Approved, Rejected (sent back), Requests (reports with material requests), All
export const REVIEW_FILTERS = [['submitted', 'Pending'], ['approved', 'Approved'], ['changes', 'Rejected'], ['req', 'Requests'], ['', 'All']];
/** The reports of one project, newest first, by status (or 'req'), on one day, and matching a search (number, name, date). */
export const reviewRows = (list, code, f, { day = '', q = '' } = {}) => {
  const t = String(q || '').trim().toLowerCase();
  return (list || []).filter(x => (!code || String(x.name || '').includes(`_${code}_`))
      && (!f || (f === 'req' ? Number(x.requests) > 0 : (x.status || 'submitted') === f))
      && (!day || x.date === day)
      && (!t || [x.no, String(Number(x.no)), x.date, x.preparedBy, x.uploadedBy, x.reviewedBy, x.name].some(v => String(v || '').toLowerCase().includes(t))))
    .sort((a, b) => String(b.date + b.no).localeCompare(String(a.date + a.no)));
};
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
