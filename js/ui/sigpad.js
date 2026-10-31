// 2.4.0: the signature, drawn full screen (Clear, Apply) or chosen as a PNG from the phone's files. It is set once
// after the sign-up is approved, can be changed in Me, and is kept in Drive (script 7.36.0) so a new phone has it too.
// The overlay is plain DOM above the app, so a redraw of the screen does not wipe what is being drawn.

const MAX_W = 600, MAX_H = 220;

/** The ink cut to its edges, on white (a see-through signature prints black in some PDF viewers). '' when nothing was drawn. */
export function trimmed(canvas) {
  const w = canvas.width, h = canvas.height, px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return '';
  const pad = 10, sw = x1 - x0 + 1 + pad * 2, sh = y1 - y0 + 1 + pad * 2, k = Math.min(1, MAX_W / sw, MAX_H / sh);
  const out = document.createElement('canvas');
  out.width = Math.round(sw * k); out.height = Math.round(sh * k);
  const g = out.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(canvas, x0 - pad, y0 - pad, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

/** A PNG the person chose, scaled to fit, on white. */
const fromFile = file => new Promise((resolve, reject) => {
  if (file.type !== 'image/png') { reject(new Error('Choose a PNG file.')); return; }
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, MAX_W / img.width, MAX_H / img.height), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    resolve(c.toDataURL('image/png'));
  };
  img.onerror = () => reject(new Error('That file could not be read.'));
  img.src = URL.createObjectURL(file);
});

/** Full-screen signing. Resolves the PNG data URL, or '' when cancelled. */
export function openPad(title = 'Your signature') {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'sigfull';
    box.setAttribute('role', 'dialog');
    box.innerHTML = `<div class="sigfull-top"><b></b><span class="muted small">Sign with your finger</span></div>
      <canvas class="sigfull-pad" aria-label="Sign here"></canvas>
      <div class="sigfull-bar"><button type="button" class="btn t slim" data-k="cancel">Cancel</button>
        <label class="btn t slim">Choose a PNG<input type="file" accept="image/png" hidden></label>
        <button type="button" class="btn o slim" data-k="clear">Clear</button><button type="button" class="btn p slim" data-k="apply">Apply</button></div>`;
    box.querySelector('b').textContent = title;
    box.setAttribute('aria-label', title);
    // 2.8.0: a phone held upright gets the pad turned to landscape (wide to sign, Clear and Apply at the side)
    const rot = innerHeight > innerWidth && innerWidth < 700;
    if (rot) box.classList.add('rot');
    document.body.append(box);
    const cv = box.querySelector('canvas'), g = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cv.offsetWidth * dpr); cv.height = Math.round(cv.offsetHeight * dpr);
    g.lineWidth = 3 * dpr; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1b2430';
    // turned a quarter clockwise: the pad's x runs down the screen, its y from right to left
    const at = e => { const r = cv.getBoundingClientRect(); return rot ? [(e.clientY - r.top) * dpr, (r.right - e.clientX) * dpr] : [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr]; };
    let down = false;
    cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...at(e)); g.lineTo(...at(e)); g.stroke(); });
    cv.addEventListener('pointermove', e => { if (down) { g.lineTo(...at(e)); g.stroke(); } });
    cv.addEventListener('pointerup', () => { down = false; });
    cv.addEventListener('pointercancel', () => { down = false; });
    const close = png => { box.remove(); resolve(png); };
    box.addEventListener('click', e => {
      const k = e.target.closest('[data-k]')?.dataset.k;
      if (k === 'cancel') close('');
      if (k === 'clear') g.clearRect(0, 0, cv.width, cv.height);
      if (k === 'apply') { const png = trimmed(cv); if (png) close(png); else alert('Sign first, or press Cancel.'); }
    });
    box.querySelector('input').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (f) { try { close(await fromFile(f)); } catch (err) { alert(err.message); } }
    });
  });
}
