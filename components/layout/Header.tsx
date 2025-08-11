'use client';

import { useMemo, memo, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Settings, Accessibility } from 'lucide-react';
import { supportedLanguages, translate } from '@/lib/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { useAccessibility } from '@/components/providers/AccessibilityProvider';

export function Header() {
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = usePreferences();
  const { settings, updateSettings } = useAccessibility();
  const [showSettings, setShowSettings] = useState(false);

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

  const HeaderTicker = memo(function HeaderTicker() {
    const items = useMemo(() => {
      const pill = (label: string) => (
        <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded bg-background border border-border text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      );
      const base = [
        { label: 'Index', node: <span className="text-green-600">SPX +{(Math.random()*1.3+0.1).toFixed(2)}%</span> },
        { label: 'FX', node: <span>EUR/USD {(1.05+Math.random()*0.04).toFixed(4)}</span> },
        { label: 'Earnings', node: <span>AAPL {(Math.random()*3).toFixed(1)}%</span> },
        { label: 'Crypto', node: <span className="text-green-600">BTC +{(Math.random()*2.5).toFixed(1)}%</span> },
        { label: 'Sector', node: <span className="text-red-600">Banks -{(Math.random()*1.2+0.1).toFixed(1)}%</span> },
      ];
      const longTape = [...base, ...base, ...base];
      // Shuffle order so it doesn't look the same each load
      for (let i = longTape.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [longTape[i], longTape[j]] = [longTape[j], longTape[i]];
      }
      // Random rotate for extra variance
      const offset = Math.floor(Math.random() * longTape.length);
      const rotated = longTape.slice(offset).concat(longTape.slice(0, offset));
      return rotated.map((it, i) => (
        <span key={`hdr-ticker-${i}`} className="mr-6 inline-flex items-center">
          {pill(it.label)}
          {it.node}
        </span>
      ));
    }, []);
    return (
      <div className="hidden md:block flex-1 mx-4 overflow-hidden">
        <div className="ticker-scroll whitespace-nowrap py-1 text-xs flex items-center">
          {items}
        </div>
      </div>
    );
  });

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
                onValueChange={(val) => updatePreferences({ layout: val as any })}
              >
                <SelectTrigger className="h-9 bg-muted border-input">
                  <SelectValue placeholder={translate(preferences.language, 'header.layout.placeholder', 'Layout')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">{translate(preferences.language, 'header.layout.classic', 'Classic')}</SelectItem>
                  <SelectItem value="compact">{translate(preferences.language, 'header.layout.compact', 'Compact')}</SelectItem>
                  <SelectItem value="analysis">{translate(preferences.language, 'header.layout.analysis', 'Analysis')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Accessibility Toggle */}
            <button
              onClick={() => updateSettings({ highContrast: !settings.highContrast })}
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
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                aria-label="Open settings"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {showSettings && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-50">
                  <h3 className="font-semibold mb-3">{translate(preferences.language, 'header.prefs.title', 'Preferences')}</h3>
                  
                  <div className="space-y-4">
                    {/* Language */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">{translate(preferences.language, 'header.prefs.language', 'Language')}</label>
                      <Select
                        value={preferences.language}
                        onValueChange={(lang) => {
                          const meta = supportedLanguages.find(l => l.code === lang);
                          updatePreferences({ language: lang as any, locale: meta?.locale || preferences.locale });
                        }}
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
                      <label className="text-sm font-medium mb-1 block">{translate(preferences.language, 'header.prefs.currency', 'Currency')}</label>
                      <Select
                        value={preferences.currency}
                        onValueChange={(code) => updatePreferences({ currency: code as any })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={translate(preferences.language, 'header.prefs.currency', 'Currency')} />
                        </SelectTrigger>
                        <SelectContent>
                          {['USD','EUR','GBP','JPY','CNY','INR','CAD','AUD','CHF'].map(code => (
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
                      <label className="text-sm font-medium">{translate(preferences.language, 'header.prefs.shortcuts', 'Keyboard Shortcuts')}</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => window.dispatchEvent(new Event('open-shortcuts'))}
                          className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded"
                        >
                          {translate(preferences.language, 'header.prefs.view', 'View (Ctrl+H)')}
                        </button>
                      </div>
                    </div>

                    {/* AI Personality */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">{translate(preferences.language, 'header.prefs.aiPersonality', 'AI Personality')}</label>
                      <select
                        value={preferences.aiPersonality}
                        onChange={(e) => updatePreferences({ aiPersonality: e.target.value as any })}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
                      >
                        <option value="conservative">Conservative</option>
                        <option value="balanced">Balanced</option>
                        <option value="aggressive">Aggressive</option>
                      </select>
                    </div>

                    

                    {/* Notifications */}
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{translate(preferences.language, 'header.prefs.notifications', 'Notifications')}</label>
                      <button
                        onClick={() => updatePreferences({ notifications: !preferences.notifications })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          preferences.notifications ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            preferences.notifications ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Auto-translate News: now always on, control removed */}

                    {/* Show AI Chat */}
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{translate(preferences.language, 'header.prefs.showChat', 'Show AI Chat')}</label>
                      <button
                        onClick={() => updatePreferences({ showChat: !preferences.showChat })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          preferences.showChat ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            preferences.showChat ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Font Size */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">{translate(preferences.language, 'header.prefs.fontSize', 'Font Size')}</label>
                      <select
                        value={settings.fontSize}
                        onChange={(e) => updateSettings({ fontSize: e.target.value as any })}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border text-xs text-muted-foreground">
                    {translate(preferences.language, 'header.prefs.savedLocally', 'All settings are saved locally in your browser')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}