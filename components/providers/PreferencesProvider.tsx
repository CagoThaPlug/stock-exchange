'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserPreferences {
  language: 'en' | 'es' | 'fr' | 'de' | 'zh';
  locale: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'INR' | 'CAD' | 'AUD' | 'CHF';
  aiPersonality: 'conservative' | 'aggressive' | 'balanced';
  notifications: boolean;
  voiceEnabled: boolean;
  watchlist: string[];
  colorTheme: string;
  tourCompleted: boolean;
  keyboardShortcuts: boolean;
  showChat: boolean;
  layout: 'classic' | 'compact' | 'analysis';
  autoTranslateNews: boolean;
}

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

const defaultPreferences: UserPreferences = {
  language: 'en',
  locale: 'en-US',
  currency: 'USD',
  aiPersonality: 'balanced',
  notifications: true,
  voiceEnabled: false,
  watchlist: ['AAPL', 'GOOGL', 'MSFT', 'TSLA'],
  colorTheme: 'default',
  tourCompleted: false,
  keyboardShortcuts: true,
  showChat: true,
  layout: 'classic',
  autoTranslateNews: true,
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  useEffect(() => {
    const saved = localStorage.getItem('zalc-preferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences({ ...defaultPreferences, ...parsed });
      } catch (error) {
      }
    }
  }, []);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    localStorage.setItem('zalc-preferences', JSON.stringify(newPreferences));
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    localStorage.removeItem('zalc-preferences');
  };

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}