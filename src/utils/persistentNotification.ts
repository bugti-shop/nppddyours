import { Capacitor } from '@capacitor/core';
import { getSetting, setSetting } from './settingsStorage';
import { NoteType } from '@/types/note';

// Storage keys
const STORAGE_KEYS = {
  ENABLED: 'persistent_notification_enabled',
};

/**
 * PersistentNotificationManager - FCM only (local notifications removed)
 * Persistent notification functionality now relies on FCM via your backend.
 * Methods are kept to avoid breaking callers.
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
    console.log('[PersistentNotification] FCM mode - persistent notification handled by backend');
  }

  async isEnabled(): Promise<boolean> {
    return await getSetting<boolean>(STORAGE_KEYS.ENABLED, false);
  }

  async enable(): Promise<void> {
    await setSetting(STORAGE_KEYS.ENABLED, true);
    console.log('[PersistentNotification] Enabled (FCM mode)');
  }

  async disable(): Promise<void> {
    await setSetting(STORAGE_KEYS.ENABLED, false);
    console.log('[PersistentNotification] Disabled (FCM mode)');
  }

  async refresh(): Promise<void> {
    console.log('[PersistentNotification] Refresh (FCM mode)');
  }

  handleAction(actionId: string): void {
    window.dispatchEvent(new CustomEvent('persistentNotificationAction', {
      detail: { actionId }
    }));
  }
}

export const persistentNotificationManager = PersistentNotificationService.getInstance();
