import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

admin.initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// ============================================================
// 1. Register / update device token
// ============================================================
export const registerToken = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { token, userId, platform } = req.body;
  if (!token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const id = userId || token;
  await db.collection("devices").doc(id).set(
    {
      token,
      userId: userId || null,
      platform: platform || "unknown",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  res.json({ success: true });
});

// ============================================================
// 2. Remove device token
// ============================================================
export const removeToken = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { token, userId } = req.body;
  const id = userId || token;

  if (!id) {
    res.status(400).json({ error: "Token or userId is required" });
    return;
  }

  await db.collection("devices").doc(id).delete();
  res.json({ success: true });
});

// ============================================================
// 3. Schedule a reminder (task, note, habit, etc.)
// ============================================================
export const scheduleReminder = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const {
    userId,
    token,
    title,
    body,
    scheduledAt, // ISO 8601 string
    data,        // extra payload (taskId, noteId, type, etc.)
    repeatType,  // 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  } = req.body;

  if (!scheduledAt || !title) {
    res.status(400).json({ error: "scheduledAt and title are required" });
    return;
  }

  const reminder = {
    userId: userId || null,
    token: token || null,
    title,
    body: body || "",
    scheduledAt: new Date(scheduledAt),
    data: data || {},
    repeatType: repeatType || null,
    sent: false,
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection("reminders").add(reminder);
  res.json({ success: true, reminderId: ref.id });
});

// ============================================================
// 4. Cancel a reminder
// ============================================================
export const cancelReminder = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { reminderId, taskId, noteId, userId } = req.body;

  if (reminderId) {
    await db.collection("reminders").doc(reminderId).delete();
  } else if (taskId || noteId) {
    const field = taskId ? "data.taskId" : "data.noteId";
    const value = taskId || noteId;

    let query = db.collection("reminders")
      .where(field, "==", value)
      .where("sent", "==", false);

    if (userId) {
      query = query.where("userId", "==", userId);
    }

    const snapshot = await query.get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  res.json({ success: true });
});

// ============================================================
// 5. Send push to a specific token (immediate)
// ============================================================
export const sendPush = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { token, userId, title, body, data } = req.body;

  let targetToken = token;

  // Look up token by userId if not provided directly
  if (!targetToken && userId) {
    const deviceDoc = await db.collection("devices").doc(userId).get();
    if (deviceDoc.exists) {
      targetToken = deviceDoc.data()?.token;
    }
  }

  if (!targetToken) {
    res.status(400).json({ error: "No token found" });
    return;
  }

  try {
    const result = await messaging.send({
      token: targetToken,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "npd_reminders",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    });
    res.json({ success: true, messageId: result });
  } catch (error: any) {
    // Clean up invalid tokens
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      const id = userId || targetToken;
      await db.collection("devices").doc(id).delete();
    }
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 6. Send push to ALL registered devices (broadcast)
// ============================================================
export const sendBroadcast = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { title, body, data } = req.body;
  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const devicesSnapshot = await db.collection("devices").get();
  const tokens = devicesSnapshot.docs
    .map((doc) => doc.data().token)
    .filter(Boolean);

  if (tokens.length === 0) {
    res.json({ success: true, sent: 0 });
    return;
  }

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    data: data || {},
    android: {
      priority: "high",
      notification: { sound: "default", channelId: "npd_reminders" },
    },
    apns: {
      payload: { aps: { sound: "default", badge: 1 } },
    },
  };

  const result = await messaging.sendEachForMulticast(message);
  res.json({ success: true, sent: result.successCount, failed: result.failureCount });
});

// ============================================================
// 7. CRON: Process scheduled reminders every minute
// ============================================================
export const processReminders = onSchedule("* * * * *", async () => {
  const now = new Date();

  const snapshot = await db
    .collection("reminders")
    .where("sent", "==", false)
    .where("scheduledAt", "<=", now)
    .limit(100)
    .get();

  if (snapshot.empty) return;

  for (const doc of snapshot.docs) {
    const reminder = doc.data();
    let targetToken = reminder.token;

    // Look up token by userId
    if (!targetToken && reminder.userId) {
      const deviceDoc = await db.collection("devices").doc(reminder.userId).get();
      if (deviceDoc.exists) {
        targetToken = deviceDoc.data()?.token;
      }
    }

    if (!targetToken) {
      await doc.ref.update({ sent: true, error: "No token found" });
      continue;
    }

    try {
      await messaging.send({
        token: targetToken,
        notification: {
          title: reminder.title,
          body: reminder.body,
        },
        data: reminder.data || {},
        android: {
          priority: "high",
          notification: { sound: "default", channelId: "npd_reminders" },
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } },
        },
      });

      // Handle recurring reminders
      if (reminder.repeatType) {
        const nextDate = getNextOccurrence(
          reminder.scheduledAt.toDate(),
          reminder.repeatType
        );
        await doc.ref.update({
          scheduledAt: nextDate,
          sent: false,
        });
      } else {
        await doc.ref.update({ sent: true, sentAt: FieldValue.serverTimestamp() });
      }
    } catch (error: any) {
      await doc.ref.update({ sent: true, error: error.message });

      // Remove invalid tokens
      if (
        error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered"
      ) {
        const id = reminder.userId || targetToken;
        await db.collection("devices").doc(id).delete();
      }
    }
  }
});

// ============================================================
// Helper: calculate next occurrence for recurring reminders
// ============================================================
function getNextOccurrence(current: Date, repeatType: string): Date {
  const next = new Date(current);

  switch (repeatType) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
}
