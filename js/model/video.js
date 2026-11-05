// 2.50.0 (owner, 5 Nov, R4): a live video of the day's work, recorded with the report camera. It goes to Central Hub
// only (never into the client's report or its PDF) and the server deletes it after 30 days.

export const VIDEO_KEEP_DAYS = 30, VIDEO_KEEP = 40;   // the phone keeps the last 40 in its list (sent ones as a record)
/** The videos of a project on a day, newest first. */
export const videosOf = (list = [], code, date) => list.filter(v => v.proj === code && v.date === date).sort((a, b) => String(b.time).localeCompare(String(a.time)));
/** The videos not sent yet. */
export const videoWaiting = (list = []) => list.filter(v => !v.sent && !v.gone);
/** A new video in the list (newest first, the list kept short). */
export const videoAdd = (list = [], v) => [v, ...list.filter(x => x.id !== v.id)].slice(0, VIDEO_KEEP);
