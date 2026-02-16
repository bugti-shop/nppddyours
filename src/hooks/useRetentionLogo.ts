import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import defaultLogo from '@/assets/app-logo.png';
import sadLogo from '@/assets/sad-logo.png';
import angryLogo from '@/assets/angry-logo.png';

const LAST_OPEN_KEY = 'lastAppOpenTime';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * ONE_DAY_MS;

/**
 * Retention logos:
 * - 1 day away → sad logo shown until user opens app (then resets to default)
 * - 2+ days away → angry/crash logo shown until user opens app (then resets to default)
 * - Active user → default logo
 */
export const useRetentionLogo = () => {
  const [logo, setLogo] = useState(defaultLogo);
  const [mood, setMood] = useState<'default' | 'sad' | 'angry'>('default');

  useEffect(() => {
    const check = async () => {
      const lastOpen = await getSetting<number | null>(LAST_OPEN_KEY, null);
      const now = Date.now();

      if (lastOpen) {
        const elapsed = now - lastOpen;
        if (elapsed >= TWO_DAYS_MS) {
          setLogo(angryLogo);
          setMood('angry');
        } else if (elapsed >= ONE_DAY_MS) {
          setLogo(sadLogo);
          setMood('sad');
        }
      }

      await setSetting(LAST_OPEN_KEY, now);
    };

    check();
  }, []);

  return { logo, mood };
};
