// 2.80.0 (owner, 9 Nov): Remind later on a new report's notification works in the background: the app does not open,
// no message; the script sends the same notification again in 30 minutes. Registered before OneSignal's own handler,
// which is then not called for this button. Anything else (Open, the notification itself) goes to OneSignal as before.
self.addEventListener('notificationclick', e => {
  if (e.action !== 'later') return;
  const m = /#go=later\/(\d{4}-\d{2}-\d{2})\/([A-Z0-9]+)\/(\d+)/.exec(JSON.stringify(e.notification.data || {}));
  if (!m) return;   // the link is not there: OneSignal opens the app, which sets the reminder quietly
  e.stopImmediatePropagation();
  e.notification.close();
  e.waitUntil(caches.open('fr2-kit').then(c => c.match('kit.json')).then(r => (r ? r.json() : null)).then(k => {
    if (!k || !k.token) return self.clients.openWindow('./#go=later/' + m[1] + '/' + m[2] + '/' + m[3]);
    return fetch(k.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
      body: JSON.stringify({ action: 'remindLater', date: m[1], proj: m[2], no: m[3], token: k.token, dev: k.dev, mode: k.mode, app: k.app }) });
  }).catch(() => {}));
});
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
