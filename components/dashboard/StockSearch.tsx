'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, Volume, DollarSign } from 'lucide-react';
import { StockIcon } from '@/components/ui/stock-icon';
import { useStockSelection } from '@/components/providers/StockSelectionProvider';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { formatCurrency, formatCompactCurrency, formatCompactNumber } from '@/lib/format';
import { translate } from '@/lib/i18n';
import { useCurrency } from '@/components/providers/CurrencyProvider';

// Lazy-load recharts components individually to reduce bundle size
const LazyResponsiveContainer = React.lazy(() => 
  import('recharts').then(module => ({ default: module.ResponsiveContainer }))
);
const LazyAreaChart = React.lazy(() => 
  import('recharts').then(module => ({ default: module.AreaChart }))
);
const LazyXAxis = React.lazy(() => 
  import('recharts').then(module => ({ default: module.XAxis }))
);
const LazyYAxis = React.lazy(() => 
  import('recharts').then(module => ({ default: module.YAxis }))
);
const LazyTooltip = React.lazy(() => 
  import('recharts').then(module => ({ default: module.Tooltip }))
);
const LazyArea = React.lazy(() => 
  import('recharts').then(module => ({ default: module.Area }))
);
const LazyCartesianGrid = React.lazy(() => 
  import('recharts').then(module => ({ default: module.CartesianGrid }))
);

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  sector: string;
}

interface ChartData {
  time: string;
  price: number;
}

interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
}

// Memoized debounce function to prevent recreation on every render
const createDebounce = <F extends (...args: any[]) => void>(fn: F, delayMs: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
};

// Pre-defined constants to avoid recreation
const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
] as const;

// Extended stock names database for better name resolution
const STOCK_NAMES_DB = [
  ...POPULAR_STOCKS,
  // Major indices components and common stocks
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'GOOG', name: 'Alphabet Inc.' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'CRM', name: 'Salesforce Inc.' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'QCOM', name: 'QUALCOMM Inc.' },
  { symbol: 'PEP', name: 'PepsiCo Inc.' },
  { symbol: 'KO', name: 'The Coca-Cola Company' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'PYPL', name: 'PayPal Holdings Inc.' },
  { symbol: 'CMCSA', name: 'Comcast Corporation' },
  { symbol: 'PFE', name: 'Pfizer Inc.' },
  { symbol: 'ABT', name: 'Abbott Laboratories' },
  { symbol: 'COP', name: 'ConocoPhillips' },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific' },
  { symbol: 'ACN', name: 'Accenture plc' },
  { symbol: 'LLY', name: 'Eli Lilly and Company' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'DHR', name: 'Danaher Corporation' },
] as const;

const RANGE_OPTIONS = [
  { key: '1d', label: '1D', interval: '30m' },
  { key: '5d', label: '5D', interval: '1h' },
  { key: '1mo', label: '1M', interval: '1d' },
  { key: '3mo', label: '3M', interval: '1d' },
  { key: '6mo', label: '6M', interval: '1d' },
  { key: '1y', label: '1Y', interval: '1wk' },
  { key: '5y', label: '5Y', interval: '1mo' },
] as const;

// Memoized components to prevent unnecessary re-renders
const SearchInput = React.memo(function SearchInput({ 
  query, 
  setQuery, 
  onFocus, 
  onBlur, 
  onKeyDown, 
  placeholder 
}: {
  query: string;
  setQuery: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder: string;
}) {
  return (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      data-search-input
      className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
      aria-label="Search stocks"
    />
  </div>
  );
});

const PriceCard = React.memo(function PriceCard({ 
  title, 
  value, 
  subtitle, 
  change, 
  icon: Icon 
}: {
  title: string;
  value: string;
  subtitle?: string;
  change?: string;
  icon: React.ComponentType<any>;
}) {
  return (
  <div className="bg-background rounded-lg p-4 border border-border">
    <div className="flex items-center space-x-2 mb-2">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium">{title}</span>
    </div>
    <p className="text-xl font-bold">{value}</p>
    {subtitle && <p className="text-xs text-muted-foreground h-4">{subtitle}</p>}
    {change && <p className="text-sm">{change}</p>}
  </div>
  );
});

