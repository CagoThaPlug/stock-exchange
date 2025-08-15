'use client';

import { useState, useEffect } from 'react';
import { Flame, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { StockIcon } from '@/components/ui/stock-icon';
import { useStockSelection } from '@/components/providers/StockSelectionProvider';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { formatCurrency } from '@/lib/format';
import { translate } from '@/lib/i18n';
import { useCurrency } from '@/components/providers/CurrencyProvider';
import { useMoversData } from '@/hooks/useUnifiedMarketData';

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
  const { requestSelection } = useStockSelection();
  const { preferences } = usePreferences();
  const { convertFromUSD } = useCurrency();

  // Use the unified market data hook
  const { 
    gainers, 
    losers, 
    actives, 
    loading, 
    error, 
    refresh 
  } = useMoversData({
    updateInterval: 30000,
    enableRealTime: true
  });

  // Combine all movers into a single array with categories
  const stocks: TrendingStock[] = [
    ...gainers.slice(0, 8).map((q: any) => ({ 
      symbol: q.symbol, 
      name: q.name, 
      price: q.price, 
      change: q.change, 
      changePercent: q.changePercent, 
      volume: q.volume, 
      category: 'gainers' as const 
    })),
    ...losers.slice(0, 8).map((q: any) => ({ 
      symbol: q.symbol, 
      name: q.name, 
      price: q.price, 
      change: q.change, 
      changePercent: q.changePercent, 
      volume: q.volume, 
      category: 'losers' as const 
    })),
    ...actives.slice(0, 8).map((q: any) => ({ 
      symbol: q.symbol, 
      name: q.name, 
      price: q.price, 
      change: q.change, 
      changePercent: q.changePercent, 
      volume: q.volume, 
      category: 'active' as const 
    })),
  ];

  const filteredStocks = stocks
    .filter(stock => stock.category === activeTab)
    .slice(0, 8);

  const tabs = [
    { id: 'gainers' as const, label: translate(preferences.language, 'tabs.gainers', 'Top Gainers'), icon: TrendingUp, color: 'text-green-600' },
    { id: 'losers' as const, label: translate(preferences.language, 'tabs.losers', 'Top Losers'), icon: TrendingDown, color: 'text-red-600' },
    { id: 'active' as const, label: translate(preferences.language, 'tabs.active', 'Most Active'), icon: Eye, color: 'text-blue-600' },
  ];

  return (
    <div className="card-elevated card-interactive rounded-xl p-6">
      {/* Enhanced Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
          <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            {translate(preferences.language, 'market.movers', 'Market Movers')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {translate(preferences.language, 'movers.subtitle', 'Top performing stocks')}
          </p>
        </div>
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

      {/* Enhanced Stocks List */}
      {!loading && filteredStocks.length > 0 && (
        <div className="space-y-3">
          {filteredStocks.map((stock, index) => (
            <button
              key={stock.symbol}
              onClick={() => requestSelection(stock.symbol, stock.name)}
              className="w-full text-left flex items-center justify-between p-4 hover:bg-accent/10 hover:border-primary/20 rounded-xl transition-all duration-300 group border border-transparent hover:shadow-md animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Stock Info */}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <StockIcon symbol={stock.symbol} name={stock.name} size={36} variant="remote" />
                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-card ${
                    stock.change >= 0 ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                </div>
                <div>
                  <p className="font-bold text-sm group-hover:text-primary transition-colors">{stock.symbol}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                    {stock.name}
                  </p>
                </div>
              </div>

              {/* Enhanced Price and Change Display */}
              <div className="text-right space-y-1">
                <p className="font-bold text-sm">
                  {formatCurrency(convertFromUSD(stock.price), { locale: preferences.locale, currency: preferences.currency })}
                </p>
                <div className="flex items-center justify-end space-x-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    stock.change >= 0 
                      ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30' 
                      : 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
                  </span>
                  {activeTab === 'active' && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {(stock.volume / 1000000).toFixed(0)}M
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