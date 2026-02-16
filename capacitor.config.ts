import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nota.npd.com',
  appName: 'Npd',
  webDir: 'dist',
  server: {
    cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "npd_notification_icon",
      iconColor: "#3B82F6",
      sound: "beep.wav",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    zoomEnabled: true,
  },
  ios: {
    scrollEnabled: true,
  },
};

export default config;
