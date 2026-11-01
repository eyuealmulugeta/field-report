// 2.18.0: a report's rating out of 5 from four parts (owner, 1 Nov): photo times, data strength,
// engagement in the morning, during the day and at the end of day, and grammar.

const mins = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
const round = x => Math.round(Math.max(0, Math.min(5, x)) * 10) / 10;

/** The part of the day an hour falls in: morning before 11:00, during the day to 16:00, then end of day. */
export const partOf = hhmm => { const m = mins(hhmm); return m == null ? '' : m < 660 ? 'm' : m < 960 ? 'd' : 'e'; };

/** Photos taken inside the working hours (30 min early, 1 h late allowed) and not all in one hour. */
export function photoScore(r) {
  const ps = r.photos || [];
  if (!ps.length) return { v: 0, why: 'No photos' };
  const a = (mins(r.start && r.start.start) ?? 480) - 30, b = (mins(r.start && r.start.end) ?? 1020) + 60;
  const times = ps.map(p => mins(p.at)).filter(x => x != null);
  const inside = times.filter(x => x >= a && x <= b).length;
  let v = 5 * inside / ps.length;
  const bunched = times.length >= 3 && Math.max(...times) - Math.min(...times) < 60;
  if (bunched) v -= 1;
  return { v: round(v), why: inside < ps.length ? `${ps.length - inside} taken outside working hours` : bunched ? 'All taken within one hour' : 'Taken through the day' };
}

/** How full the report is: the eight data steps done, and work lines with real detail. */
export function dataScore(r) {
  const d = r.done || {};
  const steps = [r.start && r.start.done, (r.crew && r.crew.rows || []).length, d.work, d.equipment, d.materials, d.safety || (r.safety && r.safety.done), (r.photos || []).length >= 3, d.end];
  const items = r.items || [];
  const detail = items.length ? items.filter(i => String(i.text || '').trim().length >= 15).length / items.length : 0;
  const v = 4 * steps.filter(Boolean).length / steps.length + detail;
  return { v: round(v), why: `${steps.filter(Boolean).length} of 8 parts filled${items.length ? `, ${Math.round(detail * 100)}% of work lines detailed` : ', no work lines'}` };
}

/** Worked on in the morning, during the day and at the end of day (each part counts once). */
export function engageScore(r) {
  const seen = { ...(r.seen || {}) };
  for (const e of r.edits || []) { const p = partOf(new Date(e.at).toLocaleTimeString('en-GB', { timeZone: 'Africa/Addis_Ababa', hour: '2-digit', minute: '2-digit' })); if (p) seen[p] = seen[p] || e.at; }
  const parts = ['m', 'd', 'e'].filter(p => seen[p]);
  const word = { m: 'morning', d: 'day', e: 'end' };
  return { v: round(5 * parts.length / 3), parts, why: parts.length ? `Worked on: ${parts.map(p => word[p]).join(', ')}` : 'No times kept' };
}

/** Free text written in the report. */
export function textsOf(r) {
  const out = [r.notes, r.instructions, r.safety && r.safety.note];
  for (const k of ['items', 'delays', 'requests', 'plan', 'received']) for (const x of r[k] || []) out.push(x && (x.text || x.note || x.desc));
  return out.map(x => String(x || '').trim()).filter(x => x.length >= 3);
}

/** Simple grammar checks: a capital first letter, no ALL CAPS, no word written twice, no double spaces or space before a stop. */
export function grammarScore(r) {
  const t = textsOf(r);
  if (!t.length) return { v: 0, why: 'No written text' };
  const bad = t.filter(s => !/^[A-Z0-9"'(]/.test(s) || (/[a-z]/i.test(s) && s.length > 8 && s === s.toUpperCase()) || /\b(\w+)\s+\1\b/i.test(s) || / {2,}/.test(s) || /\s[,.;:!?]/.test(s));
  return { v: round(5 * (1 - bad.length / t.length)), why: bad.length ? `${bad.length} of ${t.length} texts to correct` : 'Clean' };
}

/** The rating: the four parts and their average. */
export function rateReport(r) {
  const parts = { photos: photoScore(r), data: dataScore(r), engage: engageScore(r), grammar: grammarScore(r) };
  const v = round(Object.values(parts).reduce((a, x) => a + x.v, 0) / 4);
  return { v, parts };
}

export const RATE_WORD = { photos: 'Photo times', data: 'Data strength', engage: 'Engagement', grammar: 'Grammar' };
/** "Rating 4.2/5 · Photo times 5 · Data strength 4 · Engagement 3.3 · Grammar 5" */
export const rateLine = x => `Rating ${x.v}/5 · ${Object.entries(x.parts).map(([k, p]) => `${RATE_WORD[k]} ${p.v}`).join(' · ')}`;
