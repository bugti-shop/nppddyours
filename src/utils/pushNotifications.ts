/**
 * Push Notification Manager
 * Uses Capacitor Local Notifications for on-device notifications.
 */

export class PushNotificationManager {
  private static instance: PushNotificationManager;

  private constructor() {}

  static getInstance(): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager();
    }
    return PushNotificationManager.instance;
  }

  async initialize(): Promise<void> {
    console.log('PushNotificationManager initialized (Local Notifications mode)');
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        if ('Notification' in window) {
          const perm = await Notification.requestPermission();
          return perm === 'granted';
        }
        return false;
      }
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.includes('not implemented') || msg.includes('not available')) return false;
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      }
      return false;
    }
  }

  async registerListeners(): Promise<void> {
    // No-op: handled by NotificationManager
  }

  async getDeliveredNotifications(): Promise<any[]> {
    return [];
  }

  async removeAllDeliveredNotifications(): Promise<void> {
    // No-op
  }
}

export const pushNotificationManager = PushNotificationManager.getInstance();
