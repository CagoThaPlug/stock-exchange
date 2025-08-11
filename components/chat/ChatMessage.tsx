'use client';

import { Bot, User, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(type);
    // Here you would typically send feedback to your analytics service
  };

  const formatContent = (content: string) => {
    // Convert markdown-like formatting to JSX
    return content.split('\n').map((line, index) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <div key={index} className="font-semibold text-primary mt-2 mb-1">
            {line.slice(2, -2)}
          </div>
        );
      }
      
      if (line.startsWith('• ')) {
        return (
          <div key={index} className="ml-4 mb-1">
            <span className="text-primary mr-2">•</span>
            {line.slice(2)}
          </div>
        );
      }
      
      if (line.match(/^\d+\./)) {
        return (
          <div key={index} className="mb-1">
            {line}
          </div>
        );
      }
      
      if (line.includes('🔹')) {
        return (
          <div key={index} className="mb-1 flex items-start">
            <span className="text-primary mr-2">•</span>
            {line.replace('🔹', '').trim()}
          </div>
        );
      }
      
      if (line.trim() === '') {
        return <div key={index} className="h-2"></div>;
      }
      
      return (
        <div key={index} className="mb-1">
          {line}
        </div>
      );
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start space-x-2 max-w-[85%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-primary text-primary-foreground' : 'gradient-market text-white'
        }`}>
          {isUser ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
        </div>

        {/* Message Content */}
        <div className={`rounded-lg p-3 ${
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted text-muted-foreground'
        }`}>
          <div className="text-sm leading-relaxed">
            {formatContent(message.content)}
          </div>
          
          {/* Timestamp */}
          <div className={`text-xs mt-2 opacity-70 ${
            isUser ? 'text-right' : 'text-left'
          }`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Actions (only for assistant messages) */}
      {!isUser && (
        <div className="flex flex-col space-y-1 ml-2 mt-2">
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-muted rounded transition-colors group"
            title={copied ? 'Copied!' : 'Copy message'}
          >
            <Copy className={`w-3 h-3 ${copied ? 'text-green-600' : 'text-muted-foreground group-hover:text-foreground'}`} />
          </button>
          
          <button
            onClick={() => handleFeedback('up')}
            className={`p-1 hover:bg-muted rounded transition-colors ${
              feedback === 'up' ? 'text-green-600' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Helpful"
          >
            <ThumbsUp className="w-3 h-3" />
          </button>
          
          <button
            onClick={() => handleFeedback('down')}
            className={`p-1 hover:bg-muted rounded transition-colors ${
              feedback === 'down' ? 'text-red-600' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Not helpful"
          >
            <ThumbsDown className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}