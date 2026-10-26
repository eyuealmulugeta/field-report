// The Apps Script the old app uses. Same actions, no script change for 2.0.
// Requests are JSON sent as text/plain, so the browser does not ask the script for permission first.

export const SCRIPT = 'https://script.google.com/macros/s/AKfycbw60G2k1_o25WQtvwUnoQ0JRecC0ty_KPHqK82QVDglGeXIKRhoGsi1Pvi12SBJRWNL/exec';
export const APP_VERSION = '2.0.0';

/** This phone's id for the Admin's new-device check (script 7.28.0): random, kept on the phone, sent with every request. */
export function deviceId() {
  try {
    let d = localStorage.getItem('afr_devid');   // the same id as Field Report 1 on this phone (same address), so one approval covers both
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(d || '')) {
      const a = new Uint8Array(12); crypto.getRandomValues(a);
      d = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('afr_devid', d);
    }
    return d;
  } catch { return 'nostorage00'; }
}

/** "Android 13; SM-A145F · Chrome": shown to the Admin with a new device. */
export function deviceUa() {
  const u = navigator.userAgent || '', m = /\(([^)]+)\)/.exec(u);
  const b = /Edg\//.test(u) ? 'Edge' : /SamsungBrowser/.test(u) ? 'Samsung' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /Firefox\//.test(u) ? 'Firefox' : '';
  return ((m ? m[1].replace(/;\s*wv/, '') : '') + (b ? ` · ${b}` : '')).slice(0, 60);
}

/** A new device: Central Hub's function reads the phone's IP address for the Admin's alert (Apps Script cannot see it). */
function sendWhere(r) {
  try { if (r && r.ticket && /^https:\/\//.test(r.whereUrl || '')) fetch(`${r.whereUrl}?t=${encodeURIComponent(r.ticket)}`, { mode: 'no-cors', keepalive: true }).catch(() => {}); } catch { /* the alert still goes, without the IP */ }
}

export class ApiError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

let fake = null;
/** Demo mode replaces the server with a function (action, body) => reply. */
export const useFake = fn => { fake = fn; };
export const isDemo = () => !!fake;

export async function post(action, body = {}, token = '') {
  const payload = { action, ...body, ...(token ? { token } : {}), dev: deviceId(), app: APP_VERSION };
  if (fake) {
    const r = await fake(action, payload);
    if (!r.ok) throw Object.assign(new ApiError(r.error || 'Failed', r.code), { reply: r });
    return r;
  }
  let res;
  try {
    res = await fetch(SCRIPT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), redirect: 'follow' });
  } catch {
    throw new ApiError('No connection. It is saved on this phone.', 'OFFLINE');
  }
  let r;
  try { r = await res.json(); } catch { throw new ApiError('The server did not answer properly. Try again.', 'SERVER'); }
  if (!r.ok) throw Object.assign(new ApiError(r.error || r.message || 'Failed', r.code), { reply: r });
  return r;
}

/** Loads Google's sign-in library once. */
function loadGoogle() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => ok();
    s.onerror = () => fail(new ApiError('Google sign-in could not load. Check the connection.', 'OFFLINE'));
    document.head.appendChild(s);
  });
}

/** The script's sign-in; a new or denied device is refused with "Unauthorized user". */
async function signinPost(body) {
  try { const r = await post('signin', body); sendWhere(r); return r; }
  catch (e) {
    if (e.code !== 'DEVICE') throw e;
    sendWhere(e.reply);
    throw new ApiError(e.reply && e.reply.status === 'deny' ? 'Unauthorized user. The Admin has blocked this device.'
      : 'Unauthorized user. This device is new: the Admin has been told. Sign in again after the Admin approves it.', 'DEVICE');
  }
}

/** Google sign-in, then the script's own session: { token, who, role, email, name, days }. */
export async function signIn(name = '') {
  if (fake) return signinPost({ accessToken: 'demo', name, ua: deviceUa() });
  const cfg = await post('authcfg');
  if (!cfg.clientId) throw new ApiError('Google sign-in is not set up on the server yet.', 'AUTH');
  await loadGoogle();
  const accessToken = await new Promise((ok, fail) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: cfg.clientId,
      scope: 'openid email profile',
      callback: r => (r && r.access_token ? ok(r.access_token) : fail(new ApiError('Google sign-in did not complete. Try again.', 'AUTH'))),
      error_callback: () => fail(new ApiError('Google sign-in was closed. Try again.', 'AUTH')),
    });
    client.requestAccessToken();
  });
  return signinPost({ accessToken, name, ua: deviceUa() });
}
