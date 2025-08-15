import { useState, useEffect, useCallback, useRef } from 'react';
import { marketDataCache, getCacheKey, CacheMetrics } from '@/lib/unified-cache';

interface MarketData {
  heatmap: {
    sectors: any[];
  };
  indices: any[];
  movers: {
    gainers: any[];
    losers: any[];
    actives: any[];
  };
  quotes: Record<string, any>;
  lastUpdated: string;
  marketStatus: {
    isOpen: boolean;
    nextOpen?: string;
    nextClose?: string;
  };
  error?: string;
}

interface UseUnifiedMarketDataOptions {
  enableRealTime?: boolean;
  updateInterval?: number;
  sections?: ('heatmap' | 'indices' | 'movers')[];
}

interface UseUnifiedMarketDataReturn {
  data: MarketData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getQuote: (symbol: string) => Promise<any>;
  getBulkQuotes: (symbols: string[]) => Promise<Record<string, any>>;
  lastFetchTime: number;
}

const DEFAULT_OPTIONS: UseUnifiedMarketDataOptions = {
  enableRealTime: true,
  updateInterval: 30000, // 30 seconds
  sections: ['heatmap', 'indices', 'movers']
};

export function useUnifiedMarketData(
  options: UseUnifiedMarketDataOptions = {}
): UseUnifiedMarketDataReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const incrementalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Import utils dynamically to avoid SSR issues
  const getApiFetch = useCallback(async () => {
    const { apiFetch } = await import('@/lib/utils');
    return apiFetch;
  }, []);

  // Initial data fetch with caching
  const fetchFullData = useCallback(async () => {
    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const apiFetch = await getApiFetch();
      
      const cacheKey = getCacheKey.unified(opts.sections);
      
      // Try cache first
      const cachedData = marketDataCache.get(cacheKey);
      if (cachedData && !marketDataCache.isStale(cacheKey)) {
        setData(cachedData);
        setError(null);
        setLastFetchTime(Date.now());
        CacheMetrics.recordHit();
        return cachedData;
      }

      CacheMetrics.recordMiss();
      
      const debug = process.env.NEXT_PUBLIC_API_DEBUG ? '?debug=1' : '';
      const response = await apiFetch(`/api/market/unified${debug}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          ...(marketDataCache.getEtag(cacheKey) && {
            'If-None-Match': marketDataCache.getEtag(cacheKey)
          })
        }
      });

      if (response.status === 304) {
        // Not modified, use cached data
        if (cachedData) {
          setData(cachedData);
          setError(null);
          setLastFetchTime(Date.now());
          return cachedData;
        }
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const marketData = await response.json();
      
      // Cache the fresh data
      const etag = response.headers.get('etag');
      marketDataCache.set(cacheKey, marketData, etag || undefined);
      
      setData(marketData);
      setError(marketData.error || null);
      setLastFetchTime(Date.now());
      
      return marketData;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Request was cancelled
      }
      
      console.error('Full market data fetch error:', err);
      CacheMetrics.recordError();
      
      // Try to use stale cache data as fallback
      const cacheKey = getCacheKey.unified(opts.sections);
      const staleData = marketDataCache.get(cacheKey);
      if (staleData) {
        setData(staleData);
        setError('Using cached data due to network error');
        setLastFetchTime(Date.now());
        return staleData;
      }
      
      setError(err.message || 'Failed to fetch market data');
      throw err;
    }
  }, [getApiFetch, opts.sections]);

  // Incremental update for specific sections
  const fetchIncrementalUpdate = useCallback(async (section: string) => {
    try {
      const apiFetch = await getApiFetch();
      const debug = process.env.NEXT_PUBLIC_API_DEBUG ? '&debug=1' : '';
      
      const response = await apiFetch(
        `/api/market/unified?mode=incremental&section=${section}${debug}`
      );

      if (!response.ok) {
        throw new Error(`Incremental update failed: ${response.status}`);
      }

      const update = await response.json();
      
      if (update.data) {
        setData(prevData => {
          if (!prevData) return prevData;
          
          return {
            ...prevData,
            [update.type]: update.data,
            lastUpdated: update.timestamp
          };
        });
      }
    } catch (err) {
      console.warn(`Incremental update failed for ${section}:`, err);
      // Don't set error state for incremental failures, just log
    }
  }, [getApiFetch]);

  // Get specific quote
  const getQuote = useCallback(async (symbol: string) => {
    try {
      const apiFetch = await getApiFetch();
      const response = await apiFetch('/api/market/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: [symbol] })
      });

      if (!response.ok) {
        throw new Error(`Quote fetch failed: ${response.status}`);
      }

      const result = await response.json();
      return result.quotes[symbol];
    } catch (err) {
      console.error(`Failed to get quote for ${symbol}:`, err);
      throw err;
    }
  }, [getApiFetch]);

  // Get bulk quotes
  const getBulkQuotes = useCallback(async (symbols: string[]) => {
    try {
      const apiFetch = await getApiFetch();
      const response = await apiFetch('/api/market/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols })
      });

      if (!response.ok) {
        throw new Error(`Bulk quotes fetch failed: ${response.status}`);
      }

      const result = await response.json();
      return result.quotes;
    } catch (err) {
      console.error('Failed to get bulk quotes:', err);
      throw err;
    }
  }, [getApiFetch]);

  // Manual refresh
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchFullData();
    } finally {
      setLoading(false);
    }
  }, [fetchFullData]);

  // Setup real-time updates with incremental fetching
  useEffect(() => {
    if (!opts.enableRealTime || !data) return;

    let sectionIndex = 0;
    const sections = opts.sections || [];

    const scheduleIncrementalUpdate = () => {
      incrementalTimeoutRef.current = setTimeout(async () => {
        if (sections.length > 0) {
          const section = sections[sectionIndex % sections.length];
          await fetchIncrementalUpdate(section);
          sectionIndex++;
        }
        scheduleIncrementalUpdate();
      }, Math.floor(opts.updateInterval! / sections.length)); // Spread updates across interval
    };

    scheduleIncrementalUpdate();

    return () => {
      if (incrementalTimeoutRef.current) {
        clearTimeout(incrementalTimeoutRef.current);
      }
    };
  }, [data, opts.enableRealTime, opts.updateInterval, opts.sections, fetchIncrementalUpdate]);

  // Full refresh interval (less frequent)
  useEffect(() => {
    if (!opts.enableRealTime) return;

    intervalRef.current = setInterval(async () => {
      try {
        await fetchFullData();
      } catch (err) {
        // Error already handled in fetchFullData
      }
    }, opts.updateInterval! * 4); // Full refresh every 4x the update interval

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [opts.enableRealTime, opts.updateInterval, fetchFullData]);

  // Initial data load
  useEffect(() => {
    let mounted = true;

    const initialLoad = async () => {
      try {
        setLoading(true);
        await fetchFullData();
      } catch (err) {
        // Error already handled in fetchFullData
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initialLoad();

    return () => {
      mounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (incrementalTimeoutRef.current) {
        clearTimeout(incrementalTimeoutRef.current);
      }
    };
  }, []); // Only run on mount

  return {
    data,
    loading,
    error,
    refresh,
    getQuote,
    getBulkQuotes,
    lastFetchTime
  };
}

// Convenience hooks for specific data sections
export function useHeatmapData(options?: Omit<UseUnifiedMarketDataOptions, 'sections'>) {
  const { data, loading, error, refresh } = useUnifiedMarketData({
    ...options,
    sections: ['heatmap']
  });

  return {
    sectors: data?.heatmap?.sectors || [],
    loading,
    error,
    refresh,
    lastUpdated: data?.lastUpdated
  };
}

export function useIndicesData(options?: Omit<UseUnifiedMarketDataOptions, 'sections'>) {
  const { data, loading, error, refresh } = useUnifiedMarketData({
    ...options,
    sections: ['indices']
  });

  return {
    indices: data?.indices || [],
    loading,
    error,
    refresh,
    lastUpdated: data?.lastUpdated,
    marketStatus: data?.marketStatus
  };
}

export function useMoversData(options?: Omit<UseUnifiedMarketDataOptions, 'sections'>) {
  const { data, loading, error, refresh } = useUnifiedMarketData({
    ...options,
    sections: ['movers']
  });

  return {
    gainers: data?.movers?.gainers || [],
    losers: data?.movers?.losers || [],
    actives: data?.movers?.actives || [],
    loading,
    error,
    refresh,
    lastUpdated: data?.lastUpdated
  };
}
