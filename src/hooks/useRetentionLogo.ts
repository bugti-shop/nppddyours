import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import defaultLogo from '@/assets/app-logo.png';
import sadLogo from '@/assets/sad-logo.png';

const LAST_OPEN_KEY = 'lastAppOpenTime';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SAD_LOGO_DURATION_MS = 5000; // Show sad logo for 5 seconds

/**
 * Returns the sad logo if the user hasn't opened the app in 24+ hours,
 * then switches back to the default logo after a few seconds.
 */
export const useRetentionLogo = () => {
  const [logo, setLogo] = useState(defaultLogo);
  const [isSad, setIsSad] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      const lastOpen = await getSetting<number | null>(LAST_OPEN_KEY, null);
      const now = Date.now();

      if (lastOpen && now - lastOpen >= ONE_DAY_MS) {
        // User was away for 24h+ → show sad logo temporarily
        setLogo(sadLogo);
        setIsSad(true);

        timer = setTimeout(() => {
          setLogo(defaultLogo);
          setIsSad(false);
        }, SAD_LOGO_DURATION_MS);
      }

      // Always update last open time
      await setSetting(LAST_OPEN_KEY, now);
    };

    check();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  return { logo, isSad };
};
