// The Apps Script the old app uses. Same actions, no script change for 2.0.
// Requests are JSON sent as text/plain, so the browser does not ask the script for permission first.

export const SCRIPT = 'https://script.google.com/macros/s/AKfycbw60G2k1_o25WQtvwUnoQ0JRecC0ty_KPHqK82QVDglGeXIKRhoGsi1Pvi12SBJRWNL/exec';
export const APP_VERSION = '2.5.0';

const DEV_RE = /^[A-Za-z0-9_-]{8,40}$/;
const devCookie = () => { try { return (/(?:^|;\s*)afr_devid=([A-Za-z0-9_-]{8,40})/.exec(document.cookie) || [])[1] || ''; } catch { return ''; } };

/**
 * This phone's id for the Admin's new-device check (script 7.28.0): random, kept on the phone, sent with every request.
 * 2.2.0: kept twice (storage and a cookie), so clearing one does not make the phone look new and wait for approval again.
 */
export function deviceId() {
  let d = '', kept = false;
  try { d = localStorage.getItem('afr_devid') || ''; } catch { /* no storage */ }   // the same id as Field Report 1 on this phone (same address), so one approval covers both
  if (!DEV_RE.test(d)) d = devCookie();
  if (!DEV_RE.test(d)) {
    const a = new Uint8Array(12); crypto.getRandomValues(a);
    d = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }
  try { if (localStorage.getItem('afr_devid') !== d) localStorage.setItem('afr_devid', d); kept = true; } catch { /* the cookie may still keep it */ }
  try { if (devCookie() !== d) document.cookie = `afr_devid=${d}; max-age=34560000; path=${location.pathname.replace(/[^/]*$/, '')}; SameSite=Strict; Secure`; } catch { /* storage only */ }
  return kept || devCookie() === d ? d : 'nostorage00';
}

/** 'app' when opened from the home screen, else 'browser': on an iPhone these are two separate phones to the Admin. */
export const deviceMode = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'app' : 'browser'; } catch { return ''; } };

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
  const payload = { action, ...body, ...(token ? { token } : {}), dev: deviceId(), mode: deviceMode(), app: APP_VERSION };
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

/** The script's sign-in; a new or denied device is refused with "Unauthorized user". */
async function signinPost(body) {
  try { const r = await post('signin', body); sendWhere(r); return r; }
  catch (e) {
    // 2.4.0 (script 7.35.0): a Google account without access asks to join; the sign-up form sends the name and phone with the same sign-in
    if (e.code === 'SIGNUP') {
      sendWhere(e.reply);
      try { if (body.accessToken) sessionStorage.setItem(SIGNUP, body.accessToken); } catch { /* the form asks to sign in again */ }
      throw Object.assign(new ApiError(e.message, 'SIGNUP'), { reply: e.reply });
    }
    if (e.code !== 'DEVICE') throw e;
    sendWhere(e.reply);
    throw new ApiError(e.message || 'Unauthorized user', 'DEVICE');   // 2.2.0: the script says why (waiting, refused, ...)
  }
}

/** Where Google sends the phone back after sign-in: the app's own address (registered in the Google Cloud OAuth client). */
export const backUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
const OAUTH = 'fr2_oauth';
const SIGNUP = 'fr2_signup';

/** 2.4.0: send the sign-up form (full name, phone) with the Google sign-in just made. Answers like a sign-in. */
export function signUp(form) {
  let at = '';
  try { at = sessionStorage.getItem(SIGNUP) || ''; } catch { /* below */ }
  if (!at && !fake) return Promise.reject(new ApiError('Sign in with Google again, then send the form.', 'AUTH'));
  return signinPost({ accessToken: at || 'demo', signup: form, ua: deviceUa() });
}

/**
 * Google sign-in, then the script's own session: { token, who, role, email, name, days }.
 * 2.0.1: the whole page goes to Google and comes back (no popup). The popup lost its way back on installed apps:
 * after choosing the account the phone showed the email app, and only a second try worked.
 */
export async function signIn(name = '') {
  if (fake) return signinPost({ accessToken: 'demo', name, ua: deviceUa() });
  const cfg = await post('authcfg');
  if (!cfg.clientId) throw new ApiError('Google sign-in is not set up on the server yet.', 'AUTH');
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  const state = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(OAUTH, JSON.stringify({ state, name, at: Date.now() })); } catch { /* checked on the way back */ }
  const q = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: backUrl(), response_type: 'token', scope: 'openid email profile', state, prompt: 'select_account', include_granted_scopes: 'true' });
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  return new Promise(() => {});   // the page is leaving
}

/** Back from Google: "#access_token=…&state=…" (or "#error=…"). null when this page load is not a return from Google. */
export function signInReturn() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.has('state') || !(h.has('access_token') || h.has('error'))) return null;
  history.replaceState(null, '', location.pathname + location.search);   // the token never stays in the address bar
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(OAUTH) || 'null'); localStorage.removeItem(OAUTH); } catch { /* no storage */ }
  if (!saved || saved.state !== h.get('state') || Date.now() - saved.at > 15 * 60e3) return Promise.reject(new ApiError('Google sign-in did not complete. Try again.', 'AUTH'));
  if (!h.get('access_token')) return Promise.reject(new ApiError('Google sign-in was closed. Try again.', 'AUTH'));
  return signinPost({ accessToken: h.get('access_token'), name: saved.name || '', ua: deviceUa() });
}
