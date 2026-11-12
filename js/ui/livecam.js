// 2.76.0 (owner, 8 Nov, design "FR report camera"): the report camera inside Field Report. A live view with PHOTO and
// VIDEO, a big shutter, a front/back switch and how many were taken today. A video stops by itself at 60 seconds and goes
// to Central Hub only (kept 30 days). Nothing can come from the gallery here. A phone that cannot show a live camera
// gets the phone's own camera, as before.

import { html } from '../core/dom.js';
import { recType, targetBitrate } from '../core/video.js';

export const LIVE_SECONDS = 60;
/** 2.78.0: the video bitrate; 2.98.0 (owner, 12 Nov: "fix the video quality"): 3 Mbps at 1080p, less only when the size limit asks for it. */
export const VIDEO_BPS = 3000000;
export const videoBps = maxBytes => Math.min(VIDEO_BPS, targetBitrate(LIVE_SECONDS, maxBytes) || VIDEO_BPS);
const two = n => String(Math.floor(n)).padStart(2, '0');
/** "00:12" for 12 seconds. */
export const clock = sec => `${two(sec / 60)}:${two(sec % 60)}`;
/** The red label while recording: "REC 00:12 / 01:00". */
export const recLabel = (sec, max = LIVE_SECONDS) => `REC ${clock(Math.min(sec, max))} / ${clock(max)}`;
/** How much of the 60 seconds is used, 0–100. */
export const limitPct = (sec, max = LIVE_SECONDS) => Math.max(0, Math.min(100, Math.round(sec / max * 100)));
/** Can this phone show a live camera here? */
export const canLive = (nav = typeof navigator !== 'undefined' ? navigator : null) => !!(nav && nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function');

/** The camera screen's markup (also used by the tests). */
export function camView({ mode = 'photo', title = '', count = 0, sec = 0, recording = false, busy = '' } = {}) {
  return html`<div class="lc-bar"><button type="button" class="lc-x" data-lc="x" aria-label="Close">✕</button><h1>Report photos${title ? ` · ${title}` : ''}</h1></div>
    <div class="lc-view"><video playsinline muted autoplay></video>
      ${recording ? html`<span class="lc-rec"><i></i>${recLabel(sec)}</span>` : ''}
      ${mode === 'video' ? html`<span class="lc-lim"><b style="width:${limitPct(sec)}%"></b></span>` : ''}
      ${busy ? html`<span class="lc-busy">${busy}</span>` : ''}</div>
    <div class="lc-modes" role="tablist"><button type="button" role="tab" class="${mode === 'photo' ? 'on' : ''}" data-lc="photo" ${recording ? 'disabled' : ''}>PHOTO</button><button type="button" role="tab" class="${mode === 'video' ? 'on' : ''}" data-lc="video" ${recording ? 'disabled' : ''}>VIDEO</button></div>
    <div class="lc-ctl"><span class="lc-thumb" aria-label="Taken today"><span>${count}</span></span>
      <button type="button" class="lc-shut ${mode} ${recording ? 'rec' : ''}" data-lc="shut" aria-label="${mode === 'photo' ? 'Take the photo' : recording ? 'Stop recording' : 'Start recording'}" ${busy ? 'disabled' : ''}><i></i></button>
      <button type="button" class="lc-flip" data-lc="flip" aria-label="Switch camera" ${recording ? 'disabled' : ''}>⟲</button></div>
    ${mode === 'video' ? html`<div class="lc-info"><div><b>Video goes to the Central Hub dashboard only.</b> It is not put in the client's daily report. Photos still go in the report as now.</div>
      <div><b>Kept 30 days</b>, then deleted from the system automatically.</div></div>` : ''}
    <p class="lc-fn">All photos and videos are taken live with this camera. Uploads from the gallery are not possible.</p>`;
}

/**
 * Open the camera. onPhoto(file) gets a JPEG taken now (the camera closes, as the caption comes next);
 * onVideo(file, seconds) gets each video (the camera stays open); fallback(mode) is used when there is no live camera.
 */
export async function openLiveCam({ mode = 'photo', title = '', count = () => 0, onPhoto, onVideo, fallback, maxBytes = 15 * 1024 * 1024 }) {
  if (!canLive()) return fallback(mode);
  const el = document.createElement('div');
  el.className = 'livecam'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Report camera');
  const st = { mode, facing: 'environment', stream: null, rec: null, parts: [], sec: 0, tick: 0, busy: '', mic: null };
  const paint = () => {
    const old = el.querySelector('video');   // the live view is kept between redraws, so it never blinks
    el.innerHTML = String(camView({ mode: st.mode, title, count: count(), sec: st.sec, recording: !!st.rec, busy: st.busy }));
    if (old) el.querySelector('video').replaceWith(old);
    const v = el.querySelector('video');
    if (st.stream && v.srcObject !== st.stream) { v.srcObject = st.stream; v.play().catch(() => {}); }
  };
  const stopAll = () => { [st.stream, st.mic].forEach(s => s && s.getTracks().forEach(t => t.stop())); st.stream = st.mic = null; };
  const close = () => { clearInterval(st.tick); if (st.rec && st.rec.state !== 'inactive') { st.closing = true; st.rec.stop(); return; } stopAll(); el.remove(); document.body.classList.remove('lc-open'); };
  const start = async () => {
    stopAll();
    try {
      st.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: st.facing }, width: { ideal: 4096 }, height: { ideal: 2160 } } });
    } catch (e) {
      el.remove(); document.body.classList.remove('lc-open');
      return fallback(st.mode);   // no camera allowed here: the phone's own camera, as before
    }
    paint();
  };
  const snap = async () => {
    const track = st.stream?.getVideoTracks()[0]; if (!track) return;
    st.busy = 'Saving the photo…'; paint();
    let blob = null;
    try { if (typeof ImageCapture !== 'undefined') blob = await new ImageCapture(track).takePhoto(); } catch { blob = null; }   // the camera's full size where the phone allows it
    if (!blob) {
      const v = el.querySelector('video'), cv = document.createElement('canvas');
      cv.width = v.videoWidth; cv.height = v.videoHeight; cv.getContext('2d').drawImage(v, 0, 0);
      blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.95));
    }
    st.busy = '';
    if (!blob) { paint(); return; }
    close();
    onPhoto(new File([blob], `photo_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg', lastModified: Date.now() }));
  };
  const record = async () => {
    const type = recType();
    if (!type) { close(); return fallback('video'); }
    try { st.mic = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { st.mic = null; }   // without sound when the microphone is not allowed
    // 2.78.0 (owner, 8 Nov: load quickly, same quality): videos at 720p, 30 frames, about 1 Mbps, so 60 s is about 8 MB
    const vt = st.stream.getVideoTracks()[0];
    await vt?.applyConstraints?.({ width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }).catch(() => {});   // 2.98.0: 1080p
    const both = new MediaStream([...st.stream.getVideoTracks(), ...(st.mic ? st.mic.getAudioTracks() : [])]);
    st.rec = new MediaRecorder(both, { mimeType: type, videoBitsPerSecond: videoBps(maxBytes), audioBitsPerSecond: 64000 });
    st.parts = []; st.sec = 0;
    const t0 = Date.now();
    st.rec.ondataavailable = e => { if (e.data && e.data.size) st.parts.push(e.data); };
    st.rec.onstop = () => {
      clearInterval(st.tick);
      const secs = Math.max(1, Math.round((Date.now() - t0) / 1000)), blob = new Blob(st.parts, { type: type.split(';')[0] });
      st.rec = null; st.sec = 0;
      vt?.applyConstraints?.({ width: { ideal: 4096 }, height: { ideal: 2160 } }).catch(() => {});   // full size again for photos
      if (st.mic) { st.mic.getTracks().forEach(t => t.stop()); st.mic = null; }
      if (blob.size) onVideo(new File([blob], `video_${Date.now()}.${/mp4/.test(type) ? 'mp4' : 'webm'}`, { type: blob.type, lastModified: Date.now() }), secs);
      if (st.closing) { stopAll(); el.remove(); document.body.classList.remove('lc-open'); } else setTimeout(paint, 300);
    };
    st.rec.start(1000);
    st.tick = setInterval(() => {
      st.sec = Math.floor((Date.now() - t0) / 1000);
      if (st.sec >= LIVE_SECONDS && st.rec?.state === 'recording') st.rec.stop(); else paint();
    }, 500);
    paint();
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-lc]'); if (!b || b.disabled) return;
    const k = b.dataset.lc;
    if (k === 'x') close();
    else if (k === 'photo' || k === 'video') { st.mode = k; paint(); }
    else if (k === 'flip') { st.facing = st.facing === 'environment' ? 'user' : 'environment'; start(); }
    else if (k === 'shut') { if (st.mode === 'photo') snap(); else if (st.rec) st.rec.stop(); else record(); }
  });
  document.body.append(el); document.body.classList.add('lc-open');
  paint();
  await start();
}
