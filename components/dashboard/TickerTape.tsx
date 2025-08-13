'use client';

import { useEffect, useMemo, useState, memo, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/utils';
import { ChevronDown, Pause, Play, RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface MarketItem {
  label: string;
  text: string;
  positive?: boolean;
  symbol?: string;
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  marketCap?: number;
  volume?: number;
}

interface TickerTapeProps {
  category?: 'all' | 'indices' | 'forex' | 'commodities' | 'crypto';
  refreshInterval?: number; // Set to 0 to disable auto-refresh (recommended for smooth scrolling)
  showControls?: boolean;
  maxItems?: number;
  className?: string;
  autoRefresh?: boolean; // New prop to explicitly enable/disable auto-refresh
}

function TickerTapeInner({ 
  category = 'all', 
  refreshInterval = 0, // Changed default to 0 (no auto-refresh)
  showControls = true,
  maxItems = 15,
  className = '',
  autoRefresh = false // Default to false for smooth scrolling
}: TickerTapeProps) {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [marketStatus, setMarketStatus] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(autoRefresh);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const categories = useMemo(() => [
    { value: 'all', label: 'All Markets', icon: Activity },
    { value: 'indices', label: 'Indices', icon: TrendingUp },
    { value: 'forex', label: 'Forex', icon: TrendingDown },
    { value: 'commodities', label: 'Commodities', icon: Activity },
    { value: 'crypto', label: 'Crypto', icon: TrendingUp },
  ], []);

  const loadData = useCallback(async (showLoadingState = false) => {
    if (isPaused) return;
    
    // Cancel previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    
    controllerRef.current = new AbortController();
    
    if (showLoadingState) setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('category', selectedCategory);
      params.set('limit', maxItems.toString());
      const res = await apiFetch(`/api/market/tape?${params.toString()}`, {
        cache: 'no-store',
        signal: controllerRef.current.signal,
        headers: { 'Accept': 'application/json' },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      // Get market status from headers
      const status = res.headers.get('X-Market-Status');
      if (status) setMarketStatus(status);
      
      if (Array.isArray(data.items)) {
        setItems(data.items);
        setLastUpdated(new Date());
        setError(data.error || null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Ticker tape error:', err);
        setError(err.message);
        // Keep existing data on error, don't clear it
      }
    } finally {
      if (showLoadingState) setLoading(false);
    }
  }, [selectedCategory, maxItems, isPaused]);

  // Initial load only - no automatic refresh to maintain smooth scrolling
  useEffect(() => {
    loadData(true);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [selectedCategory, maxItems]); // Only reload when category or maxItems change

  // Separate effect for manual refresh interval (only when explicitly enabled)
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only set up auto-refresh if explicitly enabled
    if (!isPaused && autoRefreshEnabled && refreshInterval > 0) {
      intervalRef.current = setInterval(() => loadData(false), refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadData, refreshInterval, isPaused, autoRefreshEnabled]);

  // Handle category change
  const handleCategoryChange = useCallback((newCategory: string) => {
    setSelectedCategory(newCategory as typeof category);
    setIsDropdownOpen(false);
    setLoading(true);
  }, []);

  // Toggle pause/play
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  // Format market status for display
  const getMarketStatusDisplay = (status: string) => {
    switch (status) {
      case 'OPEN': return { text: 'Market Open', color: 'text-green-600' };
      case 'CLOSED': return { text: 'Market Closed', color: 'text-red-600' };
      case 'PRE_MARKET': return { text: 'Pre-Market', color: 'text-yellow-600' };
      case 'AFTER_HOURS': return { text: 'After Hours', color: 'text-blue-600' };
      default: return { text: '', color: '' };
    }
  };

  const statusDisplay = getMarketStatusDisplay(marketStatus);

  // Handle loading state
  if (loading && items.length === 0) {
    return (
      <div className={`mt-6 overflow-hidden bg-muted rounded-lg ${className}`}>
        <div className="py-4 px-4 text-center">
          <div className="inline-flex items-center text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Loading market data...
          </div>
        </div>
      </div>
    );
  }

  // Handle error with no data
  if (error && items.length === 0) {
    return (
      <div className={`mt-6 overflow-hidden bg-muted rounded-lg ${className}`}>
        <div className="py-4 px-4 text-center">
          <div className="text-sm text-red-600">
            Failed to load market data: {error}
          </div>
          <button 
            onClick={handleRefresh}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-6 overflow-hidden bg-muted rounded-lg ${className}`}>
      {/* Controls */}
      {showControls && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/50">
          <div className="flex items-center gap-4">
            {/* Category Selector */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-background border border-border rounded hover:bg-accent transition-colors"
              >
                {categories.find(c => c.value === selectedCategory)?.label}
                <ChevronDown className="w-3 h-3 ml-1" />
              </button>
              
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-32 bg-background border border-border rounded-md shadow-lg z-10">
                  {categories.map((cat) => {
                    const IconComponent = cat.icon;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => handleCategoryChange(cat.value)}
                        className="w-full flex items-center px-3 py-2 text-xs hover:bg-accent transition-colors"
                      >
                        <IconComponent className="w-3 h-3 mr-2" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Market Status */}
            {statusDisplay.text && (
              <div className={`text-xs ${statusDisplay.color}`}>
                <span className="inline-block w-2 h-2 rounded-full bg-current mr-1.5"></span>
                {statusDisplay.text}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Last Updated */}
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            
            {/* Error indicator */}
            {error && (
              <span className="text-xs text-red-600" title={error}>
                ⚠️
              </span>
            )}

            {/* Auto-refresh toggle (only show if controls are enabled) */}
            {showControls && (
              <button
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className={`p-1 text-xs transition-colors ${
                  autoRefreshEnabled ? 'text-green-600' : 'text-muted-foreground hover:text-foreground'
                }`}
                title={autoRefreshEnabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}
              >
                {autoRefreshEnabled ? '●' : '○'}
              </button>
            )}

            {/* Pause/Play */}
            <button
              onClick={togglePause}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title={isPaused ? 'Resume animation' : 'Pause animation'}
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Ticker Content */}
      <div className="relative overflow-hidden">
        <div 
          className={`ticker-scroll whitespace-nowrap py-3 px-4 text-sm flex items-center ${
            isPaused ? 'animation-paused' : ''
          }`}
          style={{
            animationDuration: `${Math.max(20, items.length * 3)}s`
          }}
        >
          {items.length > 0 ? (
            items.map((item, i) => (
              <span 
                key={`ticker-${item.symbol || item.name || i}`} 
                className="mr-8 inline-flex items-center flex-shrink-0"
                title={item.name || item.symbol}
              >
                <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded bg-background border border-border text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  {item.label}
                </span>
                <span className={`font-medium ${
                  item.positive === undefined 
                    ? 'text-foreground' 
                    : item.positive 
                      ? 'text-green-600' 
                      : 'text-red-600'
                }`}>
                  {item.text}
                </span>
                {item.price && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ${item.price.toFixed(2)}
                  </span>
                )}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">No market data available</span>
          )}
        </div>
      </div>

      {/* CSS for scrolling animation */}
      <style jsx>{`
        .ticker-scroll {
          animation: scroll-left linear infinite;
          width: max-content;
        }
        
        .animation-paused {
          animation-play-state: paused;
        }
        
        @keyframes scroll-left {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        
        /* Smooth pause transitions */
        .ticker-scroll {
          transition: animation-play-state 0.3s ease;
        }
        
        /* Ensure smooth scrolling */
        .ticker-scroll:hover {
          animation-play-state: running;
        }
      `}</style>
    </div>
  );
}

export const TickerTape = memo(TickerTapeInner);

// Export default with common configurations
export default TickerTape;

// Preset configurations for smooth infinite scrolling
export const IndexTicker = memo(() => (
  <TickerTape category="indices" maxItems={5} autoRefresh={false} />
));

export const CryptoTicker = memo(() => (
  <TickerTape 
    category="crypto" 
    maxItems={10} 
    autoRefresh={true} 
    refreshInterval={30000} // Crypto changes rapidly, so auto-refresh makes sense
  />
));

export const CompactTicker = memo(() => (
  <TickerTape showControls={false} maxItems={8} className="mt-2" autoRefresh={false} />
));