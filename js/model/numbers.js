// 3.3.0 (owner, 15 Nov): the report number counts every working day, with or without a report; only the project's
// days off (weekly nwDow, 0 = Sunday, and its non-working dates) are skipped. The server gives the real number; this is
// the phone's guess for offline days and the same rule as the script's workDaysAfter_.

/** The working days after date a, up to and including date b (yyyy-mm-dd); at least 1. */
export function workDaysAfter(p, a, b) {
  const off = Array.isArray(p?.nwDow) ? p.nwDow.map(Number) : [0], nw = new Set(p?.nonWorking || []);
  let n = 0, t = Date.parse(a + 'T12:00:00Z');
  const end = Date.parse(b + 'T12:00:00Z');
  for (let i = 0; i < 4000 && !Number.isNaN(t); i++) {
    t += 864e5;
    if (t > end) break;
    const d = new Date(t);
    if (!off.includes(d.getUTCDay()) && !nw.has(d.toISOString().slice(0, 10))) n++;
  }
  return Math.max(1, n);
}

/** The drafts with the server's numbers ({ 'yyyy-mm-dd': n }) for one project; null when nothing changes. */
export function renumbered(drafts, code, nos) {
  let out = null;
  for (const [k, r] of Object.entries(drafts || {})) {
    const [c, date] = k.split('|');
    const n = Number((nos || {})[date]);
    if (c !== code || !n || !r || r.nowork || r.no === n) continue;
    out = out || { ...drafts };
    out[k] = { ...r, no: n };
  }
  return out;
}

/** 3.5.0 (P3): how long a sent report stays on the phone. */
export const KEEP_DAYS = 60;
/** The drafts to drop: older than `days`, sent (or a no-work day), and every photo already in Drive. */
export function staleDrafts(drafts, today, days = KEEP_DAYS) {
  const cut = new Date(Date.parse(today + 'T12:00:00Z') - days * 864e5).toISOString().slice(0, 10);
  return Object.entries(drafts || {}).filter(([k, r]) => {
    const date = k.split('|')[1] || '';
    return r && date && date < cut && (r.sentAt || r.nowork) && (r.photos || []).every(p => p.drive);
  }).map(([k]) => k);
}
