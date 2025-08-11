export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  sector?: string;
  industry?: string;
  pe?: number;
  dividend?: number;
}

export interface StockChart {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface SectorPerformance {
  name: string;
  change: number;
  changePercent: number;
  marketCap: number;
  stocks: StockQuote[];
}

export interface TechnicalIndicators {
  symbol: string;
  rsi: number;
  macd: number;
  signal: number;
  bollingerUpper: number;
  bollingerLower: number;
  sma50: number;
  sma200: number;
}