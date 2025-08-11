export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    stocks?: string[];
    confidence?: number;
    sources?: string[];
    type?: 'analysis' | 'news' | 'recommendation' | 'general';
  };
}

export interface AIAnalysis {
  symbol: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  keyPoints: string[];
  riskFactors: string[];
  technicalAnalysis?: {
    trend: string;
    support: number;
    resistance: number;
    signals: string[];
  };
  fundamentalAnalysis?: {
    valuation: string;
    growth: string;
    profitability: string;
    financialHealth: string;
  };
}

export interface AIPersonality {
  id: 'conservative' | 'balanced' | 'aggressive';
  name: string;
  description: string;
  riskTolerance: number;
  analysisStyle: string;
  communicationStyle: string;
}

export interface AICapability {
  id: string;
  name: string;
  description: string;
  examples: string[];
  category: 'analysis' | 'research' | 'education' | 'strategy';
}