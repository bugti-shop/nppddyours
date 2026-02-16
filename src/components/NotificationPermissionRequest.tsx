import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Requests notification permission on first app launch.
 * On Android 13+ this triggers the system "Allow / Don't Allow" dialog.
 * On older Android versions, permission is granted automatically.
 * On web, uses the browser Notification API.
 * 
 * NOTE: This works entirely through @capacitor/local-notifications —
 * NO custom MainActivity or AndroidManifest modifications are needed.
 */
export const NotificationPermissionRequest = () => {
  const hasRequested = useRef(false);

  useEffect(() => {
    if (hasRequested.current) return;
    hasRequested.current = true;

    const requestPermission = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          // Use Capacitor LocalNotifications — triggers system dialog on Android 13+
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          const check = await LocalNotifications.checkPermissions();
          
          if (check.display === 'prompt' || check.display === 'prompt-with-rationale') {
            console.log('[NotificationPermission] Requesting native notification permission...');
            const result = await LocalNotifications.requestPermissions();
            console.log('[NotificationPermission] Permission result:', result.display);
          } else {
            console.log('[NotificationPermission] Already resolved:', check.display);
          }
        } else {
          // Web: use browser Notification API
          if ('Notification' in window && Notification.permission === 'default') {
            console.log('[NotificationPermission] Requesting web notification permission...');
            const result = await Notification.requestPermission();
            console.log('[NotificationPermission] Web permission result:', result);
          }
        }
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (!msg.includes('not implemented') && !msg.includes('not available')) {
          console.warn('[NotificationPermission] Error:', err);
        }
      }
    };

    // Small delay to let the app render first, then show system dialog
    const timer = setTimeout(requestPermission, 1500);
    return () => clearTimeout(timer);
  }, []);

  return null;
};
