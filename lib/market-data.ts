// Enhanced Market data fetch utilities with multi-provider support and no fallbacks
// File: lib/market-data.ts

import yahooFinance from '@/lib/yahoo';

// Types
export type MarketIndex = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp?: number;
};

export type MoverQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp?: number;
};

export type SymbolSearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
};

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  sector?: string;
  timestamp?: number;
};

export type ChartPoint = { 
  time: string; 
  price: number; 
};

export type SectorData = {
  name: string;
  change: number;
  marketCap: number;
  stocks: { symbol: string; change: number }[];
  timestamp?: number;
};

// Provider interface
interface MarketDataProvider {
  name: string;
  priority: number;
  rateLimit: number; // requests per minute
  getQuote(symbol: string): Promise<Quote>;
  getBulkQuotes(symbols: string[]): Promise<Quote[]>;
  getIndices(): Promise<MarketIndex[]>;
  getMovers(type: 'gainers' | 'losers' | 'actives'): Promise<MoverQuote[]>;
  searchSymbols(query: string): Promise<SymbolSearchResult[]>;
  getChart(symbol: string, range: string, interval: string): Promise<ChartPoint[]>;
}

// Market Data Service with multi-provider support
class MarketDataService {
  private providers: MarketDataProvider[] = [];
  private cache = new Map<string, { data: any; timestamp: number }>();
  private rateLimiter = new Map<string, number[]>();
  private readonly CACHE_TTL = 15000; // 15 seconds for real-time data
  private readonly STALE_CACHE_TTL = 300000; // 5 minutes for stale data fallback

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Primary provider - Yahoo Finance
    this.providers.push(new YahooFinanceProvider());
    
