import { getSetting, setSetting } from '@/utils/settingsStorage';

export interface NotificationHistoryItem {
  id: string;
  noteId: string;
  noteTitle: string;
  noteContent: string;
  triggeredAt: Date;
  sound?: string;
  recurring?: string;
  wasOpened: boolean;
}

const STORAGE_KEY = 'nota-notification-history';

// In-memory cache for sync access
let historyCache: NotificationHistoryItem[] | null = null;

export const getNotificationHistory = (): NotificationHistoryItem[] => {
  return historyCache || [];
};

export const initializeNotificationHistory = async (): Promise<void> => {
  const saved = await getSetting<NotificationHistoryItem[]>(STORAGE_KEY, []);
  historyCache = saved.map((item) => ({
    ...item,
    triggeredAt: new Date(item.triggeredAt),
  }));
};

export const saveNotificationHistory = (item: NotificationHistoryItem): void => {
  const history = getNotificationHistory();
  history.unshift(item);
  // Keep only last 50 items
  const trimmed = history.slice(0, 50);
  historyCache = trimmed;
  setSetting(STORAGE_KEY, trimmed);
};

export const clearNotificationHistory = (): void => {
  historyCache = [];
  setSetting(STORAGE_KEY, []);
};
