self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'Push', {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        image: data.image,
        tag: data.tag,
        data: { ...data.data, url: self.registration.scope },
        actions: data.actions,
      }),
      new Promise((resolve) => {
        const ch = new BroadcastChannel('betternotify-push');
        ch.postMessage({ type: 'push-received', notification: data });
        ch.close();
        resolve();
      }),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const ch = new BroadcastChannel('betternotify-push');
      ch.postMessage({ type: 'notification-clicked', notification: event.notification.data });
      ch.close();

      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          client.focus();
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
