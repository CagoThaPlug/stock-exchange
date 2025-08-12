'use client';

import { useState, useEffect } from 'react';
import { useStockSelection } from '@/components/providers/StockSelectionProvider';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { translate } from '@/lib/i18n';
import { formatCompactCurrency } from '@/lib/format';
import { useCurrency } from '@/components/providers/CurrencyProvider';

interface SectorData {
  name: string;
  change: number;
  marketCap: number;
  stocks: { symbol: string; change: number }[];
}

export function MarketHeatmap() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const { requestSelection } = useStockSelection();
  const { preferences } = usePreferences();
  const { convertFromUSD } = useCurrency();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const debug = process.env.NEXT_PUBLIC_API_DEBUG ? '?debug=1' : '';
        const { apiFetch } = await import('@/lib/utils');
        const res = await apiFetch(`/api/market/heatmap${debug}`, { cache: 'no-store' });
        const data = await res.json();
        const items = Array.isArray(data.sectors) ? data.sectors : [];
        if (cancelled) return;
        const mapped: SectorData[] = items.map((s: any) => ({
          name: translate(preferences.language, `sector.${s.name.toLowerCase()}`, s.name),
          change: Number(s.change || 0),
          marketCap: Number(s.marketCap || 0),
          stocks: Array.isArray(s.stocks) ? s.stocks.map((x: any) => ({ symbol: x.symbol, change: Number(x.change || 0) })) : [],
        }));
        setSectors(mapped);
      } catch {
        setSectors([]);
      }
    })();
    return () => { cancelled = true; };
  }, [preferences.language]);

  const getIntensityColor = (change: number): string => {
    if (change > 2) return 'bg-green-500';
    if (change > 1) return 'bg-green-400';
    if (change > 0) return 'bg-yellow-500';
    if (change > -1) return 'bg-orange-400';
    if (change > -2) return 'bg-red-400';
    return 'bg-red-500';
  };

  const getSectorSize = (marketCap: number): string => {
    const maxCap = Math.max(...sectors.map(s => s.marketCap));
    const ratio = marketCap / maxCap;
    
    if (ratio > 0.8) return 'col-span-2 row-span-2';
    if (ratio > 0.6) return 'col-span-2 row-span-1';
    if (ratio > 0.4) return 'col-span-1 row-span-2';
    return 'col-span-1 row-span-1';
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">{translate(preferences.language, 'heatmap.title', 'Market Heatmap')}</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          {translate(preferences.language, 'heatmap.legend.caption', 'Size = Market Cap, Color = Performance')}
        </div>
      </div>

      {/* Sector Grid */}
      <div className="grid grid-cols-4 gap-3 min-h-[400px] mb-6">
        {sectors.map((sector) => {
          const isSelected = selectedSector === sector.name;
          return (
            <button
              key={sector.name}
              onClick={() => setSelectedSector(isSelected ? null : sector.name)}
              className={`
                ${getSectorSize(sector.marketCap)}
                ${getIntensityColor(sector.change)}
                rounded-lg p-4 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg
                flex flex-col justify-between min-h-[100px] relative overflow-hidden
                ${isSelected ? 'ring-2 ring-foreground/20 ring-offset-2 ring-offset-background' : ''}
              `}
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 right-2">
                  {sector.change >= 0 ? (
                    <TrendingUp className="w-6 h-6" />
                  ) : (
                    <TrendingDown className="w-6 h-6" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                <h3 className="font-bold text-sm mb-1">{sector.name}</h3>
                <p className="text-xs opacity-80">
                  {formatCompactCurrency(convertFromUSD(sector.marketCap), { locale: preferences.locale, currency: preferences.currency })}
                </p>
              </div>
              
              <div className="relative z-10 text-right">
                <p className="font-bold">
                  {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(1)}%
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sector Details */}
      {selectedSector && (
        <div className="bg-background rounded-lg p-4 border border-border">
          <h3 className="font-semibold mb-3">{selectedSector} {translate(preferences.language, 'sector.breakdown', 'Sector Breakdown')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sectors
              .find(s => s.name === selectedSector)
              ?.stocks.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => requestSelection(stock.symbol)}
                  className="bg-card border border-border rounded p-3 text-center hover:bg-accent/20 transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/25 hover:ring-1 ring-foreground/20"
                >
                  <p className="font-medium text-sm">{stock.symbol}</p>
                  <p className={`text-sm ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(1)}%
                  </p>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>{translate(preferences.language, 'heatmap.legend.strongGains', 'Strong Gains')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>{translate(preferences.language, 'heatmap.legend.moderateGains', 'Moderate Gains')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-orange-400 rounded"></div>
          <span>{translate(preferences.language, 'heatmap.legend.moderateLosses', 'Moderate Losses')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>{translate(preferences.language, 'heatmap.legend.strongLosses', 'Strong Losses')}</span>
        </div>
      </div>
    </div>
  );
}