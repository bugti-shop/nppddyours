import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { performFullCalendarSync, isCalendarSyncEnabled, initializeCalendarSync } from '@/utils/systemCalendarSync';
import { loadTasksFromDB } from '@/utils/taskStorage';
import { getSetting } from '@/utils/settingsStorage';
import { CalendarEvent } from '@/types/note';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Automatically syncs app tasks/events with the device's native calendar.
 * Runs on app focus and periodically.
 */
export const useSystemCalendarSync = () => {
  const lastSyncRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Initialize permissions on mount
    initializeCalendarSync().catch((e) => {
      // Suppress "not implemented on android" errors silently
      if (String(e).includes('not implemented')) return;
      console.warn('Calendar sync init:', e);
    });

    const doSync = async () => {
      try {
        const enabled = await isCalendarSyncEnabled();
        if (!enabled) return;

        const now = Date.now();
        if (now - lastSyncRef.current < 60_000) return; // 1 min cooldown
        lastSyncRef.current = now;

        const tasks = await loadTasksFromDB();
        const events = await getSetting<CalendarEvent[]>('calendarEvents', []);
        const result = await performFullCalendarSync(tasks, events);
        if (result.pushed > 0 || result.pulled > 0) {
          console.log(`Calendar sync: pushed ${result.pushed}, pulled ${result.pulled}`);
        }
        if (result.errors.length > 0) {
          console.warn('Calendar sync errors:', result.errors);
        }
      } catch (e) {
        // Never let sync crash the app
        const msg = String(e);
        if (!msg.includes('not implemented') && !msg.includes('UNIMPLEMENTED')) {
          console.warn('Calendar sync failed:', e);
        }
      }
    };

    // Sync on visibility change (app foreground)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') doSync();
    };

    // Sync when tasks or events change
    const handleDataChange = () => {
      setTimeout(doSync, 3000); // 3s debounce
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('tasksUpdated', handleDataChange);
    window.addEventListener('calendarEventsUpdated', handleDataChange);

    // Initial sync
    doSync();

    // Periodic sync
    intervalRef.current = setInterval(doSync, SYNC_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('tasksUpdated', handleDataChange);
      window.removeEventListener('calendarEventsUpdated', handleDataChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
};
