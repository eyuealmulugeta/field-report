// 2.7.1: a video too big to send is made smaller on the phone instead of being refused.
// It is played (muted to the speaker) into a smaller canvas and recorded again at a lower bitrate,
// so it takes about as long as the video itself. Nothing leaves the phone while this runs.

/** The bitrate (bits per second) that keeps a video of `sec` seconds under `maxBytes`; 0 when it is too long. */
export function targetBitrate(sec, maxBytes) {
  if (!(sec > 0)) return 0;
  const bps = Math.floor((maxBytes * 8 * 0.85) / sec) - 96000;   // room for the sound and the file's own bytes
  return bps < 150000 ? 0 : Math.min(bps, 1500000);
}

/** The recording type this phone can make (MP4 first, else WEBM); '' when it cannot record. */
export function recType(can = t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
  return ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => can(t)) || '';
}

/** Make `file` smaller than maxBytes. onProgress(0..1). Resolves to a Blob of type video/mp4 or video/webm. */
export function shrinkVideo(file, maxBytes, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const type = recType();
    if (!type || !HTMLCanvasElement.prototype.captureStream) return reject(new Error('This phone cannot make videos smaller. Record a shorter one.'));
    const url = URL.createObjectURL(file), v = document.createElement('video');
    const done = (err, blob) => { URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); err ? reject(err) : resolve(blob); };
    v.playsInline = true; v.preload = 'auto'; v.src = url;
    v.onerror = () => done(new Error('This video cannot be read on this phone.'));
    v.onloadedmetadata = async () => {
      const bps = targetBitrate(v.duration, maxBytes);
      if (!bps) return done(new Error('This video is too long to send. Record one under 10 minutes.'));
      const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight || 1));
      const cv = document.createElement('canvas');
      cv.width = Math.max(2, Math.round(v.videoWidth * scale / 2) * 2); cv.height = Math.max(2, Math.round(v.videoHeight * scale / 2) * 2);
      const g = cv.getContext('2d'), stream = cv.captureStream(24);
      let ac = null;
      try {   // the sound, recorded but not played aloud
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const src = ac.createMediaElementSource(v), dest = ac.createMediaStreamDestination();
        src.connect(dest); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      } catch { v.muted = true; }
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bps, audioBitsPerSecond: 64000 }), parts = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      rec.onstop = () => {
        if (ac) ac.close().catch(() => {});
        const blob = new Blob(parts, { type: type.split(';')[0] });
        blob.size && blob.size <= maxBytes ? done(null, blob) : done(new Error('The video is still too big. Record a shorter one.'));
      };
      let tick = 0;   // a timer, not animation frames: those stop when the screen is covered
      const draw = () => { g.drawImage(v, 0, 0, cv.width, cv.height); onProgress(Math.min(1, v.currentTime / v.duration)); };
      v.onended = () => { clearInterval(tick); g.drawImage(v, 0, 0, cv.width, cv.height); setTimeout(() => rec.state !== 'inactive' && rec.stop(), 200); };
      try {
        if (ac && ac.state === 'suspended') await ac.resume();
        rec.start(1000);
        await v.play().catch(() => { v.muted = true; return v.play(); });   // a phone that will not play it with sound: without
        tick = setInterval(draw, 40);
      } catch (e) { if (rec.state !== 'inactive') rec.stop(); done(new Error(`Could not make the video smaller (${e.message || e}).`)); }
    };
  });
}
