import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import defaultLogo from '@/assets/app-logo.png';
import sadLogo from '@/assets/sad-logo.png';
import angryLogo from '@/assets/angry-logo.png';

const LAST_OPEN_KEY = 'lastAppOpenTime';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * ONE_DAY_MS;
const RETENTION_LOGO_DURATION_MS = 5000;

/**
 * Shows different logos based on user absence:
 * - 1 day away → sad logo (5s then default)
 * - 2+ days away → angry logo (5s then default)
 */
export const useRetentionLogo = () => {
  const [logo, setLogo] = useState(defaultLogo);
  const [isSad, setIsSad] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      const lastOpen = await getSetting<number | null>(LAST_OPEN_KEY, null);
      const now = Date.now();

      if (lastOpen) {
        const elapsed = now - lastOpen;
        if (elapsed >= TWO_DAYS_MS) {
          setLogo(angryLogo);
          setIsSad(true);
          timer = setTimeout(() => { setLogo(defaultLogo); setIsSad(false); }, RETENTION_LOGO_DURATION_MS);
        } else if (elapsed >= ONE_DAY_MS) {
          setLogo(sadLogo);
          setIsSad(true);
          timer = setTimeout(() => { setLogo(defaultLogo); setIsSad(false); }, RETENTION_LOGO_DURATION_MS);
        }
      }

      await setSetting(LAST_OPEN_KEY, now);
    };

    check();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  return { logo, isSad };
};
