'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { usePreferences } from '@/components/providers/PreferencesProvider';

interface CurrencyContextType {
  targetCurrency: string;
  rateFromUSD: number; // multiplier to convert USD -> targetCurrency
  lastUpdated?: string;
  loading: boolean;
  error?: string;
  convertFromUSD: (amountInUSD: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const [rateFromUSD, setRateFromUSD] = useState<number>(1);
  const [lastUpdated, setLastUpdated] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const fallbackRates: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.78,
    JPY: 160,
    CNY: 7.2,
    INR: 83,
    CAD: 1.36,
    AUD: 1.5,
    CHF: 0.85,
  };

  useEffect(() => {
    let cancelled = false;
    async function loadRates() {
      const target = preferences.currency;
      if (target === 'USD') {
        setRateFromUSD(1);
        setError(undefined);
        return;
      }
      // Set an immediate fallback so UI reflects a change even if network is blocked
      if (fallbackRates[target] && !cancelled) {
        setRateFromUSD(fallbackRates[target]);
        setLastUpdated(undefined);
      }
      setLoading(true);
      setError(undefined);
      try {
        const { apiFetch } = await import('@/lib/utils');
        const res = await apiFetch(`/api/fx?base=USD`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Failed loading FX rates`);
        const r = data?.rates?.[target];
        if (!cancelled) {
          const rate = typeof r === 'number' && isFinite(r) ? r : fallbackRates[target] || 1;
          setRateFromUSD(rate);
          setLastUpdated(data?.date);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setRateFromUSD(fallbackRates[preferences.currency] || 1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRates();
    return () => {
      cancelled = true;
    };
  }, [preferences.currency]);

  const value = useMemo<CurrencyContextType>(
    () => ({
      targetCurrency: preferences.currency,
      rateFromUSD,
      lastUpdated,
      loading,
      error,
      convertFromUSD: (amountInUSD: number) => amountInUSD * rateFromUSD,
    }),
    [preferences.currency, rateFromUSD, lastUpdated, loading, error]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}


