// 2.49.0 (owner, 5 Nov, R3): Visitors, a tab of Spotlight. A visitor logged on site (client, consultant, inspector)
// goes to Central Hub only, like a Spotlight note (script 7.46.0 spotPut with visit; visitOut for the time they left).
// Photos are taken with the camera only; the visitor may sign on the phone (kept as one of the photos).

export const VISIT_TYPES = ['Client', 'Consultant', 'Inspector', 'Other'];
export const PURPOSES = ['Site walk / inspection', 'Meeting', 'Handover / testing', 'Delivery check', 'Other'];
export const VISIT_PHOTOS = 6;

export const newVisit = () => ({ type: 'Client', media: [], signId: '' });

/** What is still missing before a visit can be kept; '' when it is ready. */
export function visitMissing(v) {
  if (!String(v.name || '').trim()) return "Write the visitor's name.";
  if (!/^\d{2}:\d{2}$/.test(v.tin || '')) return 'Give the time they arrived.';
  if (v.tout && !/^\d{2}:\d{2}$/.test(v.tout)) return 'Give the time they left, or leave it empty while they are on site.';
  if (v.tout && v.tout < v.tin) return 'They cannot leave before they arrived.';
  return '';
}

/** The visits of one project kept on this phone, newest first. */
export const visitsOf = (spots, proj) => (spots || []).filter(x => x.visit && x.proj === proj);

/** Today, still on site (today, no leaving time), this month. */
export function visitCounts(list, today) {
  const month = String(today).slice(0, 7);
  return {
    today: list.filter(x => x.date === today).length,
    onSite: list.filter(x => x.date === today && !x.visit.tout).length,
    month: list.filter(x => String(x.date).startsWith(month)).length,
  };
}

/** The note sent to Central Hub: the visit, its photos, then the signature (sign = its number). */
export function visitRecord(v, { id, proj, date, time }) {
  const media = (v.media || []).map(m => ({ id: m.id, kind: 'photo', type: 'image/jpeg' }));
  const sign = v.signId ? media.length : -1;
  if (v.signId) media.push({ id: v.signId, kind: 'sign', type: 'image/jpeg' });
  const name = String(v.name || '').trim(), summary = String(v.summary || '').trim();
  return { id, proj, date, time, about: name, tone: '', cat: 'Visit', note: summary, media, sent: false,
    visit: { type: VISIT_TYPES.includes(v.type) ? v.type : 'Other', name, org: String(v.org || '').trim(), tin: v.tin, tout: v.tout || '', purpose: v.purpose || PURPOSES[0], result: String(v.result || '').trim(), sign } };
}
