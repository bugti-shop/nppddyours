# Android Notification Channel & Firebase Setup

## 1. Place `google-services.json`

Copy `android-config/google-services.json` into your Android project:

```
android/app/google-services.json
```

## 2. Create the Notification Channel

After running `npx cap add android`, edit this file:

**`android/app/src/main/java/nota/npd/com/MainActivity.java`**

Replace contents with:

```java
package nota.npd.com;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);

            // Main reminders channel
            NotificationChannel reminders = new NotificationChannel(
                "npd_reminders",
                "Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            reminders.setDescription("Task, note, and habit reminders");
            reminders.enableVibration(true);
            reminders.enableLights(true);
            manager.createNotificationChannel(reminders);

            // General notifications channel
            NotificationChannel general = new NotificationChannel(
                "npd_general",
                "General",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            general.setDescription("General app notifications");
            manager.createNotificationChannel(general);
        }
    }
}
```

## 3. Add Firebase dependencies

Edit **`android/app/build.gradle`** — add at the bottom:

```gradle
apply plugin: 'com.google.gms.google-services'
```

Edit **`android/build.gradle`** (project-level) — add inside `dependencies`:

```gradle
classpath 'com.google.gms:google-services:4.4.2'
```

## 4. Sync & Run

```bash
npx cap sync android
npx cap run android
```

The `npd_reminders` channel will be created on app launch with high importance (sound + vibration + heads-up display).
