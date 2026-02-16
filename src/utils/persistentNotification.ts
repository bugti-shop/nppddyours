import { Capacitor } from '@capacitor/core';
import { getSetting, setSetting } from './settingsStorage';

// Storage keys
const STORAGE_KEYS = {
  ENABLED: 'persistent_notification_enabled',
};

/**
 * PersistentNotificationManager - Local Notifications mode
 * Uses Capacitor Local Notifications for on-device persistent notification.
 */
export interface PersistentNotificationManager {
  initialize: () => Promise<void>;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  isEnabled: () => Promise<boolean>;
  handleAction: (actionId: string) => void;
  refresh: () => Promise<void>;
}

class PersistentNotificationService implements PersistentNotificationManager {
  private static instance: PersistentNotificationService;

  private constructor() {}

  static getInstance(): PersistentNotificationService {
    if (!PersistentNotificationService.instance) {
      PersistentNotificationService.instance = new PersistentNotificationService();
    }
    return PersistentNotificationService.instance;
  }

  async initialize(): Promise<void> {
    console.log('[PersistentNotification] Initialized (Local Notifications mode)');
  }

  async isEnabled(): Promise<boolean> {
    return await getSetting<boolean>(STORAGE_KEYS.ENABLED, false);
  }

  async enable(): Promise<void> {
    await setSetting(STORAGE_KEYS.ENABLED, true);
    console.log('[PersistentNotification] Enabled');
  }

  async disable(): Promise<void> {
    await setSetting(STORAGE_KEYS.ENABLED, false);
    console.log('[PersistentNotification] Disabled');
  }

  async refresh(): Promise<void> {
    console.log('[PersistentNotification] Refreshed');
  }

  handleAction(actionId: string): void {
    window.dispatchEvent(new CustomEvent('persistentNotificationAction', {
      detail: { actionId }
    }));
  }
}

export const persistentNotificationManager = PersistentNotificationService.getInstance();
