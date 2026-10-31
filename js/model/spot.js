// 2.7.0: Spotlight. A note about a person or the project, with photos or videos from the camera or the gallery.
// It goes to Central Hub only (never into the report); the PM, GM and Coordinator are told. Kept on the phone until sent.

export const SPOT_CATS = ['Safety', 'Quality', 'Teamwork', 'Punctuality', 'Conduct', 'Progress', 'Other'];
export const SPOT_TONES = [['pos', 'Positive'], ['neg', 'Negative']];
export const SPOT_MAX = 10, VIDEO_MAX_MB = 20;
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'];
export const PROJECT_ABOUT = 'The project';

export const newSpot = () => ({ about: PROJECT_ABOUT, tone: '', cat: '', note: '', media: [] });

/** What is still missing before a note can be kept; '' when it is ready. */
export function spotMissing(s) {
  if (!s.tone) return 'Choose Positive or Negative.';
  if (!s.cat) return 'Choose what it is about (Safety, Quality…).';
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

/** The people a note can be about: the project, then the crew list of the project. */
export const aboutList = staff => [PROJECT_ABOUT, ...(staff || []).filter(s => s && s.name && s.active !== false).map(s => s.name)];