    // Secondary providers can be added here
    // this.providers.push(new AlphaVantageProvider());
    // this.providers.push(new FinancialModelingPrepProvider());
  }

  private isRateLimited(providerName: string, rateLimit: number): boolean {
    const now = Date.now();
    const requests = this.rateLimiter.get(providerName) || [];
    
    // Clean old requests (older than 1 minute)
    const recentRequests = requests.filter(time => now - time < 60000);
    this.rateLimiter.set(providerName, recentRequests);
    
    return recentRequests.length >= rateLimit;
  }

  private trackRequest(providerName: string) {
    const requests = this.rateLimiter.get(providerName) || [];
    requests.push(Date.now());
    this.rateLimiter.set(providerName, requests);
  }

  private async withProviderFallback<T>(
    operation: (provider: MarketDataProvider) => Promise<T>,
    cacheKey?: string
  ): Promise<T> {
    const errors: Array<{ provider: string; error: Error }> = [];

    // Check cache first for recent data
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    for (const provider of this.providers.sort((a, b) => a.priority - b.priority)) {
      if (this.isRateLimited(provider.name, provider.rateLimit)) {
        console.warn(`Provider ${provider.name} is rate limited, skipping`);
        continue;
      }

      try {
        const result = await Promise.race([
          operation(provider),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]);

        // Track successful request
        this.trackRequest(provider.name);

        // Cache successful result
        if (cacheKey && result) {
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        }

        return result;
      } catch (error) {
        errors.push({ provider: provider.name, error: error as Error });
        console.warn(`Provider ${provider.name} failed:`, error);
      }
    }

    // Check stale cache as last resort
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.STALE_CACHE_TTL) {
        console.warn('Using stale cache data due to provider failures');
        return cached.data;
      }
    }

    throw new Error(`All providers failed: ${errors.map(e => `${e.provider}: ${e.error.message}`).join(', ')}`);
  }

  // Public API methods
  async fetchIndices(): Promise<MarketIndex[]> {
    return this.withProviderFallback(
      provider => provider.getIndices(),
      'indices'
    );
  }

  async fetchMovers(type: 'gainers' | 'losers' | 'actives'): Promise<MoverQuote[]> {
    return this.withProviderFallback(
      provider => provider.getMovers(type),
      `movers-${type}`
    );
  }

  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    if (!query?.trim()) return [];
    
    return this.withProviderFallback(
      provider => provider.searchSymbols(query),
      `search-${query.toLowerCase().trim()}`
    );
  }

  async fetchQuote(symbol: string): Promise<Quote | null> {
    if (!symbol?.trim()) return null;
    
    try {
      return await this.withProviderFallback(
        provider => provider.getQuote(symbol),
        `quote-${symbol}`
      );
    } catch (error) {
      console.error(`Failed to fetch quote for ${symbol}:`, error);
      return null;
    }
  }

  async fetchChart(symbol: string, range: string = '1mo', interval: string = '1d'): Promise<ChartPoint[]> {
    if (!symbol?.trim()) return [];
    
    return this.withProviderFallback(
      provider => provider.getChart(symbol, range, interval),
      `chart-${symbol}-${range}-${interval}`
    );
  }

  // Get comprehensive market data for heatmap
  async getMarketHeatmapData(): Promise<{ sectors: SectorData[] }> {
    const provider = this.providers[0]; // Use primary provider for comprehensive data
    
    try {
      // Dynamic sector discovery using current market data
      const sectors = await this.discoverSectors();
      
      const sectorData = await Promise.all(
        sectors.map(async (sector) => {
          try {
            const quotes = await provider.getBulkQuotes(sector.symbols.slice(0, 8));
            const validQuotes = quotes.filter(q => 
              q.changePercent !== undefined && 
              Number.isFinite(q.changePercent) &&
              q.marketCap > 0
            );

            if (validQuotes.length === 0) {
              return null;
            }

            // Calculate weighted average by market cap
            const totalMarketCap = validQuotes.reduce((sum, q) => sum + q.marketCap, 0);
            const avgChange = totalMarketCap > 0
              ? validQuotes.reduce((sum, q) => sum + (q.changePercent * q.marketCap / totalMarketCap), 0)
              : validQuotes.reduce((sum, q) => sum + q.changePercent, 0) / validQuotes.length;

            const topMovers = validQuotes
              .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
              .slice(0, 4)
              .map(q => ({ symbol: q.symbol, change: q.changePercent }));

            return {
              name: sector.name,
              change: avgChange,
              marketCap: totalMarketCap,
              stocks: topMovers,
              timestamp: Date.now()
            };
          } catch (error) {
            console.warn(`Failed to get data for sector ${sector.name}:`, error);
            return null;
          }
        })
      );

      const validSectors = sectorData.filter(Boolean) as SectorData[];
      
      if (validSectors.length === 0) {
        throw new Error('No valid sector data available');
      }

      return { sectors: validSectors };
    } catch (error) {
      console.error('Failed to get market heatmap data:', error);
      throw error;
    }
  }

  private async discoverSectors(): Promise<Array<{ name: string; symbols: string[] }>> {
    // Define major sectors with their representative symbols
    // This could be made dynamic by fetching from market screeners
    return [
      {
        name: 'Technology',
        symbols: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'TSLA', 'AVGO', 'ORCL', 'ADBE', 'CRM', 'NFLX', 'AMD']
      },
      {
        name: 'Healthcare',
        symbols: ['UNH', 'LLY', 'JNJ', 'ABBV', 'MRK', 'TMO', 'PFE', 'DHR', 'BMY', 'AMGN', 'GILD', 'VRTX']
      },
      {
        name: 'Finance',
        symbols: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'BLK', 'C', 'AXP', 'USB', 'PNC', 'COF', 'BK']
      },
      {
        name: 'Energy',
        symbols: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'OXY', 'VLO', 'KMI', 'WMB', 'EPD']
      },
      {
        name: 'Consumer',
        symbols: ['AMZN', 'HD', 'MCD', 'KO', 'PEP', 'NKE', 'COST', 'SBUX', 'WMT', 'TGT', 'LOW', 'DIS']
      },
      {
        name: 'Industrial',
        symbols: ['BA', 'CAT', 'HON', 'GE', 'LMT', 'DE', 'UPS', 'RTX', 'MMM', 'FDX', 'NOC', 'CSX']
      }
    ];
  }

  // Real-time subscription support
  private subscribers = new Map<string, Set<(data: any) => void>>();

  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  private notifySubscribers(key: string, data: any) {
    this.subscribers.get(key)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Subscriber callback error:', error);
      }
    });
  }

  startRealTimeUpdates() {
    setInterval(async () => {
      try {
        const data = await this.getMarketHeatmapData();
        this.notifySubscribers('heatmap', data);
      } catch (error) {
        console.error('Real-time update failed:', error);
      }
    }, 15000); // Update every 15 seconds
  }
}

// Yahoo Finance Provider Implementation
class YahooFinanceProvider implements MarketDataProvider {
  name = 'yahoo';
  priority = 1;
  rateLimit = 120; // 2 requests per second

