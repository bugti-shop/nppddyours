import { Capacitor } from '@capacitor/core';
import { getSetting } from './settingsStorage';

/**
 * Firebase Cloud Functions API Client
 * 
 * IMPORTANT: Set your Cloud Functions base URL after deploying.
 * It will look like: https://<region>-<project-id>.cloudfunctions.net
 * 
 * Store it via: setSetting('firebaseFunctionsUrl', 'https://...')
 * Or hardcode it below after deployment.
 */

const FALLBACK_BASE_URL = ''; // Set your deployed URL here after firebase deploy

let cachedBaseUrl: string | null = null;

const getBaseUrl = async (): Promise<string> => {
  if (cachedBaseUrl) return cachedBaseUrl;
  const stored = await getSetting<string>('firebaseFunctionsUrl', FALLBACK_BASE_URL);
  cachedBaseUrl = stored;
  return stored;
};

/** Call this when the URL is updated in settings to clear the cache */
export const clearFirebaseUrlCache = (): void => {
  cachedBaseUrl = null;
};

const apiCall = async (functionName: string, body: Record<string, any>): Promise<any> => {
  const baseUrl = await getBaseUrl();
  if (!baseUrl) {
    console.warn(`[FirebaseAPI] No base URL configured. Skipping call to ${functionName}`);
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[FirebaseAPI] ${functionName} failed [${response.status}]:`, errorData);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[FirebaseAPI] ${functionName} network error:`, error);
    return null;
  }
};

// ---- Token Management ----

export const registerDeviceToken = async (token: string): Promise<void> => {
  const userId = await getSetting<string>('userId', '');
  await apiCall('registerToken', {
    token,
    userId: userId || undefined,
    platform: Capacitor.getPlatform(),
  });
};

export const removeDeviceToken = async (): Promise<void> => {
  const token = await getSetting<string>('pushToken', '');
  const userId = await getSetting<string>('userId', '');
  if (token || userId) {
    await apiCall('removeToken', { token, userId: userId || undefined });
  }
};

// ---- Reminder Scheduling ----

export interface ScheduleReminderParams {
  title: string;
  body?: string;
  scheduledAt: string; // ISO 8601
  data?: Record<string, string>;
  repeatType?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
}

export const scheduleReminder = async (params: ScheduleReminderParams): Promise<string | null> => {
  const userId = await getSetting<string>('userId', '');
  const token = await getSetting<string>('pushToken', '');

  const result = await apiCall('scheduleReminder', {
    userId: userId || undefined,
    token: token || undefined,
    ...params,
  });

  return result?.reminderId || null;
};

export const cancelReminder = async (options: {
  reminderId?: string;
  taskId?: string;
  noteId?: string;
}): Promise<void> => {
  const userId = await getSetting<string>('userId', '');
  await apiCall('cancelReminder', {
    ...options,
    userId: userId || undefined,
  });
};

// ---- Immediate Push ----

export const sendImmediatePush = async (title: string, body: string, data?: Record<string, string>): Promise<void> => {
  const userId = await getSetting<string>('userId', '');
  const token = await getSetting<string>('pushToken', '');

  await apiCall('sendPush', {
    userId: userId || undefined,
    token: token || undefined,
    title,
    body,
    data,
  });
};
