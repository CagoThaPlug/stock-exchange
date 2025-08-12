'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, TrendingUp, TrendingDown, Volume, DollarSign } from 'lucide-react';
import { StockIcon } from '@/components/ui/stock-icon';
import { useStockSelection } from '@/components/providers/StockSelectionProvider';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { formatCurrency, formatCompactCurrency } from '@/lib/format';
import { translate } from '@/lib/i18n';
import { useCurrency } from '@/components/providers/CurrencyProvider';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';

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

function debounce<F extends (...args: any[]) => void>(fn: F, delayMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
];

export function StockSearch() {
  const [query, setQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { selection, clearSelection } = useStockSelection();
  const { preferences } = usePreferences();
  const { convertFromUSD } = useCurrency();
  const [hoveredPoint, setHoveredPoint] = useState<ChartData | null>(null);
  const lastHoverIndexRef = useRef<number | null>(null);

  // Work around React type duplication from recharts bringing its own @types/react
  const RC = ResponsiveContainer as unknown as React.ComponentType<any>;
  const AC = AreaChart as unknown as React.ComponentType<any>;
  const XAx = XAxis as unknown as React.ComponentType<any>;
  const YAx = YAxis as unknown as React.ComponentType<any>;
  const TT = Tooltip as unknown as React.ComponentType<any>;
  const AR = Area as unknown as React.ComponentType<any>;
  const CG = CartesianGrid as unknown as React.ComponentType<any>;

  const searchStocks = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setLoading(true);
      try {
        const debug = process.env.NEXT_PUBLIC_API_DEBUG ? '&debug=1' : '';
        const { apiFetch } = await import('@/lib/utils');
        const res = await apiFetch(`/api/market/data?section=search&q=${encodeURIComponent(searchQuery)}${debug}`, { cache: 'no-store' });
        const data = await res.json();
        const results: SearchResult[] = Array.isArray(data.results)
          ? (data.results as SearchResult[])
          : [];
        setSearchResults(results);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
        setShowDropdown(true);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    searchStocks(query);
  }, [query, searchStocks]);

  // Respond to selection requests from other components
  useEffect(() => {
    if (selection?.symbol) {
      selectStock(selection.symbol, selection.name);
      clearSelection();
      // Smooth scroll to this component
      const el = document.querySelector('.stock-search');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const selectStock = async (symbol: string, nameOverride?: string) => {
    setLoading(true);
    setQuery('');
    setSearchResults([]);

    try {
      const debugParam = process.env.NEXT_PUBLIC_API_DEBUG ? '&debug=1' : '';
      const { apiFetch } = await import('@/lib/utils');
      const [quoteRes, chartRes] = await Promise.all([
        apiFetch(`/api/market/data?section=quote&symbol=${encodeURIComponent(symbol)}${debugParam}`, { cache: 'no-store' }).then(async r => (r.ok ? r.json() : Promise.reject(await r.text()))),
        apiFetch(`/api/market/data?section=chart&symbol=${encodeURIComponent(symbol)}&range=1mo&interval=1d${debugParam}`, { cache: 'no-store' }).then(async r => (r.ok ? r.json() : Promise.reject(await r.text()))),
      ]);

      const q = quoteRes?.quote;
      let ch: any[] = Array.isArray(chartRes?.chart) ? chartRes.chart : [];

      // If no chart points returned, try a wider range as fallback (still real data)
      if (!ch.length) {
        const candidates: Array<[string, string]> = [['3mo','1d'], ['6mo','1d'], ['1y','1wk']];
        for (const [r, i] of candidates) {
          const { apiFetch } = await import('@/lib/utils');
          const alt = await apiFetch(`/api/market/data?section=chart&symbol=${encodeURIComponent(symbol)}&range=${r}&interval=${i}${debugParam}`, { cache: 'no-store' });
          if (!alt.ok) continue;
          const altJson = await alt.json();
          const candidate = Array.isArray(altJson?.chart) ? altJson.chart : [];
          if (candidate.length) { ch = candidate; break; }
        }
      }

      const resolvedQuote: StockQuote = {
        symbol,
        name: (nameOverride || q?.name || POPULAR_STOCKS.find(s => s.symbol === symbol)?.name || symbol),
        price: Number(q?.price ?? 0),
        change: Number(q?.change ?? 0),
        changePercent: Number(q?.changePercent ?? 0),
        volume: Number(q?.volume ?? 0),
        marketCap: Number(q?.marketCap ?? 0),
        sector: q?.sector || '—',
      };

      const chartPoints: ChartData[] = ch.map((p: any) => ({ time: p.time, price: Number(p.price) }));

      setSelectedStock(resolvedQuote);
      setChartData(chartPoints);
    } catch {
      setSelectedStock(null);
      setChartData([]);
    }
    setHoveredPoint(null);
    setLoading(false);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm stock-search">
      {/* Search Header */}
      <div className="flex items-center space-x-3 mb-6">
        <Search className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">{translate(preferences.language, 'search.title', 'Stock Search & Analysis')}</h2>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            onBlur={() => {
              // Delay to allow click on a result before hiding
              setTimeout(() => setShowDropdown(false), 150);
            }}
            onKeyDown={(e) => {
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
            }}
            placeholder={translate(preferences.language, 'search.placeholder', 'Search stocks by symbol or company name...')}
            data-search-input
            className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            aria-label="Search stocks"
          />
        </div>

        {/* Search Results Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50">
            {searchResults.length === 0 && !loading && (
              <div className="px-4 py-3 text-sm text-muted-foreground">{translate(preferences.language, 'search.noResults', 'No results found')}</div>
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
                      <div className="text-sm text-muted-foreground">{stock.name}</div>
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
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{translate(preferences.language, 'search.popular', 'Popular Stocks')}</h3>
          <div className="flex flex-wrap gap-2">
            {POPULAR_STOCKS.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => selectStock(stock.symbol)}
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
      {selectedStock && !loading && (
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
                <span className="text-sm font-medium">{translate(preferences.language, 'search.price', 'Price')}</span>
              </div>
              {(() => {
                const currentPrice = hoveredPoint ? hoveredPoint.price : selectedStock.price;
                const change = Number.isFinite(selectedStock.change) ? selectedStock.change : 0;
                const pct = Number.isFinite(selectedStock.changePercent) ? selectedStock.changePercent : 0;
                return (
                  <>
                    <p className="text-xl font-bold">{formatCurrency(convertFromUSD(currentPrice), { locale: preferences.locale, currency: preferences.currency })}</p>
                    <p className="text-xs text-muted-foreground h-4" aria-live="off">
                      {hoveredPoint?.time || '\u00A0'}
                    </p>
                    <p className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                    </p>
                  </>
                );
              })()}
            </div>

            <div className="bg-background rounded-lg p-4 border border-border">
              <div className="flex items-center space-x-2 mb-2">
                <Volume className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{translate(preferences.language, 'search.volume', 'Volume')}</span>
              </div>
              <p className="text-xl font-bold">{selectedStock.volume.toLocaleString()}</p>
            </div>

            <div className="bg-background rounded-lg p-4 border border-border">
              <div className="flex items-center space-x-2 mb-2">
                {selectedStock.change >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className="text-sm font-medium">{translate(preferences.language, 'search.trend', 'Trend')}</span>
              </div>
              <p className={`text-xl font-bold ${selectedStock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {selectedStock.change >= 0 ? translate(preferences.language, 'search.bullish', 'Bullish') : translate(preferences.language, 'search.bearish', 'Bearish')}
              </p>
            </div>

            <div className="bg-background rounded-lg p-4 border border-border">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm font-medium">{translate(preferences.language, 'search.marketCap', 'Market Cap')}</span>
              </div>
              <p className="text-xl font-bold">
                {formatCompactCurrency(convertFromUSD(selectedStock.marketCap), { locale: preferences.locale, currency: preferences.currency })}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <h4 className="font-semibold mb-4">{translate(preferences.language, 'search.chartTitle', '30-Day Price Chart')}</h4>
            <div className="h-64" role="img" aria-label="30 day price chart">
              <RC width="100%" height="100%">
                <AC
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
                  <CG strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAx dataKey="time" axisLine={false} tickLine={false} tickMargin={8} hide={false} />
                  <YAx axisLine={false} tickLine={false} tickMargin={8} width={56} />
                  <TT
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as ChartData;
                      return (
                        <div className="bg-popover border border-border rounded-md px-3 py-2 text-sm shadow">
                          <div className="font-medium">{formatCurrency(p.price, { locale: preferences.locale, currency: preferences.currency })}</div>
                          <div className="text-muted-foreground">{p.time}</div>
                        </div>
                      );
                    }}
                  />
                  <AR type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#priceGradient)" />
                </AC>
              </RC>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}