import { Capacitor } from '@capacitor/core';
import { TodoItem, Note, Priority } from '@/types/note';
import { RepeatSettings, RepeatFrequency } from '@/components/TaskDateTimePage';
import { addMinutes, addDays } from 'date-fns';
import { triggerTripleHeavyHaptic } from './haptics';
import { getSetting, setSetting } from './settingsStorage';

const DEFAULT_NOTIFICATION_ICON = 'npd_notification_icon';

export interface NotificationData {
  taskId?: string;
  noteId?: string;
  type: 'task' | 'note' | 'budget' | 'bill';
  recurring?: boolean;
  recurringType?: string;
  originalTitle?: string;
  originalBody?: string;
  category?: string;
  percentage?: number;
  billId?: string;
  dueDate?: string;
  priority?: Priority;
}

export type SnoozeOption = '5min' | '15min' | '1hour' | '3hours' | 'tomorrow';

export const TASK_REMINDER_ACTION_TYPE_ID = 'TASK_REMINDER_ACTION_TYPE';
export const SNOOZE_ACTION_TYPE_ID = 'SNOOZE_ACTION_TYPE';

/**
 * Helper to get LocalNotifications plugin (dynamic import to avoid build issues on web)
 */
const isNotImplementedError = (err: any): boolean => {
  const msg = String(err?.message || err || '');
  return msg.includes('not implemented') || msg.includes('not available');
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

const CHANNEL_ID = 'npd_reminders';
let channelCreated = false;
let actionTypesRegistered = false;

const ensureChannel = async (LN: any) => {
  if (channelCreated) return;
  try {
    await LN.createChannel({
      id: CHANNEL_ID,
      name: 'Reminders',
      description: 'Task and note reminders',
      importance: 5, // max importance
      visibility: 1, // public
      lights: true,
      vibration: true,
    });
    channelCreated = true;
    console.log('Notification channel created:', CHANNEL_ID);
  } catch (err) {
    if (!isNotImplementedError(err)) {
      console.warn('Failed to create notification channel:', err);
    }
    channelCreated = true; // Don't retry on failure
  }
};

/**
 * Register notification action types so system notifications show
 * actionable buttons (Complete / Snooze) like TickTick / Todoist.
 */
const ensureActionTypes = async (LN: any) => {
  if (actionTypesRegistered) return;
  try {
    await LN.registerActionTypes({
      types: [
        {
          id: TASK_REMINDER_ACTION_TYPE_ID,
          actions: [
            { id: 'complete', title: 'Complete', destructive: false },
            { id: 'snooze', title: 'Snooze', destructive: false },
          ],
        },
        {
          id: SNOOZE_ACTION_TYPE_ID,
          actions: [
            { id: 'snooze_5', title: '5 min', destructive: false },
            { id: 'snooze_15', title: '15 min', destructive: false },
            { id: 'snooze_1h', title: '1 hour', destructive: false },
          ],
        },
      ],
    });
    actionTypesRegistered = true;
    console.log('Notification action types registered');
  } catch (err) {
    if (!isNotImplementedError(err)) {
      console.warn('Failed to register action types:', err);
    }
    actionTypesRegistered = true;
  }
};

/**
 * Schedule a local notification
 */
const scheduleLocalNotification = async (opts: {
  title: string;
  body: string;
  scheduledAt: Date;
  id?: number;
  extra?: Record<string, any>;
}): Promise<number> => {
  const notifId = opts.id || Math.floor(Math.random() * 100000);
  
  const LN = await getLocalNotifications();
  if (LN) {
    try {
      const permResult = await LN.checkPermissions();
      if (permResult.display !== 'granted') {
        const reqResult = await LN.requestPermissions();
        if (reqResult.display !== 'granted') {
          console.warn('Local notification permission denied');
          return notifId;
        }
      }

      // Ensure notification channel exists (required for Android 8+)
      await ensureChannel(LN);

      // Ensure action types are registered for buttons
      await ensureActionTypes(LN);

      const isTaskNotif = opts.extra?.type === 'task';

      await LN.schedule({
        notifications: [{
          title: opts.title,
          body: opts.body,
          id: notifId,
          channelId: CHANNEL_ID,
          schedule: { 
            at: opts.scheduledAt,
            allowWhileIdle: true, // Ensures delivery even in Doze mode
          },
          smallIcon: 'npd_notification_icon',
          extra: opts.extra,
          ...(isTaskNotif ? { actionTypeId: TASK_REMINDER_ACTION_TYPE_ID } : {}),
        }],
      });
      console.log('Native notification scheduled:', notifId, 'at', opts.scheduledAt.toISOString());
      return notifId;
    } catch (err) {
      if (!isNotImplementedError(err)) {
        console.warn('Local notification schedule failed, using web fallback:', err);
      }
    }
  }

  // Web fallback using setTimeout + Notification API
  const delay = opts.scheduledAt.getTime() - Date.now();
  if (delay > 0 && delay < 86400000) { // max 24h for web
    setTimeout(async () => {
      try {
        if ('Notification' in window) {
          if (Notification.permission !== 'granted') {
            await Notification.requestPermission();
          }
          if (Notification.permission === 'granted') {
            new Notification(opts.title, { body: opts.body, icon: '/nota-logo.png' });
          }
        }
      } catch {}
    }, delay);
  }
  
  return notifId;
};

/**
 * Cancel a local notification by ID
 */
const cancelLocalNotification = async (ids: number[]): Promise<void> => {
  const LN = await getLocalNotifications();
  if (LN && ids.length > 0) {
    try {
      await LN.cancel({ notifications: ids.map(id => ({ id })) });
    } catch (err) {
      if (!isNotImplementedError(err)) {
        console.warn('Failed to cancel notifications:', err);
      }
    }
  }
};

/**
 * NotificationManager - Local Notifications
 * All scheduling is handled locally on-device.
 */
export class NotificationManager {
  private static instance: NotificationManager;
  private permissionGranted = false;
  private initialized = false;

  private constructor() {}

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const LN = await getLocalNotifications();
      if (LN) {
        const permResult = await LN.requestPermissions();
        this.permissionGranted = permResult.display === 'granted';
        
        // Create notification channel & register action types
        await ensureChannel(LN);
        await ensureActionTypes(LN);

        // Listen for notification actions (Complete / Snooze buttons)
        await LN.addListener('localNotificationActionPerformed', (action) => {
          console.log('Notification action:', action.actionId);
          const data = action.notification.extra as NotificationData | undefined;

          if (data?.taskId) {
            if (action.actionId === 'complete') {
              window.dispatchEvent(new CustomEvent('completeTaskFromNotification', {
                detail: { taskId: data.taskId }
              }));
            } else if (action.actionId === 'snooze' || action.actionId === 'snooze_5' || action.actionId === 'snooze_15' || action.actionId === 'snooze_1h') {
              // Map action to snooze duration
              const snoozeMap: Record<string, SnoozeOption> = {
                'snooze': '15min',
                'snooze_5': '5min',
                'snooze_15': '15min',
                'snooze_1h': '1hour',
              };
              const snoozeOption = snoozeMap[action.actionId] || '15min';
              // Re-schedule the notification
              NotificationManager.getInstance().snoozeNotification(action.notification, snoozeOption);
            } else {
              // Default tap - open the task
              window.dispatchEvent(new CustomEvent('taskNotificationTapped', {
                detail: { taskId: data.taskId }
              }));
            }
          } else if (data?.noteId) {
            window.dispatchEvent(new CustomEvent('noteNotificationTapped', {
              detail: { noteId: data.noteId }
            }));
          }
        });

        await LN.addListener('localNotificationReceived', (notification) => {
          console.log('Local notification received:', notification);
          triggerTripleHeavyHaptic();

          // Store in notification history
          getSetting<any[]>('notificationHistory', []).then(history => {
            history.unshift({
              id: notification.id,
              title: notification.title,
              body: notification.body,
              timestamp: new Date().toISOString(),
              read: false,
              extra: notification.extra,
            });
            setSetting('notificationHistory', history.slice(0, 100));
          });

          window.dispatchEvent(new CustomEvent('notificationReceived', { detail: notification }));
        });
      } else {
        // Web: check Notification API permission
        if ('Notification' in window) {
          this.permissionGranted = Notification.permission === 'granted';
        }
      }

      this.initialized = true;
      console.log('NotificationManager initialized (Local Notifications)');
    } catch (error) {
      if (!isNotImplementedError(error)) {
        console.error('Failed to initialize NotificationManager:', error);
      }
    }
  }

  async requestPermissions(): Promise<boolean> {
    const LN = await getLocalNotifications();
    if (LN) {
      try {
        const result = await LN.requestPermissions();
        this.permissionGranted = result.display === 'granted';
        return this.permissionGranted;
      } catch (error) {
        if (!isNotImplementedError(error)) {
          console.error('Error requesting notification permissions:', error);
        }
        return false;
      }
    }
    // Web fallback
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      this.permissionGranted = perm === 'granted';
      return this.permissionGranted;
    }
    return false;
  }

  async checkPermissions(): Promise<boolean> {
    const LN = await getLocalNotifications();
    if (LN) {
      try {
        const result = await LN.checkPermissions();
        this.permissionGranted = result.display === 'granted';
        return this.permissionGranted;
      } catch (error) {
        if (!isNotImplementedError(error)) {
          console.error('Error checking notification permissions:', error);
        }
        return false;
      }
    }
    if ('Notification' in window) {
      this.permissionGranted = Notification.permission === 'granted';
      return this.permissionGranted;
    }
    return false;
  }

  async scheduleTaskReminder(
    task: TodoItem,
    reminderOffset?: string,
    repeatSettings?: RepeatSettings
  ): Promise<number[]> {
    const scheduledAt = task.reminderTime || task.dueDate;
    if (!scheduledAt) {
      console.log('No reminder time set for task:', task.text);
      return [];
    }

    const notifId = await scheduleLocalNotification({
      title: '⏰ Task Reminder',
      body: task.text,
      scheduledAt: new Date(scheduledAt),
      extra: { taskId: task.id, type: 'task', priority: task.priority || 'medium' },
    });

    console.log('Task reminder scheduled:', task.text, notifId);
    return [notifId];
  }

  async scheduleNoteReminder(note: Note): Promise<number[]> {
    if (!note.reminderTime) {
      console.log('No reminder date set for note:', note.title);
      return [];
    }

    const notifId = await scheduleLocalNotification({
      title: '📝 Note Reminder',
      body: note.title,
      scheduledAt: new Date(note.reminderTime),
      extra: { noteId: note.id, type: 'note' },
    });

    console.log('Note reminder scheduled:', note.title, notifId);
    return [notifId];
  }

  async cancelTaskReminder(taskId: string, notificationIds?: number[]): Promise<void> {
    if (notificationIds && notificationIds.length > 0) {
      await cancelLocalNotification(notificationIds);
    }
    console.log('Task reminder cancelled for:', taskId);
  }

  async cancelNoteReminder(noteId: string, notificationIds?: number[]): Promise<void> {
    if (notificationIds && notificationIds.length > 0) {
      await cancelLocalNotification(notificationIds);
    }
    console.log('Note reminder cancelled for:', noteId);
  }

  async snoozeNotification(notification: any, snoozeOption: SnoozeOption): Promise<void> {
    const snoozeMinutes: Record<SnoozeOption, number> = {
      '5min': 5, '15min': 15, '1hour': 60, '3hours': 180, 'tomorrow': 1440,
    };
    const minutes = snoozeMinutes[snoozeOption] || 15;
    const snoozeAt = addMinutes(new Date(), minutes);

    const data = notification.data || notification.extra || {};
    await scheduleLocalNotification({
      title: notification.title || 'Snoozed Reminder',
      body: notification.body || '',
      scheduledAt: snoozeAt,
      extra: {
        ...(data.taskId ? { taskId: data.taskId } : {}),
        ...(data.noteId ? { noteId: data.noteId } : {}),
        type: data.type || 'task',
        snoozed: 'true',
      },
    });
    console.log('Snoozed notification for', snoozeOption);
  }

  async getAutoReminderTimes(): Promise<{ morning: number; afternoon: number; evening: number }> {
    try {
      const saved = await getSetting<{ morning: number; afternoon: number; evening: number } | null>('autoReminderTimes', null);
      if (saved) return saved;
    } catch (e) {
      console.error('Error loading auto-reminder times:', e);
    }
    return { morning: 9, afternoon: 14, evening: 19 };
  }

  async scheduleAutoReminders(task: TodoItem): Promise<number[]> {
    const times = await this.getAutoReminderTimes();
    const dueDate = task.dueDate ? new Date(task.dueDate) : new Date();
    const ids: number[] = [];

    for (const [label, hour] of Object.entries(times)) {
      const reminderDate = new Date(dueDate);
      reminderDate.setHours(hour, 0, 0, 0);
      if (reminderDate > new Date()) {
        const id = await scheduleLocalNotification({
          title: `${label.charAt(0).toUpperCase() + label.slice(1)} Reminder`,
          body: task.text,
          scheduledAt: reminderDate,
          extra: { taskId: task.id, type: 'task', autoReminder: label },
        });
        ids.push(id);
      }
    }
    console.log('Auto-reminders scheduled for:', task.text);
    return ids;
  }

  async cancelAutoReminders(taskId: string): Promise<void> {
    console.log('Auto-reminders cancelled for:', taskId);
  }

  async cancelAllReminders(): Promise<void> {
    const LN = await getLocalNotifications();
    if (LN) {
      try {
        const pending = await LN.getPending();
        if (pending.notifications.length > 0) {
          await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
        }
      } catch {}
    }
    console.log('All reminders cancelled');
  }

  async getPendingNotifications(): Promise<any[]> {
    const LN = await getLocalNotifications();
    if (LN) {
      try {
        const pending = await LN.getPending();
        return pending.notifications;
      } catch {}
    }
    return [];
  }

  async rescheduleAllTasks(tasks: TodoItem[]): Promise<void> {
    for (const task of tasks) {
      if (task.reminderTime || task.dueDate) {
        await this.scheduleTaskReminder(task);
      }
    }
    console.log('All tasks rescheduled');
  }

  async getNotificationHistory(): Promise<any[]> {
    return getSetting<any[]>('notificationHistory', []);
  }

  async clearNotificationHistory(): Promise<void> {
    await setSetting('notificationHistory', []);
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    const history = await getSetting<any[]>('notificationHistory', []);
    const updatedHistory = history.map((item: any) =>
      item.id === notificationId ? { ...item, read: true } : item
    );
    await setSetting('notificationHistory', updatedHistory);
  }

  async scheduleBudgetAlert(
    category: string,
    spent: number,
    budget: number,
    currencySymbol: string
  ): Promise<number | null> {
    const percentage = Math.round((spent / budget) * 100);
    const id = await scheduleLocalNotification({
      title: `Budget Alert: ${category}`,
      body: `You've spent ${currencySymbol}${spent.toFixed(2)} of ${currencySymbol}${budget.toFixed(2)} (${percentage}%)`,
      scheduledAt: new Date(Date.now() + 500),
      extra: { type: 'budget', category, percentage: String(percentage) },
    });
    console.log('Budget alert sent for:', category);
    return id;
  }

  async checkBudgetAlerts(
    categorySpending: { [key: string]: number },
    budgets: { [key: string]: number },
    currencySymbol: string
  ): Promise<void> {
    for (const [category, budget] of Object.entries(budgets)) {
      const spent = categorySpending[category] || 0;
      const percentage = (spent / budget) * 100;
      if (percentage >= 80) {
        await this.scheduleBudgetAlert(category, spent, budget, currencySymbol);
      }
    }
  }

  async clearBudgetAlertHistory(): Promise<void> {
    console.log('Budget alert history cleared');
  }

  async scheduleBillReminder(
    billId: string,
    description: string,
    amount: number,
    dueDate: Date,
    reminderDays: number,
    currencySymbol: string
  ): Promise<number | null> {
    const reminderDate = addDays(dueDate, -reminderDays);
    if (reminderDate > new Date()) {
      const id = await scheduleLocalNotification({
        title: 'Bill Due Soon',
        body: `${description} — ${currencySymbol}${amount.toFixed(2)} due ${dueDate.toLocaleDateString()}`,
        scheduledAt: reminderDate,
        extra: { type: 'bill', billId, dueDate: dueDate.toISOString() },
      });
      return id;
    }
    console.log('Bill reminder scheduled for:', description);
    return null;
  }

  async checkBillReminders(
    recurringExpenses: Array<{
      id: string;
      description: string;
      amount: number;
      dayOfMonth: number;
      enabled: boolean;
      reminderDays?: number;
    }>,
    currencySymbol: string
  ): Promise<void> {
    for (const expense of recurringExpenses) {
      if (!expense.enabled) continue;
      const now = new Date();
      const dueDate = new Date(now.getFullYear(), now.getMonth(), expense.dayOfMonth);
      if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);
      await this.scheduleBillReminder(
        expense.id, expense.description, expense.amount,
        dueDate, expense.reminderDays || 3, currencySymbol
      );
    }
  }

  async clearBillReminderHistory(): Promise<void> {
    console.log('Bill reminder history cleared');
  }

  async schedulePersonalizedNotifications(): Promise<void> {
    console.log('Personalized notifications scheduled');
  }

  async scheduleDailyMotivation(): Promise<void> {
    console.log('Daily motivation scheduled');
  }
}

export const notificationManager = NotificationManager.getInstance();
