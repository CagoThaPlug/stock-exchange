'use client';

import { useState, useEffect } from 'react';
import { Flame, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { StockIcon } from '@/components/ui/stock-icon';
import { useStockSelection } from '@/components/providers/StockSelectionProvider';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { formatCurrency } from '@/lib/format';
import { translate } from '@/lib/i18n';
import { useCurrency } from '@/components/providers/CurrencyProvider';

interface TrendingStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  category: 'gainers' | 'losers' | 'active';
}

export function TrendingStocks() {
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers' | 'active'>('gainers');
  const [stocks, setStocks] = useState<TrendingStock[]>([]);
  const [loading, setLoading] = useState(true);
  const { requestSelection } = useStockSelection();
  const { preferences } = usePreferences();
  const { convertFromUSD } = useCurrency();

  useEffect(() => {
    let abort = false;
    const load = async () => {
      try {
        setLoading(true);
        const { apiFetch } = await import('@/lib/utils');
        const [g, l, a] = await Promise.all([
          apiFetch('/api/market/data?section=movers&type=gainers').then(r => r.json()).catch(() => ({ movers: [] })),
          apiFetch('/api/market/data?section=movers&type=losers').then(r => r.json()).catch(() => ({ movers: [] })),
          apiFetch('/api/market/data?section=movers&type=actives').then(r => r.json()).catch(() => ({ movers: [] })),
        ]);
        if (abort) return;
        
        // Updated to use the correct response structure (movers instead of results)
        const mapped: TrendingStock[] = [
          ...(g.movers || []).slice(0, 8).map((q: any) => ({ 
            symbol: q.symbol, 
            name: q.name, 
            price: q.price, 
            change: q.change, 
            changePercent: q.changePercent, 
            volume: q.volume, 
            category: 'gainers' as const 
          })),
          ...(l.movers || []).slice(0, 8).map((q: any) => ({ 
            symbol: q.symbol, 
            name: q.name, 
            price: q.price, 
            change: q.change, 
            changePercent: q.changePercent, 
            volume: q.volume, 
            category: 'losers' as const 
          })),
          ...(a.movers || []).slice(0, 8).map((q: any) => ({ 
            symbol: q.symbol, 
            name: q.name, 
            price: q.price, 
            change: q.change, 
            changePercent: q.changePercent, 
            volume: q.volume, 
            category: 'active' as const 
          })),
        ];
        setStocks(mapped);
      } catch (error) {
        console.error('Failed to load market data:', error);
      } finally {
        if (!abort) setLoading(false);
      }
    };
    
    load();
    const interval = setInterval(load, 60000);
    return () => { abort = true; clearInterval(interval); };
  }, []);

  const filteredStocks = stocks
    .filter(stock => stock.category === activeTab)
    .slice(0, 8);

  const tabs = [
    { id: 'gainers' as const, label: translate(preferences.language, 'tabs.gainers', 'Top Gainers'), icon: TrendingUp, color: 'text-green-600' },
    { id: 'losers' as const, label: translate(preferences.language, 'tabs.losers', 'Top Losers'), icon: TrendingDown, color: 'text-red-600' },
    { id: 'active' as const, label: translate(preferences.language, 'tabs.active', 'Most Active'), icon: Eye, color: 'text-blue-600' },
  ];

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <Flame className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">{translate(preferences.language, 'market.movers', 'Market Movers')}</h2>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-muted rounded-lg p-1 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all
                ${isActive 
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-primary/30' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/20'
                }
              `}
              aria-pressed={isActive}
              aria-label={`Show ${tab.label}`}
            >
              <Icon className={`w-4 h-4 ${isActive ? tab.color : ''}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[1]}</span>
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center space-x-4 p-3">
              <div className="w-12 h-12 bg-muted rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Data State */}
      {!loading && filteredStocks.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No market movers data available</p>
        </div>
      )}

      {/* Stocks List */}
      {!loading && filteredStocks.length > 0 && (
        <div className="space-y-2">
          {filteredStocks.map((stock, index) => (
            <button
              key={stock.symbol}
              onClick={() => requestSelection(stock.symbol, stock.name)}
              className="w-full text-left flex items-center justify-between p-3 hover:bg-accent/20 rounded-lg transition-colors group hover:ring-1 ring-primary/30"
            >
              {/* Stock Info */}
              <div className="flex items-center space-x-3">
                <StockIcon symbol={stock.symbol} name={stock.name} size={32} variant="remote" />
                <div>
                  <p className="font-semibold text-sm">{stock.symbol}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {stock.name}
                  </p>
                </div>
              </div>

              {/* Price and Change */}
              <div className="text-right">
                <p className="font-semibold text-sm">
                  {formatCurrency(convertFromUSD(stock.price), { locale: preferences.locale, currency: preferences.currency })}
                </p>
                <div className="flex items-center space-x-1">
                  <span className={`text-xs font-medium ${
                    stock.change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
                  </span>
                  {activeTab === 'active' && (
                    <span className="text-xs text-muted-foreground">
                      Vol: {(stock.volume / 1000000).toFixed(0)}M
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          {translate(preferences.language, 'footer.refreshNote', 'Data refreshed every 15 minutes • Click stocks to view detailed analysis')}
        </p>
      </div>
    </div>
  );
}