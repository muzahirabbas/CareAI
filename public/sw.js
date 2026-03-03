self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();

      let title = "Care App Update";
      let body = "You have a new update.";

      if (data.status === 'taken') {
        title = "Medication Taken";
        body = `Patient has taken: ${data.medName}`;
      } else if (data.type === 'missed-medication') {
        title = data.title || "Missed Medication Alert";
        body = data.body || `${data.patientName} is ${data.minutesLate} minutes late taking ${data.medName}`;
      } else if (data.type === 'patient-reminder') {
        title = data.title || "Medication Reminder";
        body = data.body || `Reminder for: ${data.medName}`;
      } else if (data.title || data.body) {
        title = data.title || title;
        body = data.body || body;
      }

      const options = {
        body: body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        data: data.url || '/',
      };

      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      event.waitUntil(self.registration.showNotification("Medication Update", {
        body: event.data.text()
      }));
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = event.notification.data || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