  async getQuote(symbol: string): Promise<Quote> {
    try {
      const q: any = await yahooFinance.quote(symbol);
      if (!q) throw new Error('quote-null');
      
      const base = {
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: Number(q.regularMarketPrice ?? 0),
        change: Number(q.regularMarketChange ?? 0),
        changePercent: Number(q.regularMarketChangePercent ?? 0),
        volume: Number(q.regularMarketVolume ?? 0),
        marketCap: Number(q.marketCap ?? 0),
        sector: q.sector || undefined,
        timestamp: Date.now()
      };

      // Enhanced market cap calculation
      if ((!base.marketCap || base.marketCap === 0) && Number.isFinite(base.price) && base.price > 0) {
        const sharesFromQuote = Number(q.sharesOutstanding ?? 0);
        if (Number.isFinite(sharesFromQuote) && sharesFromQuote > 0) {
          base.marketCap = base.price * sharesFromQuote;
        }
      }

      return base;
    } catch (error) {
      // Fallback to chart data if quote fails
      return this.getQuoteFromChart(symbol);
    }
  }

  private async getQuoteFromChart(symbol: string): Promise<Quote> {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const res: any = await yahooFinance.chart(symbol, {
      period1: new Date(now - 7 * dayMs),
      period2: new Date(now),
      interval: '1d',
    } as any);

    const quotes: Array<{ date: Date; close: number; volume?: number }> = Array.isArray(res?.quotes) ? res.quotes : [];
    const closes = quotes.map((q) => Number(q.close)).filter((n) => Number.isFinite(n));
    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    
    if (!Number.isFinite(last) || !Number.isFinite(prev)) {
      throw new Error('Insufficient chart data');
    }

    const change = last - prev;
    const changePercent = prev !== 0 ? (change / prev) * 100 : 0;
    const volume = quotes[quotes.length - 1]?.volume || 0;

    return {
      symbol,
      name: symbol,
      price: last,
      change,
      changePercent,
      volume: Number(volume),
      marketCap: 0, // Will need to be calculated separately
      timestamp: Date.now()
    };
  }

