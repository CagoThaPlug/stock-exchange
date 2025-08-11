export interface MarketStatus {
  isOpen: boolean;
  nextOpen?: string;
  nextClose?: string;
  timezone: string;
}

export interface MarketNews {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevantSymbols: string[];
  category: string;
  imageUrl?: string;
}

export interface EconomicEvent {
  id: string;
  title: string;
  date: string;
  importance: 'low' | 'medium' | 'high';
  country: string;
  currency: string;
  previous?: string;
  forecast?: string;
  actual?: string;
}

export interface MarketMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  reason?: string;
  category: 'gainers' | 'losers' | 'active';
}