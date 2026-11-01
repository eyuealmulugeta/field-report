// 2.7.0: Spotlight. A note about a person or the project, with photos or videos from the camera or the gallery.
// It goes to Central Hub only (never into the report); the PM, GM and Coordinator are told. Kept on the phone until sent.

// 2.21.0 (Central Hub v0.49.0, owner's Spotlight): a note about a person has a category; a project update a topic
export const SPOT_CATS = ['Safety', 'Quality', 'Teamwork', 'Punctuality', 'Conduct', 'Other'];
export const SPOT_TOPICS = ['The project', 'The crew', 'The company', 'The client', 'Other'];
export const SPOT_TONES = [['pos', 'Positive'], ['neg', 'Negative']];
export const SPOT_MAX = 10, VIDEO_MAX_MB = 20, VIDEO_SECONDS = 60;   // 2.21.0: live video up to 60 seconds
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'];
export const PROJECT_ABOUT = 'The project';

export const newSpot = () => ({ about: PROJECT_ABOUT, tone: '', cat: '', note: '', media: [] });

/** What is still missing before a note can be kept; '' when it is ready. */
export function spotMissing(s) {
  if (!s.tone) return 'Choose Positive or Negative.';
  if (!catsFor(s.about).includes(s.cat)) return s.about === PROJECT_ABOUT ? 'Choose the topic.' : 'Choose what it is about (Safety, Quality…).';
  if (!String(s.note || '').trim() && !s.media.length) return 'Write a note or add a photo or video.';
  return '';
}

/** A picked file: a photo (shrunk later), a video (made smaller on the phone when too big or of another type), or why it is refused. */
export function mediaKind(file) {
  if (/^image\//.test(file.type)) return { kind: 'photo' };
  if (!/^video\//.test(file.type)) return { refused: 'Only photos and videos can be added.' };
  return { kind: 'video', shrink: !VIDEO_TYPES.includes(file.type) || file.size > VIDEO_MAX_MB * 1024 * 1024 };
}
/** 2.7.1: the size a made-smaller video aims for (under the limit, with room to spare). */
export const VIDEO_AIM = 15 * 1024 * 1024;

/** The chips of a note: the categories for a person, the topics for the project. */
export const catsFor = about => (about === PROJECT_ABOUT ? SPOT_TOPICS : SPOT_CATS);

// 2.21.0: the tiers of Central Hub (js/engine/positions.js): Tiers 1, 2 and 3 write about a person, about the tier below
// (Tier 1 about anyone, Tier 3 about the crew and Security). Anyone writes a project update.
const T1 = /\b(owner|general manager|gm|ceo|board)\b/i;
const T2 = /\b(project engineer|project manager|project coordinator|coordinator|chief engineer|accountant|hr|hse)\b/i;
const T3 = /\b(site engineer|office engineer|architect|draft|qs|quantity surveyor|procurement|logistics|foreman)\b/i;
const T5 = /\b(security|guard)\b/i;
export const tierOfWord = w => { const s = String(w || ''); return !s.trim() ? 0 : T1.test(s) ? 1 : T2.test(s) ? 2 : T3.test(s) ? 3 : T5.test(s) ? 5 : 4; };
const RATES = { 1: [2, 3, 4, 5], 2: [3], 3: [4, 5] };
/** The people a note can be about: the project, then those of the crew list the writer may rate. */
export const aboutList = (staff, myPosition = '') => {
  const may = RATES[tierOfWord(myPosition)] || [];
  return [PROJECT_ABOUT, ...(staff || []).filter(s => s && s.name && s.active !== false && may.includes(tierOfWord(s.trade || s.role || s.position) || 4)).map(s => s.name)];
};
