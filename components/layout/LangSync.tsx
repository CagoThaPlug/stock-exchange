'use client';

import { useEffect } from 'react';
import { usePreferences } from '@/components/providers/PreferencesProvider';

export function LangSync() {
  const { preferences } = usePreferences();
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = preferences.language;
    }
  }, [preferences.language]);
  return null;
}


