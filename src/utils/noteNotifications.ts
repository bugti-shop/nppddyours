import { Note } from '@/types/note';
import { Capacitor } from '@capacitor/core';

const isNative = () => Capacitor.isNativePlatform();

const isNotImplementedError = (err: any): boolean => {
  const msg = String(err?.message || err || '');
  return msg.includes('not implemented') || msg.includes('not available');
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (err) {
      if (!isNotImplementedError(err)) console.warn('requestPermissions failed:', err);
    }
  }
  
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

export const scheduleNoteReminder = async (note: Note): Promise<number | number[] | null> => {
  if (!note.reminderTime) return null;

  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const notifId = Math.floor(Math.random() * 100000);
      
      await LocalNotifications.schedule({
        notifications: [{
          title: '📝 Note Reminder',
          body: note.title,
          id: notifId,
          schedule: { at: new Date(note.reminderTime) },
          extra: { noteId: note.id, type: 'note' },
        }],
      });
      
      console.log('Note reminder scheduled:', note.title, notifId);
      return notifId;
    } catch (err) {
      if (!isNotImplementedError(err)) console.warn('scheduleNoteReminder failed:', err);
    }
  }
  
  console.log('Note reminder scheduled (web mode):', note.title);
  return null;
};

export const cancelNoteReminder = async (notificationId: number | number[]): Promise<void> => {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const ids = Array.isArray(notificationId) ? notificationId : [notificationId];
      await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
    } catch (err) {
      if (!isNotImplementedError(err)) console.warn('cancelNoteReminder failed:', err);
    }
  }
};

export const updateNoteReminder = async (note: Note): Promise<number | number[] | null> => {
  if (note.notificationId) {
    await cancelNoteReminder(note.notificationId);
  }
  if (note.notificationIds) {
    await cancelNoteReminder(note.notificationIds as any);
  }
  return scheduleNoteReminder(note);
};

export const getAllUpcomingReminders = async (): Promise<Array<{
  id: number;
  noteId: string;
  title: string;
  body: string;
  schedule: Date;
  recurring?: string;
}>> => {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const pending = await LocalNotifications.getPending();
      return pending.notifications
        .filter(n => n.extra?.type === 'note')
        .map(n => ({
          id: n.id,
          noteId: n.extra?.noteId || '',
          title: n.title || '',
          body: n.body || '',
          schedule: n.schedule?.at ? new Date(n.schedule.at) : new Date(),
          recurring: n.extra?.recurring,
        }));
    } catch (err) {
      if (!isNotImplementedError(err)) console.warn('getAllUpcomingReminders failed:', err);
    }
  }
  return [];
};

export const initializeNotificationListener = () => {
  console.log('Notification listener initialized (Local Notifications mode)');
};
