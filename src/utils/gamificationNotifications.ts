// Gamification Notification Scheduler
// All notifications now delegated to FCM via your backend.
// Functions kept as no-ops to avoid breaking callers.

import { getSetting, setSetting } from './settingsStorage';

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

export const scheduleGamificationNotifications = async (): Promise<void> => {
  console.log('[FCM] Gamification notifications delegated to backend');
};

export const cancelGamificationNotifications = async (): Promise<void> => {
  console.log('[FCM] Cancel gamification notifications delegated to backend');
};

export const scheduleGracePeriodWarning = async (): Promise<void> => {
  console.log('[FCM] Grace period warning delegated to backend');
};

export const showAchievementNotification = async (achievementName: string, xpReward: number): Promise<void> => {
  console.log('[FCM] Achievement notification delegated to backend:', achievementName);
};

export const showLevelUpNotification = async (newLevel: number, title: string): Promise<void> => {
  console.log('[FCM] Level up notification delegated to backend:', newLevel, title);
};

export const initializeGamificationNotifications = async (): Promise<void> => {
  console.log('[FCM] Gamification notifications initialized (FCM mode)');
};
