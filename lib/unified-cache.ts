// Client-side cache manager for unified market data
// File: lib/unified-cache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

interface CacheConfig {
  ttl: number; // time to live in milliseconds
  maxSize: number; // maximum number of entries
  staleWhileRevalidate: number; // time to serve stale data while revalidating
}

class UnifiedCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;
  private revalidationPromises = new Map<string, Promise<T>>();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttl: 15000, // 15 seconds default
      maxSize: 100,
      staleWhileRevalidate: 60000, // 1 minute
      ...config
    };
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age < this.config.ttl) {
      // Fresh data
      return entry.data;
    }

    if (age < this.config.staleWhileRevalidate) {
      // Stale but acceptable data
      return entry.data;
    }

    // Too old, remove and return null
    this.cache.delete(key);
    return null;
  }

  set(key: string, data: T, etag?: string): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag
    });
  }

  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;

    const age = Date.now() - entry.timestamp;
    return age >= this.config.ttl;
  }

  isExpired(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;

    const age = Date.now() - entry.timestamp;
    return age >= this.config.staleWhileRevalidate;
  }

  getEtag(key: string): string | undefined {
    return this.cache.get(key)?.etag;
  }

  clear(): void {
    this.cache.clear();
    this.revalidationPromises.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.revalidationPromises.delete(key);
  }

  // Get data with automatic revalidation
  async getWithRevalidation<U extends T>(
    key: string,
    fetcher: () => Promise<U>,
    forceRefresh = false
  ): Promise<U> {
    const cached = this.get(key);
    
    // Return fresh data immediately
    if (cached && !forceRefresh && !this.isStale(key)) {
      return cached as U;
    }

    // Check if revalidation is already in progress
    const existingPromise = this.revalidationPromises.get(key);
    if (existingPromise && !forceRefresh) {
      return existingPromise as Promise<U>;
    }

    // Start revalidation
    const revalidationPromise = fetcher().then(newData => {
      this.set(key, newData);
      this.revalidationPromises.delete(key);
      return newData;
    }).catch(error => {
      this.revalidationPromises.delete(key);
      throw error;
    });

    this.revalidationPromises.set(key, revalidationPromise);

    // If we have stale data and no force refresh, return it while revalidating
    if (cached && !forceRefresh && !this.isExpired(key)) {
      revalidationPromise.catch(() => {}); // Silence unhandled promise rejection
      return cached as U;
    }

    // Otherwise wait for fresh data
    return revalidationPromise;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let fresh = 0;
    let stale = 0;
    let expired = 0;

    for (const [, entry] of this.cache) {
      const age = now - entry.timestamp;
      if (age < this.config.ttl) {
        fresh++;
      } else if (age < this.config.staleWhileRevalidate) {
        stale++;
      } else {
        expired++;
      }
    }

    return {
      total: this.cache.size,
      fresh,
      stale,
      expired,
      hitRate: this.cache.size > 0 ? (fresh + stale) / this.cache.size : 0
    };
  }
}

// Global cache instances
export const marketDataCache = new UnifiedCache({
  ttl: 15000, // 15 seconds for market data
  maxSize: 50,
  staleWhileRevalidate: 60000 // 1 minute
});

export const quoteCache = new UnifiedCache({
  ttl: 5000, // 5 seconds for individual quotes
  maxSize: 100,
  staleWhileRevalidate: 30000 // 30 seconds
});

export const sectorCache = new UnifiedCache({
  ttl: 30000, // 30 seconds for sector data
  maxSize: 20,
  staleWhileRevalidate: 120000 // 2 minutes
});

// Cache key generators
export const getCacheKey = {
  unified: (sections?: string[]) => 
    `unified:${sections?.sort().join(',') || 'all'}`,
  
  heatmap: () => 'heatmap',
  
  indices: () => 'indices',
  
  movers: (type?: string) => 
    `movers:${type || 'all'}`,
  
  quote: (symbol: string) => 
    `quote:${symbol.toUpperCase()}`,
  
  quotes: (symbols: string[]) => 
    `quotes:${symbols.sort().join(',')}`,
  
  search: (query: string) => 
    `search:${query.toLowerCase()}`,
  
  chart: (symbol: string, range: string, interval: string) => 
    `chart:${symbol.toUpperCase()}:${range}:${interval}`
};

// Cache warming strategies
export class CacheWarmer {
  private static instance: CacheWarmer;
  private warmingInterval: NodeJS.Timeout | null = null;

  static getInstance(): CacheWarmer {
    if (!this.instance) {
      this.instance = new CacheWarmer();
    }
    return this.instance;
  }

  startWarming(options: {
    enabled?: boolean;
    interval?: number;
    symbols?: string[];
  } = {}) {
    if (!options.enabled) return;

    const interval = options.interval || 60000; // 1 minute
    const symbols = options.symbols || ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];

    this.warmingInterval = setInterval(async () => {
      try {
        // Warm unified data cache
        const unifiedKey = getCacheKey.unified();
        if (marketDataCache.isStale(unifiedKey)) {
          // Trigger background refresh
          this.warmUnifiedData().catch(console.warn);
        }

        // Warm popular quotes
        for (const symbol of symbols) {
          const quoteKey = getCacheKey.quote(symbol);
          if (quoteCache.isStale(quoteKey)) {
            this.warmQuote(symbol).catch(console.warn);
          }
        }
      } catch (error) {
        console.warn('Cache warming failed:', error);
      }
    }, interval);
  }

  stopWarming() {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
    }
  }

  private async warmUnifiedData() {
    try {
      const response = await fetch('/api/market/unified');
      if (response.ok) {
        const data = await response.json();
        marketDataCache.set(getCacheKey.unified(), data);
      }
    } catch (error) {
      console.warn('Failed to warm unified data:', error);
    }
  }

  private async warmQuote(symbol: string) {
    try {
      const response = await fetch('/api/market/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: [symbol] })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.quotes?.[symbol]) {
          quoteCache.set(getCacheKey.quote(symbol), data.quotes[symbol]);
        }
      }
    } catch (error) {
      console.warn(`Failed to warm quote for ${symbol}:`, error);
    }
  }
}

// Performance monitoring
export class CacheMetrics {
  private static metrics = {
    hits: 0,
    misses: 0,
    revalidations: 0,
    errors: 0
  };

  static recordHit() {
    this.metrics.hits++;
  }

  static recordMiss() {
    this.metrics.misses++;
  }

  static recordRevalidation() {
    this.metrics.revalidations++;
  }

  static recordError() {
    this.metrics.errors++;
  }

  static getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
      total
    };
  }

  static reset() {
    this.metrics = { hits: 0, misses: 0, revalidations: 0, errors: 0 };
  }
}

export default UnifiedCache;