export function StockSearch() {
  const [query, setQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [selectedRange, setSelectedRange] = useState<string>('1mo');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const { selection, clearSelection } = useStockSelection();
  const { preferences } = usePreferences();
  const { convertFromUSD } = useCurrency();
  const [hoveredPoint, setHoveredPoint] = useState<ChartData | null>(null);
  
  // Refs for optimization
  const lastHoverIndexRef = useRef<number | null>(null);
  const inFlightControllersRef = useRef<{ quote?: AbortController; chart?: AbortController } | null>(null);
  const quoteCacheRef = useRef<Map<string, any>>(new Map());
  const chartCacheRef = useRef<Map<string, ChartData[]>>(new Map());
  
  // Memoized utility functions
  const getIntervalForRange = useCallback((key: string) => 
    RANGE_OPTIONS.find(r => r.key === key)?.interval || '1d', []
  );

  // Memoized debounced search function
  const searchStocks = useMemo(() => 
    createDebounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setLoading(true);
      try {
        const debug = process.env.NEXT_PUBLIC_API_DEBUG ? '&debug=1' : '';
        const { apiFetch } = await import('@/lib/utils');
        const res = await apiFetch(`/api/market/data?section=search&q=${encodeURIComponent(searchQuery)}${debug}`);
        const data = await res.json();
        const results: SearchResult[] = Array.isArray(data.results) ? data.results : [];
        setSearchResults(results);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
        setShowDropdown(true);
      } finally {
        setLoading(false);
      }
    }, 300), []
  );

  // Memoized Y-axis domain calculation
  const yDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto'] as any;
    const prices = chartData.map(p => p.price).filter(n => Number.isFinite(n));
    if (!prices.length) return ['auto', 'auto'] as any;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = Math.max(max - min, 0);
    const padding = Math.max(spread * 0.05, max * 0.005, 0.01);
    if (selectedRange === '1y' || selectedRange === '5y') {
      return [0, Math.ceil(max + padding)];
    }
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData, selectedRange]);

  // Memoized event handlers
  const handleInputFocus = useCallback(() => {
    if (searchResults.length > 0) setShowDropdown(true);
  }, [searchResults.length]);

  const handleInputBlur = useCallback(() => {
    setTimeout(() => setShowDropdown(false), 150);
  }, []);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      if (searchResults.length > 0) {
        const first = searchResults[0];
        selectStock(first.symbol, first.name);
      } else {
        selectStock(query.trim().toUpperCase());
      }
      setShowDropdown(false);
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }, [query, searchResults]);

  const selectStock = useCallback(async (symbol: string, nameOverride?: string) => {
    setLoading(true);
    setQuery('');
    setSearchResults([]);

    try {
      const debugParam = process.env.NEXT_PUBLIC_API_DEBUG ? '&debug=1' : '';
      const { apiFetch } = await import('@/lib/utils');
      const interval = getIntervalForRange(selectedRange);
      
      // Abort any in-flight requests
      if (inFlightControllersRef.current?.quote) inFlightControllersRef.current.quote.abort();
      if (inFlightControllersRef.current?.chart) inFlightControllersRef.current.chart.abort();
      inFlightControllersRef.current = { quote: new AbortController(), chart: new AbortController() };

      // Check cache first
      const cachedQuote = quoteCacheRef.current.get(symbol);
      const chartCacheKey = `${symbol}|${selectedRange}|${interval}`;
      const cachedChart = chartCacheRef.current.get(chartCacheKey);

      const quotePromise = cachedQuote
        ? Promise.resolve({ quote: cachedQuote })
        : apiFetch(`/api/market/data?section=quote&symbol=${encodeURIComponent(symbol)}${debugParam}`, { 
            signal: inFlightControllersRef.current.quote!.signal 
          }).then(async r => (r.ok ? r.json() : Promise.reject(await r.text())));
      
      const chartPromise = cachedChart
        ? Promise.resolve({ chart: cachedChart })
        : apiFetch(`/api/market/data?section=chart&symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(selectedRange)}&interval=${encodeURIComponent(interval)}${debugParam}`, { 
            signal: inFlightControllersRef.current.chart!.signal 
          }).then(async r => (r.ok ? r.json() : Promise.reject(await r.text())));

      const [quoteRes, chartRes] = await Promise.all([quotePromise, chartPromise]);

      const q = quoteRes?.quote;
      let ch: any[] = [];
      if (Array.isArray(chartRes?.chart)) {
        ch = chartRes.chart;
      } else if (chartRes?.chart?.points && Array.isArray(chartRes.chart.points)) {
        ch = chartRes.chart.points;
      }

      // Fallback logic for empty chart data
      if (!ch.length) {
        const candidates: Array<[string, string]> = [
          [selectedRange, getIntervalForRange(selectedRange)],
          ['3mo','1d'], ['6mo','1d'], ['1y','1wk']
        ];
        for (const [r, i] of candidates) {
          const { apiFetch } = await import('@/lib/utils');
          const alt = await apiFetch(`/api/market/data?section=chart&symbol=${encodeURIComponent(symbol)}&range=${r}&interval=${i}${debugParam}`);
          if (!alt.ok) continue;
          const altJson = await alt.json();
          let candidate: any[] = [];
          if (Array.isArray(altJson?.chart)) {
            candidate = altJson.chart;
          } else if (altJson?.chart?.points && Array.isArray(altJson.chart.points)) {
            candidate = altJson.chart.points;
          }
          if (candidate.length) { ch = candidate; break; }
        }
      }

      // Enhanced name resolution with multiple fallbacks
      const resolveName = () => {
        // 1. Use provided name override (from search results, trending stocks, etc.)
        if (nameOverride && nameOverride.trim() && nameOverride !== symbol) {
          return nameOverride.trim();
        }
        
        // 2. Use API response name
        if (q?.name && q.name.trim() && q.name !== symbol) {
          return q.name.trim();
        }
        
        // 3. Check our extended stock names database
        const knownStock = STOCK_NAMES_DB.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
        if (knownStock) {
          return knownStock.name;
        }
        
        // 4. Try to fetch additional info if we only have a symbol
        // This could be expanded to call a different API endpoint for company info
        
        // 5. Final fallback - just use the symbol
        return symbol;
      };

      const resolvedQuote: StockQuote = {
        symbol,
        name: resolveName(),
        price: Number(q?.price ?? 0),
        change: Number(q?.change ?? 0),
        changePercent: Number(q?.changePercent ?? 0),
        volume: Number(q?.volume ?? 0),
        marketCap: Number(q?.marketCap ?? 0),
        sector: q?.sector || '—',
      };

      const chartPoints: ChartData[] = ch
        .map((p: any) => {
          const price = Number(p.price ?? p.close ?? p.adjclose ?? 0);
          let timeStr = '';
          if (p.time) {
            timeStr = String(p.time);
          } else if (p.timestamp) {
            const ms = Number(p.timestamp) * 1000;
            if (Number.isFinite(ms)) timeStr = new Date(ms).toISOString().split('T')[0];
          }
          return { time: timeStr, price } as ChartData;
        })
        .filter((pt) => Number.isFinite(pt.price) && pt.price > 0 && !!pt.time);

      // Update caches
      if (!cachedQuote && q) {
        quoteCacheRef.current.set(symbol, q);
      }
      if (!cachedChart && chartPoints.length) {
        chartCacheRef.current.set(chartCacheKey, chartPoints);
      }

      setSelectedStock(resolvedQuote);
      setChartData(chartPoints);
      setChartReady(true); // Only load chart components after we have data
    } catch {
      setSelectedStock(null);
      setChartData([]);
    }
    setHoveredPoint(null);
    setLoading(false);
  }, [selectedRange, getIntervalForRange]);

  // Effect for search
  useEffect(() => {
    searchStocks(query);
  }, [query, searchStocks]);

  // Effect for stock selection from other components
  useEffect(() => {
    if (selection?.symbol) {
      selectStock(selection.symbol, selection.name);
      clearSelection();
      const el = document.querySelector('.stock-search');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selection, selectStock, clearSelection]);

  // Effect for range changes
  useEffect(() => {
    const updateChartData = async () => {
      if (!selectedStock?.symbol) return;
      try {
        const debugParam = process.env.NEXT_PUBLIC_API_DEBUG ? '&debug=1' : '';
        const interval = getIntervalForRange(selectedRange);
        const cacheKey = `${selectedStock.symbol}|${selectedRange}|${interval}`;
        const cached = chartCacheRef.current.get(cacheKey);
        
        let ch: any[] = cached || [];
        if (!cached) {
          const { apiFetch } = await import('@/lib/utils');
          const res = await apiFetch(`/api/market/data?section=chart&symbol=${encodeURIComponent(selectedStock.symbol)}&range=${encodeURIComponent(selectedRange)}&interval=${encodeURIComponent(interval)}${debugParam}`);
          if (!res.ok) return;
          const chartRes = await res.json();
          if (Array.isArray(chartRes?.chart)) ch = chartRes.chart;
          else if (chartRes?.chart?.points && Array.isArray(chartRes.chart.points)) ch = chartRes.chart.points;
        }
        
        const chartPoints: ChartData[] = ch
          .map((p: any) => {
            const price = Number(p.price ?? p.close ?? p.adjclose ?? 0);
            let timeStr = '';
            if (p.time) timeStr = String(p.time);
            else if (p.timestamp) {
              const ms = Number(p.timestamp) * 1000;
              if (Number.isFinite(ms)) timeStr = new Date(ms).toISOString().split('T')[0];
            }
            return { time: timeStr, price } as ChartData;
          })
          .filter((pt) => Number.isFinite(pt.price) && pt.price > 0 && !!pt.time);
          
        if (!cached && chartPoints.length) {
          chartCacheRef.current.set(cacheKey, chartPoints);
        }
        setChartData(chartPoints);
        setHoveredPoint(null);
      } catch {}
    };
    updateChartData();
  }, [selectedRange, selectedStock?.symbol, getIntervalForRange]);

  // Memoized price card data
  const priceCardData = useMemo(() => {
    if (!selectedStock) return null;
    
    const currentPrice = hoveredPoint ? hoveredPoint.price : selectedStock.price;
    const change = Number.isFinite(selectedStock.change) ? selectedStock.change : 0;
    const pct = Number.isFinite(selectedStock.changePercent) ? selectedStock.changePercent : 0;
    
    return {
      price: {
        title: translate(preferences.language, 'search.price', 'Price'),
        value: formatCurrency(convertFromUSD(currentPrice), { locale: preferences.locale, currency: preferences.currency }),
        subtitle: hoveredPoint?.time || '\u00A0',
        change: `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`,
      },
      volume: {
        title: translate(preferences.language, 'search.volume', 'Volume'),
        value: formatCompactNumber(selectedStock.volume, preferences.locale),
      },
      trend: {
        title: translate(preferences.language, 'search.trend', 'Trend'),
        value: selectedStock.change >= 0 
          ? translate(preferences.language, 'search.bullish', 'Bullish')
          : translate(preferences.language, 'search.bearish', 'Bearish'),
      },
      marketCap: {
        title: translate(preferences.language, 'search.marketCap', 'Market Cap'),
        value: selectedStock.marketCap > 0
          ? formatCompactCurrency(convertFromUSD(selectedStock.marketCap), { locale: preferences.locale, currency: preferences.currency })
          : '—',
      }
    };
  }, [selectedStock, hoveredPoint, preferences, convertFromUSD]);

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm stock-search">
      {/* Search Header */}
      <div className="flex items-center space-x-3 mb-6">
        <Search className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">{translate(preferences.language, 'search.title', 'Stock Search & Analysis')}</h2>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <SearchInput
          query={query}
          setQuery={setQuery}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={translate(preferences.language, 'search.placeholder', 'Search stocks by symbol or company name...')}
        />

        {/* Search Results Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50">
            {searchResults.length === 0 && !loading && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {translate(preferences.language, 'search.noResults', 'No results found')}
              </div>
            )}
            {searchResults.map((stock: SearchResult) => (
              <button
                key={stock.symbol}
                onClick={() => {
                  selectStock(stock.symbol, stock.name);
                  setShowDropdown(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground border-b border-border last:border-b-0 focus:outline-none focus:bg-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StockIcon symbol={stock.symbol} name={stock.name} size={20} />
                    <div>
                      <div className="font-medium">{stock.symbol}</div>
                      {(() => {
                        // Show name only if it's different from symbol and provides additional info
                        const name = stock.name?.trim();
                        const symbol = stock.symbol?.trim();
                        if (!name || !symbol) return null;
                        
                        // Don't show if name is exactly the symbol
                        if (name === symbol) return null;
                        
                        // Don't show if name is just the symbol with some common suffixes
                        const normalizedName = name.replace(/\s+(Inc\.?|Corp\.?|Company|Co\.?|Ltd\.?|Limited|Corporation|Incorporated)$/i, '').trim();
                        if (normalizedName === symbol) return null;
                        
                        return (
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">{name}</div>
                        );
                      })()}
                    </div>
                  </div>
                  {stock.exchange && (
                    <div className="text-xs text-muted-foreground whitespace-nowrap">{stock.exchange}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Popular Stocks */}
      {!selectedStock && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {translate(preferences.language, 'search.popular', 'Popular Stocks')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {POPULAR_STOCKS.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => selectStock(stock.symbol, stock.name)}
                className="px-3 py-2 bg-muted hover:bg-accent/20 rounded-lg text-sm transition-colors hover:ring-1 ring-primary/30"
              >
                {stock.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Stock Details */}
      {selectedStock && !loading && priceCardData && (
        <div className="space-y-6">
          {/* Stock Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">{selectedStock.symbol}</h3>
              <p className="text-muted-foreground">{selectedStock.name}</p>
              <p className="text-sm text-muted-foreground">{selectedStock.sector}</p>
            </div>
            <button
              onClick={() => setSelectedStock(null)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              {translate(preferences.language, 'search.clear', 'Clear')}
            </button>
          </div>

          {/* Price Information */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-background rounded-lg p-4 border border-border">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{priceCardData.price.title}</span>
              </div>
              <p className="text-xl font-bold">{priceCardData.price.value}</p>
              <p className="text-xs text-muted-foreground h-4" aria-live="off">
                {priceCardData.price.subtitle}
              </p>
              <p className={`text-sm ${selectedStock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {priceCardData.price.change}
              </p>
            </div>

            <PriceCard
              title={priceCardData.volume.title}
              value={priceCardData.volume.value}
              icon={Volume}
            />

            <div className="bg-background rounded-lg p-4 border border-border">
              <div className="flex items-center space-x-2 mb-2">
                {selectedStock.change >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className="text-sm font-medium">{priceCardData.trend.title}</span>
              </div>
              <p className={`text-xl font-bold ${selectedStock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {priceCardData.trend.value}
              </p>
            </div>

            <PriceCard
              title={priceCardData.marketCap.title}
              value={priceCardData.marketCap.value}
              icon={() => <span className="w-4 h-4" />}
            />
          </div>

          {/* Chart */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h4 className="font-semibold">{translate(preferences.language, 'search.chartTitle', 'Price Chart')}</h4>
              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSelectedRange(opt.key)}
                    className={`px-2.5 py-1.5 rounded-md text-xs border ${
                      selectedRange === opt.key 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-muted hover:bg-accent/30 border-border'
                    }`}
                    aria-pressed={selectedRange === opt.key}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64" role="img" aria-label="Stock price chart">
              {chartReady && chartData.length > 0 ? (
                <React.Suspense fallback={
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Loading chart…
                  </div>
                }>
                  <LazyResponsiveContainer width="100%" height="100%">
                    <LazyAreaChart
                      data={chartData}
                      onMouseMove={(state: any) => {
                        const idx = state?.activeTooltipIndex;
                        if (typeof idx === 'number' && chartData[idx]) {
                          if (lastHoverIndexRef.current !== idx) {
                            setHoveredPoint(chartData[idx]);
                            lastHoverIndexRef.current = idx;
                          }
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredPoint(null);
                        lastHoverIndexRef.current = null;
                      }}
                    >
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <LazyCartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <LazyXAxis dataKey="time" axisLine={false} tickLine={false} tickMargin={8} hide={false} />
                      <LazyYAxis axisLine={false} tickLine={false} tickMargin={8} width={56} domain={yDomain} />
                      <LazyTooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0].payload as ChartData;
                          return (
                            <div className="bg-popover border border-border rounded-md px-3 py-2 text-sm shadow">
                              <div className="font-medium">
                                {formatCurrency(convertFromUSD(p.price), { 
                                  locale: preferences.locale, 
                                  currency: preferences.currency 
                                })}
                              </div>
                              <div className="text-muted-foreground">{p.time}</div>
                            </div>
                          );
                        }}
                      />
                      <LazyArea 
                        type="monotone" 
                        dataKey="price" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2} 
                        fill="url(#priceGradient)" 
                      />
                    </LazyAreaChart>
                  </LazyResponsiveContainer>
                </React.Suspense>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  {chartData.length === 0 ? 'No chart data available' : 'Loading chart…'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}