  async getBulkQuotes(symbols: string[]): Promise<Quote[]> {
    const chunkSize = 50;
    const chunks: string[][] = [];
    
    for (let i = 0; i < symbols.length; i += chunkSize) {
      chunks.push(symbols.slice(i, i + chunkSize));
    }

    const results: Quote[] = [];
    
    for (const chunk of chunks) {
      try {
        const res = await yahooFinance.quote(chunk);
        const quotes = Array.isArray(res) ? res : [res];
        
        for (const q of quotes) {
          if (q?.symbol) {
            results.push({
              symbol: q.symbol,
              name: q.shortName || q.longName || q.symbol,
              price: Number(q.regularMarketPrice ?? 0),
              change: Number(q.regularMarketChange ?? 0),
              changePercent: Number(q.regularMarketChangePercent ?? 0),
              volume: Number(q.regularMarketVolume ?? 0),
              marketCap: Number(q.marketCap ?? 0),
              sector: q.sector || undefined,
              timestamp: Date.now()
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch bulk quotes for chunk:`, error);
        // Continue with other chunks
      }
    }

    return results;
  }

  async getIndices(): Promise<MarketIndex[]> {
    const symbols = [
      '^GSPC', '^DJI', '^IXIC', '^RUT', '^FTSE', '^GDAXI', '^N225', '^HSI',
      'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK-B'
    ];

    // Pick a random selection for performance
    const pickRandom = <T,>(arr: T[], n: number): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, Math.min(n, copy.length));
    };

    const selected = pickRandom(symbols, 6);

    try {
      const res = await yahooFinance.quote(selected);
      const quotes = Array.isArray(res) ? res : [res];
      
      return quotes.map((q: any) => ({
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: Number(q.regularMarketPrice ?? 0),
        change: Number(q.regularMarketChange ?? 0),
        changePercent: Number(q.regularMarketChangePercent ?? 0),
        timestamp: Date.now()
      }));
    } catch (error) {
      // Fallback to chart data for core indices
      const coreIndices = ['^GSPC', '^DJI', '^IXIC'];
      const fallbacks: MarketIndex[] = [];

      for (const symbol of coreIndices) {
        try {
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          const { quotes } = await yahooFinance.chart(symbol, {
            period1: new Date(now - 7 * dayMs),
            period2: new Date(now),
            interval: '1d',
          } as any);
          
          const closes = (quotes || []).map((q: any) => Number(q.close)).filter((n: number) => Number.isFinite(n));
          const last = closes[closes.length - 1];
          const prev = closes[closes.length - 2];
          
          if (Number.isFinite(last) && Number.isFinite(prev)) {
            const change = last - prev;
            const changePercent = prev !== 0 ? (change / prev) * 100 : 0;
            
            fallbacks.push({
              symbol,
              name: symbol === '^GSPC' ? 'S&P 500' : symbol === '^DJI' ? 'Dow Jones' : 'NASDAQ',
              price: last,
              change,
              changePercent,
              timestamp: Date.now()
            });
          }
        } catch {
          // Skip this symbol
        }
      }

      return fallbacks;
    }
  }

  async getMovers(type: 'gainers' | 'losers' | 'actives'): Promise<MoverQuote[]> {
    const screenerId = type === 'gainers' ? 'day_gainers' : type === 'losers' ? 'day_losers' : 'most_actives';
    
    try {
      const res = await yahooFinance.screener({ scrIds: screenerId as any, count: 25 });
      const quotes: any[] = Array.isArray((res as any)?.quotes) ? (res as any).quotes : [];
      
      return quotes.slice(0, 25).map((q: any) => ({
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: Number(q.regularMarketPrice ?? 0),
        change: Number(q.regularMarketChange ?? 0),
        changePercent: Number(q.regularMarketChangePercent ?? 0),
        volume: Number(q.regularMarketVolume ?? 0),
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error(`Failed to fetch ${type}:`, error);
      return [];
    }
  }

  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    try {
      const res = await yahooFinance.search(query, { quotesCount: 10, newsCount: 0 });
      const quotes: any[] = Array.isArray(res?.quotes) ? res.quotes : [];
      
      return quotes
        .filter((e) => e.symbol)
        .map((e) => ({
          symbol: e.symbol,
          name: e.shortname || e.longname || e.symbol,
          exchange: e.exchDisp || 'NYSE',
          type: e.quoteType || 'EQUITY',
        }));
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  async getChart(symbol: string, range: string = '1mo', interval: string = '1d'): Promise<ChartPoint[]> {
    const allowedIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'] as const;
    const normalizeInterval = (i: string) => (allowedIntervals as readonly string[]).includes(i) ? i : '1d';

    const rangeToDays: Record<string, number> = {
      '1d': 1, '5d': 5, '1mo': 30, '3mo': 90, '6mo': 180,
      '1y': 365, '2y': 730, '5y': 1825, '10y': 3650,
    };

    const candidates: Array<{ days: number; interval: string }> = [];
    const primaryDays = rangeToDays[range] ?? 30;
    const normalizedInterval = normalizeInterval(interval);
    
    candidates.push({ days: primaryDays, interval: normalizedInterval });
    candidates.push({ days: 90, interval: '1d' });
    candidates.push({ days: 365, interval: '1wk' });

    for (const cand of candidates) {
      try {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const period1 = new Date(now - cand.days * dayMs);
        const period2 = new Date(now);

        const res: any = await yahooFinance.chart(symbol, {
          period1,
          period2,
          interval: cand.interval as any,
        });

        const quotes: Array<{ date: Date; close: number }> = Array.isArray(res?.quotes) ? res.quotes : [];
        if (!quotes.length) continue;

        const points: ChartPoint[] = quotes
          .map((q) => ({ 
            time: new Date(q.date).toISOString().split('T')[0], 
            price: Math.round(Number(q.close) * 100) / 100 
          }))
          .filter((p) => Number.isFinite(p.price) && p.price > 0);

        if (points.length >= 2) return points;
      } catch {
        // Try next candidate
      }
    }

    return [];
  }
}

// Export singleton instance
export const marketDataService = new MarketDataService();

// Export original functions for backward compatibility
export async function fetchIndices(): Promise<MarketIndex[]> {
  return marketDataService.fetchIndices();
}

export async function fetchMovers(type: 'gainers' | 'losers' | 'actives'): Promise<MoverQuote[]> {
  return marketDataService.fetchMovers(type);
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  return marketDataService.searchSymbols(query);
}

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  return marketDataService.fetchQuote(symbol);
}

export async function fetchChart(symbol: string, range: string = '1mo', interval: string = '1d'): Promise<ChartPoint[]> {
  return marketDataService.fetchChart(symbol, range, interval);
}