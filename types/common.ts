// Common type definitions used across the application
// File: types/common.ts

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  sector?: string;
  timestamp?: number;
}

export interface ChartDataPoint {
  time: string;
  price: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
}

export interface SectorData {
  name: string;
  change: number;
  marketCap: number;
  stocks: { symbol: string; change: number }[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevantStocks: string[];
  category: string;
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpen?: string;
  nextClose?: string;
  timezone: string;
}

// Utility types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}
