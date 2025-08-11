'use client';

import { useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { X } from 'lucide-react';

interface KeyboardShortcutsProps {
  onToggleChat: () => void;
}

export function KeyboardShortcuts({ onToggleChat }: KeyboardShortcutsProps) {
  const { preferences } = usePreferences();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Register shortcuts
  useHotkeys('ctrl+/', onToggleChat, { enabled: preferences.keyboardShortcuts, preventDefault: true });
  useHotkeys('ctrl+k', () => {
    const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  }, { enabled: preferences.keyboardShortcuts, preventDefault: true });
  useHotkeys('ctrl+h', () => setShowShortcuts(true), { enabled: preferences.keyboardShortcuts, preventDefault: true });
  useHotkeys('escape', () => setShowShortcuts(false), { enabled: preferences.keyboardShortcuts });

  // Allow other components to trigger the shortcuts dialog
  useEffect(() => {
    const openHandler = () => setShowShortcuts(true);
    const closeHandler = () => setShowShortcuts(false);
    // Casting to EventListener to satisfy TS for CustomEvent without payload
    window.addEventListener('open-shortcuts', openHandler as unknown as EventListener);
    window.addEventListener('close-shortcuts', closeHandler as unknown as EventListener);
    return () => {
      window.removeEventListener('open-shortcuts', openHandler as unknown as EventListener);
      window.removeEventListener('close-shortcuts', closeHandler as unknown as EventListener);
    };
  }, []);

  if (!showShortcuts) return null;

  const shortcuts = [
    { key: 'Ctrl + /', action: 'Toggle AI Chat' },
    { key: 'Ctrl + K', action: 'Focus Search' },
    { key: 'Ctrl + H', action: 'Show Shortcuts' },
    { key: 'Escape', action: 'Close Modals' },
    { key: 'Tab', action: 'Navigate Elements' },
    { key: 'Enter', action: 'Activate Buttons' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={() => setShowShortcuts(false)}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm">{shortcut.action}</span>
              <kbd className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-mono">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        
        <div className="p-4 pt-0 text-xs text-muted-foreground">
          Press Escape to close this dialog
        </div>
      </div>
    </div>
  );
}