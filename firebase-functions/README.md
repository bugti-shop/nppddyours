# NPD Firebase Cloud Functions — FCM Push Notifications

## Setup

### Prerequisites
1. [Firebase CLI](https://firebase.google.com/docs/cli) installed: `npm install -g firebase-tools`
2. A Firebase project with **Cloud Messaging** and **Firestore** enabled

### Steps

```bash
# 1. Login to Firebase
firebase login

# 2. Initialize project (select your Firebase project)
firebase init functions firestore

# 3. Copy these files into the generated `functions/` folder
#    (or just use this folder as your functions directory)

# 4. Install dependencies
cd firebase-functions
npm install

# 5. Build
npm run build

# 6. Deploy
npm run deploy
# or: firebase deploy --only functions
```

### Firestore Collections (auto-created)

| Collection | Purpose |
|---|---|
| `devices` | Stores FCM tokens per user/device |
| `reminders` | Stores scheduled notifications |

### Android Setup
Create a notification channel `npd_reminders` in your Android app, or update the `channelId` in the functions.

---

## API Endpoints

All endpoints accept **POST** with JSON body.

### `registerToken`
Register or update a device token.
```json
{ "token": "fcm-token", "userId": "optional-user-id", "platform": "android|ios" }
```

### `removeToken`
Remove a device token.
```json
{ "token": "fcm-token" }
```

### `scheduleReminder`
Schedule a future notification.
```json
{
  "userId": "user123",
  "title": "Task Reminder",
  "body": "Don't forget: Buy groceries",
  "scheduledAt": "2025-07-15T09:00:00Z",
  "data": { "taskId": "abc123", "type": "task" },
  "repeatType": "daily"
}
```

### `cancelReminder`
Cancel by reminderId or by taskId/noteId.
```json
{ "taskId": "abc123" }
```

### `sendPush`
Send an immediate notification.
```json
{ "userId": "user123", "title": "Hello!", "body": "This is a test" }
```

### `sendBroadcast`
Send to all registered devices.
```json
{ "title": "App Update", "body": "New features available!" }
```

### `processReminders` (CRON)
Runs every minute automatically. Checks Firestore for due reminders and sends them via FCM.

---

## App Integration

In your Capacitor app, call `registerToken` when the FCM token is received:

```typescript
import { PushNotifications } from '@capacitor/push-notifications';

PushNotifications.addListener('registration', async (token) => {
  await fetch('https://<region>-<project>.cloudfunctions.net/registerToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: token.value,
      userId: 'current-user-id',
      platform: Capacitor.getPlatform(),
    }),
  });
});
```

When scheduling a task reminder:
```typescript
await fetch('https://<region>-<project>.cloudfunctions.net/scheduleReminder', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'current-user-id',
    title: 'Task Reminder',
    body: task.text,
    scheduledAt: task.reminderDate,
    data: { taskId: task.id, type: 'task' },
  }),
});
```
