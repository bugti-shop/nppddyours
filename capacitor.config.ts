import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nota.npd.com',
  appName: 'Npd',
  webDir: 'dist',
  server: {
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
    zoomEnabled: true,
  },
  ios: {
    scrollEnabled: true,
  },
};

export default config;
