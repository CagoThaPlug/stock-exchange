'use client';

import { useMemo, memo, useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Settings, Accessibility } from 'lucide-react';
import { supportedLanguages, translate } from '@/lib/i18n';
import { apiFetch } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { useAccessibility } from '@/components/providers/AccessibilityProvider';

// Types for better type safety
interface RandomTickerItem {
  symbol: string;
  name?: string;
  change?: number;
  changePercent?: number;
}

const HeaderTicker = memo(function HeaderTicker() {
  const [items, setItems] = useState<RandomTickerItem[]>([]);
  const [nextItems, setNextItems] = useState<RandomTickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRandom = useCallback(async (target: 'now' | 'next' = 'now', retryCount = 0): Promise<void> => {
    try {
      setError(null);
      const res = await apiFetch('/api/market/random');
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      const payload: RandomTickerItem[] = Array.isArray(data.items) ? data.items : [];
      if (target === 'now') {
        setItems(payload);
        setIsLoading(false);
      } else {
        setNextItems(payload);
      }
    } catch (error) {
      console.error('Failed to fetch random tickers:', error);
      
      if (retryCount < 2) { // Max 2 retries
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
        setTimeout(() => fetchRandom(target, retryCount + 1), delay);
      } else {
        setError(error instanceof Error ? error.message : 'Failed to load random tickers');
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch initial and prefetch next batch; swap on animation iteration
  useEffect(() => {
    let mounted = true;
    (async () => {
      await fetchRandom('now');
      if (mounted) await fetchRandom('next');
    })();
    return () => { mounted = false; };
  }, [fetchRandom]);

  const handleIteration = useCallback(() => {
    // Swap only at cycle boundary to avoid mid-scroll changes
    if (nextItems && nextItems.length > 0) {
      setItems(nextItems);
      setNextItems([]);
    }
    // Prefetch next set for the following cycle
    fetchRandom('next');
  }, [nextItems, fetchRandom]);

  // Memoized components to prevent recreation
  const Pill = useMemo(() => 
    ({ label }: { label: string }) => (
      <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded bg-background border border-border text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    ), []
  );

  const formatChange = useCallback((change: number, changePercent: number) => {
    const isPositive = change >= 0;
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
    const sign = isPositive ? '+' : '';
    return (
      <span className={colorClass}>
        {sign}{changePercent.toFixed(2)}%
      </span>
    );
  }, []);

  const rendered = useMemo(() => {
    if (isLoading) {
      return [
        <span key="loading" className="mr-6 inline-flex items-center">
          <Pill label="Market" />
          <span className="text-muted-foreground">Loading...</span>
        </span>,
      ];
    }

    if (error) {
      return [
        <span key="error" className="mr-6 inline-flex items-center">
          <Pill label="Market" />
          <span className="text-red-500">Error: {error}</span>
        </span>,
      ];
    }

    if (!items.length) {
      return [
        <span key="no-data" className="mr-6 inline-flex items-center">
          <Pill label="Market" />
          <span className="text-muted-foreground">No data available</span>
        </span>,
      ];
    }

    return items.map((it, i) => (
      <span key={`rand-${it.symbol || i}`} className="mr-6 inline-flex items-center">
        <Pill label="Stock" />
        <span>
          {it.symbol} {formatChange(Number(it.change || 0), Number(it.changePercent || 0))}
        </span>
      </span>
    ));
  }, [items, isLoading, error, Pill, formatChange]);

  return (
    <div className="hidden md:block flex-1 mx-4 overflow-hidden relative">
      <div className="ticker-scroll whitespace-nowrap py-1 text-xs flex items-center" onAnimationIteration={handleIteration}>
        {rendered}
      </div>
    </div>
  );
});

// Settings Panel Component - extracted for better organization
interface SettingsPanelProps {
  preferences: any;
  settings: any;
  updatePreferences: (updates: any) => void;
  updateSettings: (updates: any) => void;
  resetPreferences: () => void;
  onClose: () => void;
}

const SettingsPanel = memo(function SettingsPanel({
  preferences,
  settings,
  updatePreferences,
  updateSettings,
  resetPreferences,
  onClose
}: SettingsPanelProps) {
  const languageFlagSrcByCode: Record<string, string> = {
    en: '/flags/us.svg',
    es: '/flags/es.svg',
    fr: '/flags/fr.svg',
    de: '/flags/de.svg',
    zh: '/flags/cn.svg',
  };

  const currencyFlagSrcByCode: Record<string, string> = {
    USD: '/flags/us.svg',
    EUR: '/flags/fr.svg',
    GBP: '/flags/gb.svg',
    JPY: '/flags/jp.svg',
    CNY: '/flags/cn.svg',
    INR: '/flags/in.svg',
    CAD: '/flags/ca.svg',
    AUD: '/flags/au.svg',
    CHF: '/flags/ch.svg',
  };

  const currencies = ['USD','EUR','GBP','JPY','CNY','INR','CAD','AUD','CHF'];

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (
        target.closest('[data-settings-panel]') ||
        target.closest('[data-settings-trigger]') ||
        target.closest('[data-radix-select-trigger]') ||
        target.closest('[data-radix-select-content]')
      ) {
        return;
      }
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleLanguageChange = useCallback((lang: string) => {
    const meta = supportedLanguages.find(l => l.code === lang);
    updatePreferences({ 
      language: lang, 
      locale: meta?.locale || preferences.locale 
    });
  }, [updatePreferences, preferences.locale]);

  const ToggleSwitch = memo(({ 
    checked, 
    onChange, 
    label,
    'aria-label': ariaLabel 
  }: { 
    checked: boolean; 
    onChange: () => void; 
    label: string;
    'aria-label'?: string;
  }) => (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">{label}</label>
      <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
        aria-label={ariaLabel || `Toggle ${label}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  ));

  return (
    <div 
      className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-50"
      data-settings-panel
    >
      <h3 className="font-semibold mb-3">
        {translate(preferences.language, 'header.prefs.title', 'Preferences')}
      </h3>
      
      <div className="space-y-4">
        {/* Language */}
        <div>
          <label className="text-sm font-medium mb-1 block">
            {translate(preferences.language, 'header.prefs.language', 'Language')}
          </label>
          <Select
            value={preferences.language}
            onValueChange={handleLanguageChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={translate(preferences.language, 'header.prefs.language', 'Language')} />
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map(l => (
                <SelectItem key={l.code} value={l.code}>
                  <span className="inline-flex items-center mr-2">
                    <img src={languageFlagSrcByCode[l.code]} alt="" className="w-4 h-4 rounded-sm" />
                  </span>
                  <span>{l.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Currency */}
        <div>
          <label className="text-sm font-medium mb-1 block">
            {translate(preferences.language, 'header.prefs.currency', 'Currency')}
          </label>
          <Select
            value={preferences.currency}
            onValueChange={(code) => updatePreferences({ currency: code })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={translate(preferences.language, 'header.prefs.currency', 'Currency')} />
            </SelectTrigger>
            <SelectContent>
              {currencies.map(code => (
                <SelectItem key={code} value={code}>
                  <span className="inline-flex items-center mr-2">
                    <img src={currencyFlagSrcByCode[code]} alt="" className="w-4 h-4 rounded-sm" />
                  </span>
                  <span>{code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {translate(preferences.language, 'header.prefs.shortcuts', 'Keyboard Shortcuts')}
          </label>
          <button
            onClick={() => window.dispatchEvent(new Event('open-shortcuts'))}
            className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
          >
            {translate(preferences.language, 'header.prefs.view', 'View (Ctrl+H)')}
          </button>
        </div>

        {/* AI Personality */}
        <div>
          <label className="text-sm font-medium mb-1 block">
            {translate(preferences.language, 'header.prefs.aiPersonality', 'AI Personality')}
          </label>
          <select
            value={preferences.aiPersonality}
            onChange={(e) => updatePreferences({ aiPersonality: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
          >
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>

        {/* Notifications */}
        <ToggleSwitch
          checked={preferences.notifications}
          onChange={() => updatePreferences({ notifications: !preferences.notifications })}
          label={translate(preferences.language, 'header.prefs.notifications', 'Notifications')}
        />

        {/* Show AI Chat */}
        <ToggleSwitch
          checked={preferences.showChat}
          onChange={() => updatePreferences({ showChat: !preferences.showChat })}
          label={translate(preferences.language, 'header.prefs.showChat', 'Show AI Chat')}
        />

        {/* Font Size */}
        <div>
          <label className="text-sm font-medium mb-1 block">
            {translate(preferences.language, 'header.prefs.fontSize', 'Font Size')}
          </label>
          <select
            value={settings.fontSize}
            onChange={(e) => updateSettings({ fontSize: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
        <span>
          {translate(preferences.language, 'header.prefs.savedLocally', 'All settings are saved locally in your browser')}
        </span>
        <button
          onClick={() => { resetPreferences(); onClose(); }}
          className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground"
          aria-label="Clear settings"
          title="Clear settings"
        >
          {translate(preferences.language, 'header.prefs.clear', 'Clear')}
        </button>
      </div>
    </div>
  );
});

// Main Header Component
export function Header() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { preferences, updatePreferences } = usePreferences();
  const { settings, updateSettings } = useAccessibility();
  const [showSettings, setShowSettings] = useState(false);

  const toggleTheme = useCallback(() => {
    const nextTheme = (resolvedTheme || theme) === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    updatePreferences({ colorTheme: nextTheme });
  }, [theme, resolvedTheme, setTheme, updatePreferences]);

  const toggleHighContrast = useCallback(() => {
    updateSettings({ highContrast: !settings.highContrast });
  }, [settings.highContrast, updateSettings]);

  const toggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  // Close settings on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showSettings) {
        closeSettings();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showSettings, closeSettings]);

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <img
              src="https://i.imgur.com/iCoE9TK.png"
              alt="Site logo"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {translate(preferences.language, 'header.title', 'Zalc.Dev AI Stock Exchange')}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {translate(preferences.language, 'header.tagline', 'Intelligent Trading Insights at Your Fingertips')}
              </p>
            </div>
          </div>

          {/* Center Ticker */}
          <HeaderTicker />

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {/* Layout Selector */}
            <div className="hidden md:block min-w-[140px]">
              <Select
                value={preferences.layout}
                onValueChange={(val) => updatePreferences({ layout: val as 'classic' | 'compact' | 'analysis' })}
              >
                <SelectTrigger className="h-9 bg-muted border-input">
                  <SelectValue placeholder={translate(preferences.language, 'header.layout.placeholder', 'Layout')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">
                    {translate(preferences.language, 'header.layout.classic', 'Classic')}
                  </SelectItem>
                  <SelectItem value="compact">
                    {translate(preferences.language, 'header.layout.compact', 'Compact')}
                  </SelectItem>
                  <SelectItem value="analysis">
                    {translate(preferences.language, 'header.layout.analysis', 'Analysis')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Accessibility Toggle */}
            <button
              onClick={toggleHighContrast}
              className={`p-2 rounded-lg transition-colors ${
                settings.highContrast
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
              aria-label="Toggle high contrast mode"
              title="High Contrast Mode"
            >
              <Accessibility className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={settings.highContrast ? undefined : toggleTheme}
              disabled={settings.highContrast}
              className={`p-2 rounded-lg bg-muted transition-colors ${settings.highContrast ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/80'}`}
              aria-disabled={settings.highContrast}
              aria-label={
                settings.highContrast
                  ? 'Theme toggle disabled in High Contrast mode'
                  : `Switch to ${(resolvedTheme || theme) === 'dark' ? 'light' : 'dark'} theme`
              }
              title={
                settings.highContrast
                  ? 'Theme toggle disabled in High Contrast mode'
                  : `Switch to ${(resolvedTheme || theme) === 'dark' ? 'light' : 'dark'} theme`
              }
            >
              {(resolvedTheme || theme) === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Settings */}
            <div className="relative">
              <button
                onClick={toggleSettings}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                aria-label="Open settings"
                title="Settings"
                data-settings-trigger
              >
                <Settings className="w-4 h-4" />
              </button>

              {showSettings && (
                <SettingsPanel
                  preferences={preferences}
                  settings={settings}
                  updatePreferences={updatePreferences}
                  updateSettings={updateSettings}
                  resetPreferences={(window as any).resetPreferences || (() => { try { localStorage.removeItem('zalc-preferences'); location.reload(); } catch {} })}
                  onClose={closeSettings}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}