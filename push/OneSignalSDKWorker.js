// 2.80.0 (owner, 9 Nov): Remind later on a new report's notification works in the background: the app does not open,
// no message; the script sends the same notification again in 30 minutes. Registered before OneSignal's own handler,
// which is then not called for this button. Anything else (Open, the notification itself) goes to OneSignal as before.
// 2.91.0 (owner, 12 Nov: "tapping Remind me later must not open FR"): this button never opens the app. Before, two paths
// opened it: (1) no saved sign-in copy on the device (kit.json, made when the app is opened while signed in) opened the
// app to set the reminder there (2.90.1), and (2) a notification without the report's link was left to OneSignal, which
// opens the app. Now: no link, nothing to do; no sign-in copy or no connection, the notification comes back with a line
// saying the reminder is not set, so the report is not lost. Tapping the notification itself or Open is unchanged.
const LATER_RE = /#go=later\/(\d{4}-\d{2}-\d{2})\/([A-Z0-9]+)\/(\d+)/;
function showAgain(n, why) {
  const body = 'Reminder not set (' + why + '). ' + String(n.body || '').replace(/^Reminder not set \([^)]*\)\. /, '');
  return self.registration.showNotification(n.title || 'Field Report', { body: body, icon: n.icon, badge: n.badge, tag: n.tag, data: n.data, actions: n.actions, renotify: false, silent: true });
}
self.addEventListener('notificationclick', e => {
  if (e.action !== 'later') return;
  e.stopImmediatePropagation();   // OneSignal's own handler would open the app
  const n = e.notification;
  n.close();
  const m = LATER_RE.exec(JSON.stringify(n.data || {}));
  if (!m) return;
  e.waitUntil(caches.open('fr2-kit').then(c => c.match('kit.json')).then(r => (r ? r.json() : null)).then(k => {
    if (!k || !k.token) return showAgain(n, 'open Field Report once on this device');
    return fetch(k.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
      body: JSON.stringify({ action: 'remindLater', date: m[1], proj: m[2], no: m[3], token: k.token, dev: k.dev, mode: k.mode, app: k.app }) })
      .then(res => res.json()).then(j => (j && j.ok ? null : showAgain(n, 'sign in again in Field Report')));
  }).catch(() => showAgain(n, 'no connection')));
});
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
