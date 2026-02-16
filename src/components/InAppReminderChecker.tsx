import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { loadTasksFromDB } from '@/utils/taskStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { Note } from '@/types/note';
import { Capacitor } from '@capacitor/core';

const CHECK_INTERVAL = 10_000; // Check every 10 seconds
const FIRED_KEY = 'firedReminderIds';

/**
 * Polls tasks & notes every 10s and fires an in-app toast + sound
 * when a reminder time is reached. Works reliably on web & native.
 */
export const InAppReminderChecker = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    // On native platforms, system LocalNotifications handle push notifications
    // This in-app poller is only needed for web where system notifications aren't reliable
    if (Capacitor.isNativePlatform()) {
      console.log('[InAppReminderChecker] Skipped — native platform uses system push notifications');
      return;
    }

    const checkReminders = async () => {
      try {
        const now = Date.now();
        const fired = await getSetting<string[]>(FIRED_KEY, []);
        const newFired = [...fired];
        let changed = false;

        // Check task reminders
        const tasks = await loadTasksFromDB();
        for (const task of tasks) {
          if (task.completed) continue;
          const reminderTime = task.reminderTime || task.dueDate;
          if (!reminderTime) continue;

          const rTime = new Date(reminderTime).getTime();
          const key = `task-${task.id}-${rTime}`;

          // Fire if reminder is due (within last 60s window) and not already fired
          if (rTime <= now && rTime > now - 60_000 && !fired.includes(key)) {
            fireReminder('⏰ Task Reminder', task.text, task.priority);
            newFired.push(key);
            changed = true;
          }
        }

        // Check note reminders
        try {
          const notes = await getSetting<Note[]>('notes', []);
          for (const note of notes) {
            if (!note.reminderTime) continue;
            const rTime = new Date(note.reminderTime).getTime();
            const key = `note-${note.id}-${rTime}`;

            if (rTime <= now && rTime > now - 60_000 && !fired.includes(key)) {
              fireReminder('📝 Note Reminder', note.title);
              newFired.push(key);
              changed = true;
            }
          }
        } catch { }

        // Save fired IDs (keep last 200 to prevent unbounded growth)
        if (changed) {
          await setSetting(FIRED_KEY, newFired.slice(-200));
        }

        // Cleanup old entries every hour (entries older than 24h)
        if (newFired.length > 100) {
          const cleaned = newFired.slice(-100);
          await setSetting(FIRED_KEY, cleaned);
        }
      } catch (e) {
        console.warn('Reminder check error:', e);
      }
    };

    const fireReminder = (title: string, body: string, priority?: string) => {
      // Play alert sound
      try {
        const audio = new Audio('/notification-sound.mp3');
        audio.volume = 0.7;
        audio.play().catch(() => { });
      } catch { }

      // Vibrate if supported
      try {
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }
      } catch { }

      // Show persistent toast
      toast(title, {
        description: body,
        duration: 15000, // Show for 15 seconds
        dismissible: false,
        style: {
          background: priority === 'high' ? 'hsl(0 84% 60%)' :
            priority === 'medium' ? 'hsl(38 92% 50%)' :
              'hsl(var(--primary))',
          color: 'white',
          border: 'none',
          fontSize: '15px',
          fontWeight: 600,
        },
      });

      // Also try browser notification
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/nota-logo.png' });
        }
      } catch { }
    };

    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { });
    }

    // Initial check
    checkReminders();

    // Poll every 10 seconds
    intervalRef.current = setInterval(checkReminders, CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
};
