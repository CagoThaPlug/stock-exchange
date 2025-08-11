'use client';

import { Bot } from 'lucide-react';

interface ChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function ChatButton({ isOpen, onClick }: ChatButtonProps) {
  if (isOpen) return null;

  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 z-50 h-11 px-4 rounded-full shadow-md transition-colors
        bg-card text-foreground border border-border
        hover:bg-accent/10 hover:shadow-lg
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
      `}
      aria-label="Open AI Chat Assistant"
      title="AI Stock Assistant"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
          <Bot className="w-3.5 h-3.5" />
        </span>
        <span className="text-sm font-medium" aria-hidden="true">Ask AI</span>
      </div>
    </button>
  );
}