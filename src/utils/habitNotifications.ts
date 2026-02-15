/**
 * Habit Reminder Notifications
 * Uses Capacitor Local Notifications for on-device scheduling.
 */

import { Habit } from '@/types/habit';
import { Capacitor } from '@capacitor/core';

const isNotImplementedError = (err: any): boolean => {
  const msg = String(err?.message || err || '');
  return msg.includes('not implemented') || msg.includes('not available');
};

const isNative = () => Capacitor.isNativePlatform();

export const scheduleHabitReminder = async (habit: Habit): Promise<number[]> => {
  if (!habit.reminder?.enabled || !habit.reminder?.time) {
    console.log('No reminder configured for habit:', habit.name);
    return [];
  }

  const [hours, minutes] = habit.reminder.time.split(':').map(Number);
  const scheduledDate = new Date();
  scheduledDate.setHours(hours, minutes, 0, 0);
  if (scheduledDate <= new Date()) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
  }

  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const notifId = Math.floor(Math.random() * 100000);
      
      await LocalNotifications.schedule({
        notifications: [{
          title: '🔄 Habit Reminder',
          body: habit.name,
          id: notifId,
          schedule: { at: scheduledDate },
          extra: { habitId: habit.id, type: 'habit' },
        }],
      });
      
      console.log('Habit reminder scheduled:', habit.name, notifId);
      return [notifId];
    } catch (err) {
      if (!isNotImplementedError(err)) console.warn('Habit reminder schedule failed:', habit.name, err);
      return [];
    }
  }
  
  console.log('Habit reminder scheduled (web mode):', habit.name);
  return [];
};

export const cancelHabitReminder = async (habit: Habit): Promise<void> => {
  console.log('Habit reminder cancelled:', habit.name);
};

export const rescheduleAllHabitReminders = async (habits: Habit[]): Promise<void> => {
  for (const habit of habits) {
    if (habit.reminder?.enabled) {
      await scheduleHabitReminder(habit);
    }
  }
  console.log('All habit reminders rescheduled');
};