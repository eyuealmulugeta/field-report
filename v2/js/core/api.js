// The Apps Script the old app uses. Same actions, no script change for 2.0.
// Requests are JSON sent as text/plain, so the browser does not ask the script for permission first.

export const SCRIPT = 'https://script.google.com/macros/s/AKfycbw60G2k1_o25WQtvwUnoQ0JRecC0ty_KPHqK82QVDglGeXIKRhoGsi1Pvi12SBJRWNL/exec';
export const APP_VERSION = '2.0.0-trial.1';

export class ApiError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

let fake = null;
/** Demo mode replaces the server with a function (action, body) => reply. */
export const useFake = fn => { fake = fn; };
export const isDemo = () => !!fake;

export async function post(action, body = {}, token = '') {
  const payload = { action, ...body, ...(token ? { token } : {}), app: APP_VERSION };
  if (fake) {
    const r = await fake(action, payload);
    if (!r.ok) throw new ApiError(r.error || 'Failed', r.code);
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
  if (!r.ok) throw new ApiError(r.error || r.message || 'Failed', r.code);
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

/** Google sign-in, then the script's own session: { token, who, role, email, name, days }. */
export async function signIn() {
  if (fake) return post('signin', { accessToken: 'demo' });
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
  return post('signin', { accessToken });
}
