// Enhanced Real-time Market Data Service
// File: lib/market-data-service.ts

interface MarketDataProvider {
    name: string;
    priority: number;
    rateLimit: number; // requests per minute
    getQuote(symbol: string): Promise<Quote>;
    getBulkQuotes(symbols: string[]): Promise<Quote[]>;
    getSectorData(): Promise<SectorInfo[]>;
  }
  
  interface Quote {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap?: number;
    timestamp: number;
  }
  
  interface SectorInfo {
    name: string;
    symbols: string[];
    marketCap: number;
  }
  
  class MarketDataService {
    private providers: MarketDataProvider[] = [];
    private cache = new Map<string, { data: any; timestamp: number }>();
    private rateLimiter = new Map<string, number[]>();
    private readonly CACHE_TTL = 15000; // 15 seconds for real-time data
  
    constructor() {
      this.initializeProviders();
    }
  
    private initializeProviders() {
      // Primary provider - Yahoo Finance
      this.providers.push({
        name: 'yahoo',
        priority: 1,
        rateLimit: 120, // 2 requests per second
        getQuote: this.getYahooQuote.bind(this),
        getBulkQuotes: this.getYahooBulkQuotes.bind(this),
        getSectorData: this.getYahooSectorData.bind(this)
      });
  
      // Secondary provider - Alpha Vantage
      this.providers.push({
        name: 'alphavantage',
        priority: 2,
        rateLimit: 5, // 5 requests per minute (free tier)
        getQuote: this.getAlphaVantageQuote.bind(this),
        getBulkQuotes: this.getAlphaVantageBulkQuotes.bind(this),
        getSectorData: this.getAlphaVantageSectorData.bind(this)
      });
  
      // Tertiary provider - Financial Modeling Prep
      this.providers.push({
        name: 'fmp',
        priority: 3,
        rateLimit: 250, // 250 requests per day (free tier)
        getQuote: this.getFMPQuote.bind(this),
        getBulkQuotes: this.getFMPBulkQuotes.bind(this),
        getSectorData: this.getFMPSectorData.bind(this)
      });
    }
  
    private isRateLimited(providerName: string, rateLimit: number): boolean {
      const now = Date.now();
      const requests = this.rateLimiter.get(providerName) || [];
      
      // Clean old requests (older than 1 minute)
      const recentRequests = requests.filter(time => now - time < 60000);
      this.rateLimiter.set(providerName, recentRequests);
      
      return recentRequests.length >= rateLimit;
    }
  
    private async withFallback<T>(
      operation: (provider: MarketDataProvider) => Promise<T>,
      cacheKey?: string
    ): Promise<T> {
      const errors: Array<{ provider: string; error: Error }> = [];
  
      for (const provider of this.providers.sort((a, b) => a.priority - b.priority)) {
        if (this.isRateLimited(provider.name, provider.rateLimit)) {
          continue;
        }
  
        try {
          const result = await Promise.race([
            operation(provider),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            )
          ]);
  
          // Track successful request
          const requests = this.rateLimiter.get(provider.name) || [];
          requests.push(Date.now());
          this.rateLimiter.set(provider.name, requests);
  
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
  
      // Check cache as last resort
      if (cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL * 3) {
          console.warn('Using stale cache data due to provider failures');
          return cached.data;
        }
      }
  
      throw new Error(`All providers failed: ${errors.map(e => `${e.provider}: ${e.error.message}`).join(', ')}`);
    }
  
    // Yahoo Finance implementation
    private async getYahooQuote(symbol: string): Promise<Quote> {
      const yahooFinance = (await import('./yahoo')).default;
      const result = await yahooFinance.quote(symbol);
      
      return {
        symbol: result.symbol,
        price: result.regularMarketPrice || result.price || 0,
        change: result.regularMarketChange || 0,
        changePercent: result.regularMarketChangePercent || 0,
        volume: result.regularMarketVolume || 0,
        marketCap: result.marketCap,
        timestamp: Date.now()
      };
    }
  
    private async getYahooBulkQuotes(symbols: string[]): Promise<Quote[]> {
      const yahooFinance = (await import('./yahoo')).default;
      const results = await yahooFinance.quote(symbols);
      const quotes = Array.isArray(results) ? results : [results];
      
      return quotes.map(result => ({
        symbol: result.symbol,
        price: result.regularMarketPrice || result.price || 0,
        change: result.regularMarketChange || 0,
        changePercent: result.regularMarketChangePercent || 0,
        volume: result.regularMarketVolume || 0,
        marketCap: result.marketCap,
        timestamp: Date.now()
      }));
    }
  
    private async getYahooSectorData(): Promise<SectorInfo[]> {
      // Dynamic sector discovery using market screener
      const yahooFinance = (await import('./yahoo')).default;
      
      // Get S&P 500 components and categorize by sector
      const sp500Response = await fetch('https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000');
      const sp500Data = await sp500Response.json();
      
      const sectorMap = new Map<string, string[]>();
      const sectorMarketCaps = new Map<string, number>();
      
      for (const ticker of sp500Data.results || []) {
        if (ticker.primary_exchange === 'XNAS' || ticker.primary_exchange === 'XNYS') {
          const sector = ticker.sic_description || 'Other';
          const symbols = sectorMap.get(sector) || [];
          symbols.push(ticker.ticker);
          sectorMap.set(sector, symbols);
          
          // Accumulate market cap estimates
          const currentCap = sectorMarketCaps.get(sector) || 0;
          sectorMarketCaps.set(sector, currentCap + (ticker.market_cap || 0));
        }
      }
  
      return Array.from(sectorMap.entries()).map(([name, symbols]) => ({
        name,
        symbols: symbols.slice(0, 20), // Limit to top 20 per sector
        marketCap: sectorMarketCaps.get(name) || 0
      }));
    }
  
    // Alpha Vantage implementation
    private async getAlphaVantageQuote(symbol: string): Promise<Quote> {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) throw new Error('Alpha Vantage API key not configured');
  
      const response = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
      );
      const data = await response.json();
      const quote = data['Global Quote'];
  
      return {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        volume: parseInt(quote['06. volume']),
        timestamp: Date.now()
      };
    }
  
    private async getAlphaVantageBulkQuotes(symbols: string[]): Promise<Quote[]> {
      // Alpha Vantage doesn't support bulk quotes, so we'll do individual requests
      // with rate limiting
      const quotes: Quote[] = [];
      
      for (const symbol of symbols.slice(0, 5)) { // Limit due to rate limiting
        try {
          const quote = await this.getAlphaVantageQuote(symbol);
          quotes.push(quote);
          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 12000)); // 5 requests per minute
        } catch (error) {
          console.warn(`Failed to get Alpha Vantage quote for ${symbol}:`, error);
        }
      }
      
      return quotes;
    }
  
    private async getAlphaVantageSectorData(): Promise<SectorInfo[]> {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) throw new Error('Alpha Vantage API key not configured');
  
      const response = await fetch(
        `https://www.alphavantage.co/query?function=SECTOR&apikey=${apiKey}`
      );
      const data = await response.json();
      
      // This is a simplified implementation - you'd need to map sector performance to actual symbols
      return Object.keys(data['Rank A: Real-Time Performance'] || {}).map(sector => ({
        name: sector,
        symbols: [], // Would need additional API calls to get sector constituents
        marketCap: 0
      }));
    }
  
    // Financial Modeling Prep implementation
    private async getFMPQuote(symbol: string): Promise<Quote> {
      const apiKey = process.env.FMP_API_KEY;
      if (!apiKey) throw new Error('FMP API key not configured');
  
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${apiKey}`
      );
      const data = await response.json();
      const quote = data[0];
  
      return {
        symbol: quote.symbol,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changesPercentage,
        volume: quote.volume,
        marketCap: quote.marketCap,
        timestamp: Date.now()
      };
    }
  
    private async getFMPBulkQuotes(symbols: string[]): Promise<Quote[]> {
      const apiKey = process.env.FMP_API_KEY;
      if (!apiKey) throw new Error('FMP API key not configured');
  
      const symbolList = symbols.join(',');
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/quote/${symbolList}?apikey=${apiKey}`
      );
      const data = await response.json();
  
      return data.map((quote: any) => ({
        symbol: quote.symbol,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changesPercentage,
        volume: quote.volume,
        marketCap: quote.marketCap,
        timestamp: Date.now()
      }));
    }
  
    private async getFMPSectorData(): Promise<SectorInfo[]> {
      const apiKey = process.env.FMP_API_KEY;
      if (!apiKey) throw new Error('FMP API key not configured');
  
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/sector-performance?apikey=${apiKey}`
      );
      const data = await response.json();
  
      return data.map((sector: any) => ({
        name: sector.sector,
        symbols: [], // Would need additional API call for constituents
        marketCap: 0
      }));
    }
  
    // Public API methods
    async getMarketHeatmapData(): Promise<{ sectors: any[] }> {
      try {
        // Get dynamic sector data
        const sectors = await this.withFallback(
          provider => provider.getSectorData(),
          'sectors'
        );
  
        const sectorData = await Promise.all(
          sectors.map(async (sector) => {
            try {
              const quotes = await this.withFallback(
                provider => provider.getBulkQuotes(sector.symbols),
                `sector-${sector.name}`
              );
  
              const validQuotes = quotes.filter(q => q.changePercent !== undefined);
              
              if (validQuotes.length === 0) {
                return null; // Skip sectors with no valid data
              }
  
              const totalMarketCap = validQuotes.reduce((sum, q) => sum + (q.marketCap || 0), 0);
              
              // Calculate weighted average if market caps are available, otherwise simple average
              const avgChange = totalMarketCap > 0
                ? validQuotes.reduce((sum, q) => sum + (q.changePercent * (q.marketCap || 0) / totalMarketCap), 0)
                : validQuotes.reduce((sum, q) => sum + q.changePercent, 0) / validQuotes.length;
  
              const topMovers = validQuotes
                .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
                .slice(0, 4)
                .map(q => ({ symbol: q.symbol, change: q.changePercent }));
  
              return {
                name: sector.name,
                change: avgChange,
                marketCap: totalMarketCap || sector.marketCap,
                stocks: topMovers
              };
            } catch (error) {
              console.warn(`Failed to get data for sector ${sector.name}:`, error);
              return null;
            }
          })
        );
  
        return {
          sectors: sectorData.filter(Boolean) // Remove null entries
        };
      } catch (error) {
        console.error('Failed to get market heatmap data:', error);
        throw error;
      }
    }
  
    async getQuote(symbol: string): Promise<Quote> {
      return this.withFallback(
        provider => provider.getQuote(symbol),
        `quote-${symbol}`
      );
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
  
  export const marketDataService = new MarketDataService();