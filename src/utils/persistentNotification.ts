import { Capacitor } from '@capacitor/core';
import { getSetting, setSetting } from './settingsStorage';

const STORAGE_KEYS = {
  ENABLED: 'persistent_notification_enabled',
};

const PERSISTENT_NOTIF_ID = 99999;
const QUICK_ADD_CHANNEL_ID = 'npd_quick_add';
const QUICK_ADD_ACTION_TYPE_ID = 'QUICK_ADD_ACTION_TYPE';

let channelCreated = false;
let actionTypeRegistered = false;

const getLocalNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    return LocalNotifications;
  } catch {
    return null;
  }
};

const ensureQuickAddChannel = async (LN: any) => {
  if (channelCreated) return;
  try {
    await LN.createChannel({
      id: QUICK_ADD_CHANNEL_ID,
      name: 'Quick Add',
      description: 'Persistent notification for quick note/task creation',
      importance: 2, // LOW importance so it stays but doesn't make sound
      visibility: 1,
      lights: false,
      vibration: false,
    });
    channelCreated = true;
  } catch (err) {
    console.warn('[PersistentNotification] Channel creation failed:', err);
    channelCreated = true;
  }
};

const ensureQuickAddActionType = async (LN: any) => {
  if (actionTypeRegistered) return;
  try {
    await LN.registerActionTypes({
      types: [
        {
          id: QUICK_ADD_ACTION_TYPE_ID,
          actions: [
            { id: 'add_note_regular', title: '📝 Add Note', destructive: false, foreground: true },
            { id: 'add_task', title: '✅ Add Task', destructive: false, foreground: true },
          ],
        },
      ],
    });
    actionTypeRegistered = true;
  } catch (err) {
    console.warn('[PersistentNotification] Action type registration failed:', err);
    actionTypeRegistered = true;
  }
};

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
  private listenerRegistered = false;

  private constructor() {}

  static getInstance(): PersistentNotificationService {
    if (!PersistentNotificationService.instance) {
      PersistentNotificationService.instance = new PersistentNotificationService();
    }
    return PersistentNotificationService.instance;
  }

  async initialize(): Promise<void> {
    const LN = await getLocalNotifications();
    if (!LN) {
      console.log('[PersistentNotification] Not on native platform, skipping');
      return;
    }

    // Register listener for quick-add action buttons
    if (!this.listenerRegistered) {
      await LN.addListener('localNotificationActionPerformed', (action) => {
        const notifId = action.notification.id;
        // Only handle our persistent notification actions
        if (notifId === PERSISTENT_NOTIF_ID) {
          const actionId = action.actionId;
          console.log('[PersistentNotification] Action tapped:', actionId);

          if (actionId === 'add_note_regular' || actionId === 'add_task') {
            // Store action so app can process it on launch/resume
            sessionStorage.setItem('pendingNotificationAction', actionId);
            this.handleAction(actionId);
          }

          // Re-show the persistent notification (it may dismiss after action on some devices)
          this.showPersistentNotification(LN);
        }
      });
      this.listenerRegistered = true;
    }

    // If enabled, show it
    const enabled = await this.isEnabled();
    if (enabled) {
      await this.showPersistentNotification(LN);
    }

    console.log('[PersistentNotification] Initialized, enabled:', enabled);
  }

  async isEnabled(): Promise<boolean> {
    return await getSetting<boolean>(STORAGE_KEYS.ENABLED, false);
  }

  async enable(): Promise<void> {
    await setSetting(STORAGE_KEYS.ENABLED, true);
    const LN = await getLocalNotifications();
    if (LN) {
      await this.showPersistentNotification(LN);
    }
    console.log('[PersistentNotification] Enabled & notification shown');
  }

  async disable(): Promise<void> {
    await setSetting(STORAGE_KEYS.ENABLED, false);
    const LN = await getLocalNotifications();
    if (LN) {
      try {
        await LN.cancel({ notifications: [{ id: PERSISTENT_NOTIF_ID }] });
      } catch {}
    }
    console.log('[PersistentNotification] Disabled & notification removed');
  }

  async refresh(): Promise<void> {
    const enabled = await this.isEnabled();
    if (enabled) {
      const LN = await getLocalNotifications();
      if (LN) {
        await this.showPersistentNotification(LN);
      }
    }
  }

  handleAction(actionId: string): void {
    window.dispatchEvent(new CustomEvent('persistentNotificationAction', {
      detail: { actionId }
    }));
  }

  private async showPersistentNotification(LN: any): Promise<void> {
    try {
      // Check permissions first
      const perm = await LN.checkPermissions();
      if (perm.display !== 'granted') {
        const req = await LN.requestPermissions();
        if (req.display !== 'granted') {
          console.warn('[PersistentNotification] Permission denied');
          return;
        }
      }

      await ensureQuickAddChannel(LN);
      await ensureQuickAddActionType(LN);

      // Cancel existing persistent notification first
      try {
        await LN.cancel({ notifications: [{ id: PERSISTENT_NOTIF_ID }] });
      } catch {}

      // Schedule an immediate "persistent" notification with action buttons
      // We use ongoing: true to make it non-dismissible (Android)
      await LN.schedule({
        notifications: [
          {
            id: PERSISTENT_NOTIF_ID,
            title: '📋 Quick Add',
            body: 'Tap to add a note or task quickly',
            channelId: QUICK_ADD_CHANNEL_ID,
            actionTypeId: QUICK_ADD_ACTION_TYPE_ID,
            ongoing: true,
            autoCancel: false,
            schedule: {
              at: new Date(Date.now() + 1000),
              allowWhileIdle: true,
            },
            extra: { type: 'quick_add', persistent: 'true' },
          },
        ],
      });

      console.log('[PersistentNotification] ✅ Persistent notification shown');
    } catch (err) {
      console.error('[PersistentNotification] ❌ Failed to show:', err);
    }
  }
}

export const persistentNotificationManager = PersistentNotificationService.getInstance();
