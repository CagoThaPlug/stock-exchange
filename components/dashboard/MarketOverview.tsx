'use client';

import { useState, useEffect } from 'react';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { formatCurrency } from '@/lib/format';
import { translate } from '@/lib/i18n';
import { useCurrency } from '@/components/providers/CurrencyProvider';
import { TrendingUp, TrendingDown, Clock, Globe } from 'lucide-react';

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export function MarketOverview() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [marketStatus, setMarketStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const { preferences } = usePreferences();
  const { convertFromUSD } = useCurrency();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/market/data?section=indices', { cache: 'no-store' });
        const data = await res.json();
        const all: MarketIndex[] = Array.isArray(data.indices) ? data.indices : [];
        const shuffled = [...all].sort(() => Math.random() - 0.5);
        setIndices(shuffled.slice(0, 3));
      } catch {
        setIndices([]);
      } finally {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        const isWeekend = day === 0 || day === 6;
        const isBusinessHours = hour >= 9 && hour < 16;
        setIsMarketOpen(!isWeekend && isBusinessHours);
        setMarketStatus(!isWeekend && isBusinessHours ? translate(preferences.language, 'market.open', 'Market Open') : translate(preferences.language, 'market.closed', 'Market Closed'));
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);


  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-muted rounded-lg h-20"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">{translate(preferences.language, 'market.overview', 'Market Overview')}</h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-muted-foreground flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            {translate(
              preferences.language,
              isMarketOpen ? 'market.open' : 'market.closed',
              isMarketOpen ? 'Market Open' : 'Market Closed'
            )}
          </span>
        </div>
      </div>

      {/* Indices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {indices.map((index) => (
          <div
            key={index.symbol}
            className="bg-background rounded-lg p-4 border border-border hover:shadow-md transition-shadow animate-flare"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-sm">{index.name}</h3>
                <p className="text-xs text-muted-foreground">{index.symbol}</p>
              </div>
              <div className={`p-1 rounded ${index.change >= 0 ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                {index.change >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                )}
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-lg font-bold">
                {formatCurrency(convertFromUSD(index.price), { locale: preferences.locale, currency: preferences.currency, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${index.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)}
                </span>
                <span className={`text-sm ${index.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>


    </div>
  );
}