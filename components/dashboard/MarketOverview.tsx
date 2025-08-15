'use client';

import { useState, useEffect } from 'react';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { formatCurrency } from '@/lib/format';
import { translate } from '@/lib/i18n';
import { useCurrency } from '@/components/providers/CurrencyProvider';
import { TrendingUp, TrendingDown, Clock, Globe, AlertCircle } from 'lucide-react';
import { useIndicesData } from '@/hooks/useUnifiedMarketData';

interface MarketIndex {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

export function MarketOverview() {
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [marketStatus, setMarketStatus] = useState('');
  const [timeUntilOpen, setTimeUntilOpen] = useState<string>('');
  const { preferences } = usePreferences();
  const { convertFromUSD } = useCurrency();

  // Use the unified market data hook
  const { 
    indices: rawIndices, 
    loading, 
    error, 
    refresh, 
    marketStatus: unifiedMarketStatus 
  } = useIndicesData({
    updateInterval: 30000,
    enableRealTime: true
  });

  // Process indices data
  const indices: MarketIndex[] = rawIndices.map((index: any) => ({
    symbol: index.symbol || '',
    name: index.name || '',
    price: typeof index.price === 'number' ? index.price : null,
    change: typeof index.change === 'number' ? index.change : null,
    changePercent: typeof index.changePercent === 'number' ? index.changePercent : null,
  })).filter(index => 
    index.symbol && 
    index.name && 
    index.price !== null && 
    !isNaN(index.price)
  ).slice(0, 3); // Limit to 3 indices for the overview

  // Helper function to safely format numbers
  const safeToFixed = (value: number | null, digits: number = 2): string => {
    return value !== null && !isNaN(value) ? value.toFixed(digits) : '0.00';
  };

  // Helper function to safely get change sign
  const getChangeSign = (value: number | null): string => {
    if (value === null || isNaN(value)) return '';
    return value >= 0 ? '+' : '';
  };

  // Helper function to determine if value is positive
  const isPositive = (value: number | null): boolean => {
    return value !== null && !isNaN(value) && value >= 0;
  };

  // Helper to get current New York (America/New_York) time parts
  type NYTimeParts = { weekdayIndex: number; hour: number; minute: number; second: number };
  const getNYTimeParts = (): NYTimeParts => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    let weekdayStr = '';
    let hourStr = '0';
    let minuteStr = '0';
    let secondStr = '0';
    for (const p of parts) {
      if (p.type === 'weekday') weekdayStr = p.value;
      if (p.type === 'hour') hourStr = p.value;
      if (p.type === 'minute') minuteStr = p.value;
      if (p.type === 'second') secondStr = p.value;
    }
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      weekdayIndex: weekdayMap[weekdayStr] ?? 0,
      hour: parseInt(hourStr, 10),
      minute: parseInt(minuteStr, 10),
      second: parseInt(secondStr, 10),
    };
  };

  // Helper to compute seconds until next market open at 9:00 AM New York time
  const getSecondsUntilNextOpenNY = (): number => {
    const { weekdayIndex, hour, minute, second } = getNYTimeParts();
    const nowSeconds = hour * 3600 + minute * 60 + second;
    const openSeconds = 9 * 3600; // 9:00 AM
    const closeSeconds = 16 * 3600; // 4:00 PM

    const isWeekend = weekdayIndex === 0 || weekdayIndex === 6; // Sun or Sat
    // If it's a weekday and before open
    if (!isWeekend && nowSeconds < openSeconds) {
      return openSeconds - nowSeconds;
    }
    // If during or after close, or weekend, find next weekday's 9:00 AM
    let daysUntil = 0;
    if (isWeekend) {
      // To Monday
      daysUntil = (1 - weekdayIndex + 7) % 7 || 7; // Sun->1, Sat->2
    } else if (nowSeconds >= closeSeconds) {
      // After close
      daysUntil = weekdayIndex === 5 ? 3 : 1; // Fri->Mon (3 days), else next day
    } else {
      // During market hours (should not be called for countdown usage)
      return 0;
    }
    const secondsLeftToday = 24 * 3600 - nowSeconds;
    const wholeDaysInBetween = Math.max(0, daysUntil - 1);
    return secondsLeftToday + wholeDaysInBetween * 24 * 3600 + openSeconds;
  };

  // Update market status based on unified market status or local calculation
  useEffect(() => {
    const updateMarketStatus = () => {
      let marketOpen = false;
      
      if (unifiedMarketStatus) {
        marketOpen = unifiedMarketStatus.isOpen;
      } else {
        // Fallback to local calculation
        const ny = getNYTimeParts();
        const isWeekendNY = ny.weekdayIndex === 0 || ny.weekdayIndex === 6;
        const isBusinessHoursNY = ny.hour >= 9 && ny.hour < 16;
        marketOpen = !isWeekendNY && isBusinessHoursNY;
      }
      
      setIsMarketOpen(marketOpen);
      setMarketStatus(
        marketOpen
          ? translate(preferences.language, 'market.open', 'Market Open')
          : translate(preferences.language, 'market.closed', 'Market Closed')
      );
    };

    updateMarketStatus();
    
    // Update market status every minute
    const interval = setInterval(updateMarketStatus, 60000);
    return () => clearInterval(interval);
  }, [preferences.language, unifiedMarketStatus]);

  // Countdown ticker for next open when market is closed
  useEffect(() => {
    if (isMarketOpen) {
      setTimeUntilOpen('');
      return;
    }
    const update = () => {
      const seconds = getSecondsUntilNextOpenNY();
      if (seconds <= 0 || !isFinite(seconds)) {
        setTimeUntilOpen('');
        return;
      }
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const minsStr = mins.toString().padStart(2, '0');
      const secsStr = secs.toString().padStart(2, '0');
      setTimeUntilOpen(`${hrs}h ${minsStr}m ${secsStr}s`);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [isMarketOpen]);

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

  if (error) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">{translate(preferences.language, 'market.overview', 'Market Overview')}</h2>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Market data temporarily unavailable
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated card-interactive rounded-xl p-6">
      {/* Enhanced Header with better visual hierarchy */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {translate(preferences.language, 'market.overview', 'Market Overview')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {translate(preferences.language, 'market.subtitle', 'Real-time market indices')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <div className="text-right">
            <span className="text-sm font-medium flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {translate(
                preferences.language,
                isMarketOpen ? 'market.open' : 'market.closed',
                isMarketOpen ? 'Market Open' : 'Market Closed'
              )}
            </span>
            {!isMarketOpen && timeUntilOpen && (
              <span className="text-xs text-muted-foreground">
                {translate(preferences.language, 'market.opensIn', 'Opens in')} {timeUntilOpen}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Indices Grid with better responsive behavior */}
      {indices.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No market data available</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {indices.map((index, i) => (
            <div
              key={index.symbol}
              className="bg-background/50 backdrop-blur-sm rounded-xl p-4 border border-border/50 hover:shadow-lg hover:border-primary/20 transition-all duration-300 group animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{index.name || index.symbol}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{index.symbol}</p>
                </div>
                <div className={`p-2 rounded-lg transition-all duration-300 ${
                  isPositive(index.change) 
                    ? 'bg-green-100 dark:bg-green-900/50 group-hover:bg-green-200 dark:group-hover:bg-green-900/70' 
                    : 'bg-red-100 dark:bg-red-900/50 group-hover:bg-red-200 dark:group-hover:bg-red-900/70'
                }`}>
                  {isPositive(index.change) ? (
                    <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-lg font-bold tracking-tight">
                  {index.price !== null && !isNaN(index.price) ? (
                    formatCurrency(convertFromUSD(index.price), { 
                      locale: preferences.locale, 
                      currency: preferences.currency, 
                      maximumFractionDigits: 2 
                    })
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${
                    isPositive(index.change) 
                      ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30' 
                      : 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {getChangeSign(index.change)}{safeToFixed(index.change)}
                  </span>
                  <span className={`text-xs font-medium ${
                    isPositive(index.changePercent) 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    ({getChangeSign(index.changePercent)}{safeToFixed(index.changePercent)}%)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}