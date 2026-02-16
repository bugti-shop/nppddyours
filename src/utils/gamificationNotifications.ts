// Gamification Notification Scheduler
// Uses Capacitor Local Notifications for on-device scheduling.

import { getSetting, setSetting } from './settingsStorage';
import { Capacitor } from '@capacitor/core';

export interface GamificationNotificationSettings {
  streakReminders: boolean;
  challengeReminders: boolean;
  gracePeriodAlerts: boolean;
  reminderTime: string; // HH:mm format, default "20:00"
}

const DEFAULT_SETTINGS: GamificationNotificationSettings = {
  streakReminders: true,
  challengeReminders: true,
  gracePeriodAlerts: true,
  reminderTime: '20:00',
};

export const loadGamificationNotificationSettings = async (): Promise<GamificationNotificationSettings> => {
  return getSetting<GamificationNotificationSettings>('gamificationNotifications', DEFAULT_SETTINGS);
};

export const saveGamificationNotificationSettings = async (settings: GamificationNotificationSettings): Promise<void> => {
  await setSetting('gamificationNotifications', settings);
};

const getLocalNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    return LocalNotifications;
  } catch {
    return null;
  }
};

export const scheduleGamificationNotifications = async (): Promise<void> => {
  const settings = await loadGamificationNotificationSettings();
  if (!settings.streakReminders && !settings.challengeReminders) return;

  const LN = await getLocalNotifications();
  if (!LN) {
    console.log('[Notifications] Gamification notifications skipped (web mode)');
    return;
  }

  const [hours, minutes] = settings.reminderTime.split(':').map(Number);
  const scheduledDate = new Date();
  scheduledDate.setHours(hours, minutes, 0, 0);
  if (scheduledDate <= new Date()) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
  }

  try {
    await LN.schedule({
      notifications: [{
        title: '🔥 Don\'t break your streak!',
        body: 'Complete your daily tasks to keep your streak going.',
        id: 90001,
        schedule: { at: scheduledDate },
        extra: { type: 'gamification', subtype: 'streak' },
      }],
    });
    console.log('[Notifications] Gamification reminder scheduled');
  } catch (err) {
    console.warn('[Notifications] Failed to schedule gamification notification:', err);
  }
};

export const cancelGamificationNotifications = async (): Promise<void> => {
  const LN = await getLocalNotifications();
  if (LN) {
    try {
      await LN.cancel({ notifications: [{ id: 90001 }] });
    } catch {}
  }
  console.log('[Notifications] Gamification notifications cancelled');
};

export const scheduleGracePeriodWarning = async (): Promise<void> => {
  const LN = await getLocalNotifications();
  if (!LN) return;

  try {
    await LN.schedule({
      notifications: [{
        title: '⚠️ Streak Grace Period',
        body: 'Your streak will expire soon! Complete a task now.',
        id: 90002,
        schedule: { at: new Date(Date.now() + 1000) },
        extra: { type: 'gamification', subtype: 'grace_period' },
      }],
    });
  } catch (err) {
    console.warn('[Notifications] Failed to schedule grace period warning:', err);
  }
};

export const showAchievementNotification = async (achievementName: string, xpReward: number): Promise<void> => {
  const LN = await getLocalNotifications();
  if (!LN) return;

  try {
    await LN.schedule({
      notifications: [{
        title: '🏆 Achievement Unlocked!',
        body: `${achievementName} (+${xpReward} XP)`,
        id: Math.floor(Math.random() * 100000),
        schedule: { at: new Date(Date.now() + 500) },
        extra: { type: 'gamification', subtype: 'achievement' },
      }],
    });
  } catch (err) {
    console.warn('[Notifications] Failed to show achievement notification:', err);
  }
};

export const showLevelUpNotification = async (newLevel: number, title: string): Promise<void> => {
  const LN = await getLocalNotifications();
  if (!LN) return;

  try {
    await LN.schedule({
      notifications: [{
        title: '🎉 Level Up!',
        body: `You reached Level ${newLevel}: ${title}`,
        id: Math.floor(Math.random() * 100000),
        schedule: { at: new Date(Date.now() + 500) },
        extra: { type: 'gamification', subtype: 'level_up' },
      }],
    });
  } catch (err) {
    console.warn('[Notifications] Failed to show level up notification:', err);
  }
};

export const initializeGamificationNotifications = async (): Promise<void> => {
  console.log('[Notifications] Gamification notifications initialized (Local Notifications mode)');
};
