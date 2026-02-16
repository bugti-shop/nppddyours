import React, { Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { migrateLocalStorageToIndexedDB, getSetting } from "./utils/settingsStorage";
import { initializeReminders } from "./utils/reminderScheduler";
import { migrateNotesToIndexedDB } from "./utils/noteStorage";
import { startBackgroundScheduler } from "./utils/backgroundScheduler";
import { initializeTaskOrder } from "./utils/taskOrderStorage";
import { initializeProtectionSettings } from "./utils/noteProtection";
import { configureStatusBar } from "./utils/statusBar";

// No loading screen - render nothing during suspense for instant feel
const EmptyFallback = () => null;

// Wrapper component that handles migration before rendering the app
const AppWithMigration = () => {
  useEffect(() => {
    const runMigrations = async () => {
      try {
        // Run migrations in parallel
        await Promise.all([
          migrateLocalStorageToIndexedDB(),
          migrateNotesToIndexedDB(),
          initializeTaskOrder(),
          initializeProtectionSettings(),
        ]);
        
        // Start background scheduler for automatic task rollovers
        startBackgroundScheduler();
        
        // Initialize reminder system (channels + permissions)
        initializeReminders().catch(console.warn);
        
        // Configure status bar for native apps
        const theme = await getSetting<string>('theme', 'light');
        const isDarkMode = theme !== 'light';
        await configureStatusBar(isDarkMode);
      } catch (error) {
        console.error('Migration error:', error);
      }
    };
    runMigrations();
  }, []);

  // Render immediately; migrations happen in background (no white/loader delay)
  return <App />;
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<EmptyFallback />}>
      <AppWithMigration />
    </Suspense>
  </React.StrictMode>
);
