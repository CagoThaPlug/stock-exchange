'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, BarChart3, TrendingUp, Newspaper, Lightbulb, Trash2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { usePreferences } from '@/components/providers/PreferencesProvider';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatWindow({ isOpen, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hi! I'm your AI stock assistant. I can help you analyze stocks, understand market trends, and provide trading insights. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { preferences } = usePreferences();

  const quickActions = [
    { icon: BarChart3, label: 'Market Overview', action: 'Give me a market overview for today' },
    { icon: TrendingUp, label: 'Analyze Stock', action: 'Analyze AAPL stock for me' },
    { icon: Newspaper, label: 'Latest News', action: 'What are the most important market news today?' },
    { icon: Lightbulb, label: 'Trading Ideas', action: 'Give me some trading ideas for tech stocks' },
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClear = () => {
    const ok = window.confirm('Clear chat history?');
    if (!ok) return;
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content:
          "Hi! I'm your AI stock assistant. I can help you analyze stocks, understand market trends, and provide trading insights. What would you like to know?",
        timestamp: new Date(),
      },
    ]);
  };

  const handleSubmit = async (content: string) => {
    if (!content.trim()) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, personality: preferences.aiPersonality }),
      });
      const data = await res.json().catch(() => ({} as any));
      const text = res.ok && typeof data?.response === 'string'
        ? data.response
        : (data?.error || 'Sorry, I could not generate a response right now. Please try again.');
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (e) {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Network error contacting AI service. Please check your connection and try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  // Local mock removed; responses now come from /api/chat

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-accent/10 rounded-t-xl">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 gradient-market rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <div>
            <h3 className="font-semibold text-sm">Zalc AI Assistant</h3>
            <p className="text-xs text-muted-foreground">Stock Market Expert</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleClear} className="p-1 hover:bg-muted rounded-full transition-colors" aria-label="Clear chat" title="Clear chat">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors" aria-label="Close chat">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3 max-w-xs">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-border">
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => handleSubmit(action.action)}
                className="flex items-center space-x-2 p-2 bg-muted hover:bg-muted/80 rounded-lg text-xs transition-colors"
                disabled={isLoading}
              >
                <Icon className="w-3 h-3 text-primary" />
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit(inputValue);
              }}
              placeholder="Ask me about any stock or market trend..."
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={() => handleSubmit(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

