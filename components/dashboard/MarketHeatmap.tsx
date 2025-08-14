'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useStockSelection } from '@/components/providers/StockSelectionProvider';
import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';
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
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const { requestSelection } = useStockSelection();
  const { preferences } = usePreferences();
  const { convertFromUSD } = useCurrency();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const debug = process.env.NEXT_PUBLIC_API_DEBUG ? '?debug=1' : '';
        const { apiFetch } = await import('@/lib/utils');
        const res = await apiFetch(`/api/market/heatmap${debug}`);
        const data = await res.json();

        const normalize = (raw: any): SectorData[] => {
          if (Array.isArray(raw)) {
            return raw.map((s: any) => ({
              name: translate(preferences.language, `sector.${String(s.name || '').toLowerCase()}`, s.name || ''),
              change: Number(s.change ?? 0),
              marketCap: Number(s.marketCap ?? 0),
              stocks: Array.isArray(s.stocks)
                ? s.stocks.map((x: any) => ({ symbol: x.symbol, change: Number(x.change ?? 0) }))
                : [],
            }));
          }
          if (raw && typeof raw === 'object') {
            const values = Object.values(raw as Record<string, any>);
            return values.map((s: any) => ({
              name: translate(preferences.language, `sector.${String(s.name || '').toLowerCase()}`, s.name || ''),
              change: Number((s.change ?? s.changePercent) ?? 0),
              marketCap: Number(s.marketCap ?? 0),
              stocks: Array.isArray(s.stocks)
                ? s.stocks.map((x: any) => ({ symbol: x.symbol, change: Number(x.change ?? 0) }))
                : Array.isArray(s.topMovers)
                  ? s.topMovers.map((x: any) => ({ symbol: x.symbol, change: Number((x.change ?? x.changePercent) ?? 0) }))
                  : [],
            }));
          }
          return [];
        };

        const normalized = normalize(data?.sectors);
        if (cancelled) return;
        setSectors(normalized);
      } catch {
        setSectors([]);
      }
    })();
    return () => { cancelled = true; };
  }, [preferences.language]);

  const getIntensityColor = (change: number, isHovered: boolean = false): string => {
    const opacity = isHovered ? '90' : '80';
    
    if (change >= 3) return `bg-emerald-500/${opacity} border-emerald-400/40`;
    if (change >= 1.5) return `bg-green-500/${opacity} border-green-400/40`;
    if (change > 0) return `bg-lime-500/${opacity} border-lime-400/40`;
    if (change > -1.5) return `bg-amber-500/${opacity} border-amber-400/40`;
    if (change > -3) return `bg-orange-500/${opacity} border-orange-400/40`;
    return `bg-red-500/${opacity} border-red-400/40`;
  };

  const getTextColor = (change: number): string => {
    const isDark = resolvedTheme === 'dark';
    return isDark ? 'text-white' : 'text-black';
  };

  const getSectorBasis = (marketCap: number): string => {
    const caps = sectors.map(s => Number(s.marketCap)).filter(n => Number.isFinite(n) && n > 0);
    const maxCap = caps.length ? Math.max(...caps) : 1;
    const ratio = maxCap > 0 ? marketCap / maxCap : 0;

    if (ratio > 0.8) return 'basis-full lg:basis-1/2';
    if (ratio > 0.6) return 'basis-1/2 lg:basis-1/3';
    if (ratio > 0.4) return 'basis-1/2 lg:basis-1/4';
    return 'basis-1/3 lg:basis-1/5';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-3.5 h-3.5" />;
    if (change < 0) return <TrendingDown className="w-3.5 h-3.5" />;
    return <Activity className="w-3.5 h-3.5" />;
  };

  const averageChange = sectors.length > 0 
    ? sectors.reduce((sum, s) => sum + s.change, 0) / sectors.length 
    : 0;

  return (
    <div className="bg-gradient-to-br from-card/95 to-card rounded-2xl border border-border/50 p-6 shadow-lg backdrop-blur-sm">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {translate(preferences.language, 'heatmap.title', 'Market Heatmap')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {translate(preferences.language, 'heatmap.subtitle', 'Real-time sector performance overview')}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm font-medium text-muted-foreground mb-1">
            {translate(preferences.language, 'heatmap.average', 'Market Average')}
          </div>
          <div className={`text-lg font-bold flex items-center space-x-1 ${averageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {getChangeIcon(averageChange)}
            <span>{averageChange >= 0 ? '+' : ''}{averageChange.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Enhanced Responsive Layout with size factor */}
      <div className="flex flex-wrap gap-4 mb-8">
        {sectors.map((sector) => {
          const isSelected = selectedSector === sector.name;
          const isHovered = hoveredSector === sector.name;
          const colorClasses = getIntensityColor(sector.change, isHovered);
          const textColor = getTextColor(sector.change);
          
          return (
            <button
              key={sector.name}
              onClick={() => setSelectedSector(isSelected ? null : sector.name)}
              onMouseEnter={() => setHoveredSector(sector.name)}
              onMouseLeave={() => setHoveredSector(null)}
              className={`
                ${getSectorBasis(sector.marketCap)}
                group relative ${colorClasses} backdrop-blur-sm
                rounded-2xl p-5 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]
                flex flex-col justify-between overflow-hidden border-2 aspect-square
                ${isSelected ? 'ring-4 ring-primary/30 ring-offset-2 ring-offset-background shadow-xl scale-[1.02]' : ''}
                ${textColor} hover:border-opacity-60
              `}
              aria-pressed={isSelected}
            >
              {/* Dynamic background pattern */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10" />
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl ${sector.change >= 0 ? 'bg-white/30' : 'bg-black/20'} transform translate-x-8 -translate-y-8`} />
              </div>

              {/* Performance indicator */}
              <div className="relative z-10 flex justify-between items-start">
                <div className={`p-1.5 rounded-lg backdrop-blur-sm ${sector.change >= 0 ? 'bg-white/20' : 'bg-black/20'} border border-white/20`}>
                  {getChangeIcon(sector.change)}
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm border ${sector.change >= 0 ? 'bg-white/20 border-white/30' : 'bg-black/20 border-black/30'}`}>
                  {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                </div>
              </div>

              {/* Content */}
              <div className="relative z-10 text-left">
                <h3 className="font-bold text-sm mb-2 line-clamp-2 leading-tight">{sector.name}</h3>
                <div className={`text-xs opacity-90 font-medium`}>
                  {formatCompactCurrency(convertFromUSD(sector.marketCap), { locale: preferences.locale, currency: preferences.currency })}
                </div>
              </div>

              {/* Hover effect overlay */}
              <div className={`absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
            </button>
          );
        })}
      </div>

      {/* Enhanced Sector Details */}
      {selectedSector && (
        <div className="bg-background/80 backdrop-blur-sm rounded-2xl p-6 border border-border/50 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <h3 className="text-xl font-bold">{selectedSector}</h3>
              <span className="px-3 py-1 bg-accent/20 rounded-full text-sm font-medium">
                {translate(preferences.language, 'sector.breakdown', 'Sector Breakdown')}
              </span>
            </div>
            <button
              onClick={() => setSelectedSector(null)}
              className="p-2 hover:bg-accent/20 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <span className="sr-only">Close</span>
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {sectors
              .find(s => s.name === selectedSector)
              ?.stocks.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => requestSelection(stock.symbol)}
                  className="group bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4 text-center hover:bg-accent/20 transition-all duration-200 hover:shadow-md hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/25"
                >
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <p className="font-bold text-sm">{stock.symbol}</p>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  </div>
                  <div className={`flex items-center justify-center space-x-1 text-sm font-medium ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {getChangeIcon(stock.change)}
                    <span>{stock.change >= 0 ? '+' : ''}{Number.isFinite(stock.change) ? stock.change.toFixed(2) : '0.00'}%</span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Enhanced Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-6 p-4 bg-accent/5 rounded-xl border border-border/30">
        <div className="text-xs font-medium text-muted-foreground mb-2 w-full text-center">
          {translate(preferences.language, 'heatmap.legend.caption', 'Performance Scale')}
        </div>
        
        {[
          { color: 'bg-emerald-500', label: translate(preferences.language, 'heatmap.legend.veryStrongGains', 'Very Strong Gains'), range: '+3.0%+' },
          { color: 'bg-green-500', label: translate(preferences.language, 'heatmap.legend.strongGains', 'Strong Gains'), range: '+1.5%+' },
          { color: 'bg-lime-500', label: translate(preferences.language, 'heatmap.legend.moderateGains', 'Moderate Gains'), range: '0%+' },
          { color: 'bg-amber-500', label: translate(preferences.language, 'heatmap.legend.moderateLosses', 'Moderate Losses'), range: '0% to -1.5%' },
          { color: 'bg-orange-500', label: translate(preferences.language, 'heatmap.legend.strongLosses', 'Strong Losses'), range: '-1.5% to -3%' },
          { color: 'bg-red-500', label: translate(preferences.language, 'heatmap.legend.veryStrongLosses', 'Very Strong Losses'), range: '-3.0%-' },
        ].map((item, index) => (
          <div key={index} className="flex items-center space-x-2 text-xs">
            <div className={`w-3 h-3 ${item.color} rounded-full shadow-sm border border-white/20`} />
            <span className="font-medium text-foreground">{item.label}</span>
            <span className="text-muted-foreground">({item.range})</span>
          </div>
        ))}
      </div>
    </div>
  );
}