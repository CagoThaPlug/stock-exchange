// Market data fetch utilities using yahoo-finance2 (no mock fallbacks)

import yahooFinance from '@/lib/yahoo';

export type MarketIndex = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
};

export async function fetchIndices(): Promise<MarketIndex[]> {
  const symbols = [
    '^GSPC', '^DJI', '^IXIC', '^RUT', '^FTSE', '^GDAXI', '^N225', '^HSI', 'NVDA', 'AAPL',
    'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK-B', 'JPM', 'V', 'JNJ', 'WMT',
    'BAC', 'PG', 'DIS', 'MA', 'HD', 'PYPL', 'ADBE', 'NFLX', 'KO', 'XOM',
    'PFE', 'CSCO', 'T', 'MRK', 'VZ', 'PEP', 'CRM', 'ABBV', 'NKE', 'CVX',
    'MCD', 'INTC', 'ACN', 'LLY', 'COST', 'AVGO', 'QCOM', 'TXN', 'ORCL', 'NEE',
    'BMY', 'UPS', 'DHR', 'LIN', 'AMGN', 'LOW', 'SBUX', 'C', 'PM', 'INTU',
    'RTX', 'GILD', 'HON', 'MDT', 'BA', 'CAT', 'BLK', 'CHTR', 'SPGI', 'DE',
    'F', 'GM', 'LMT', 'ZTS', 'MMM', 'ISRG', 'CVS', 'TMUS', 'ANTM', 'NOW',
    'SYK', 'SCHW', 'TMO', 'BKNG', 'PLD', 'CSX', 'ADI', 'MO', 'CCI', 'PNC',
    'SO', 'DUK', 'CB', 'MET', 'SHW', 'BDX', 'CL', 'FIS', 'GD', 'ECL',
    'ICE', 'AON', 'USB', 'MMC', 'ADP', 'EL', 'PNR', 'PSA', 'ITW', 'GMAB',
    'NSC', 'VRTX', 'MAR', 'EW', 'ATVI', 'AEP', 'FDX', 'EXC', 'KMB', 'EMR',
    'MNST', 'WBA', 'CTAS', 'KR', 'CME', 'VLO', 'TGT', 'PGR', 'AIG', 'DG',
    'HUM', 'APD', 'NOC', 'LRCX', 'OXY', 'MCO', 'STZ', 'ROST', 'SYY', 'DLR',
    'ALGN', 'ZBH', 'SPG', 'BSX', 'GLW', 'PH', 'FAST', 'XLNX', 'CTSH', 'EA',
    'KEYS', 'COF', 'AFL', 'BIIB', 'ANSS', 'CTXS', 'EA', 'SYF', 'CDNS', 'PAYX',
    'TEL', 'D', 'MTB', 'BK', 'BAX', 'RMD', 'BKR', 'WELL', 'ORLY', 'HSIC',
    'CNC', 'XRAY', 'ES', 'NTRS', 'ESS', 'HCA', 'INFO', 'KMI', 'VRSN', 'ALLE',
    'PKI', 'VFC', 'MAA', 'DLTR', 'FTNT', 'ROK', 'FISV', 'ODFL', 'CLX', 'EVRG'
  ];
  
  // Pick a random selection of up to 3 symbols each call for performance
  const pickRandom = <T,>(arr: T[], n: number): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(n, copy.length));
  };
  const selected = pickRandom(symbols, 3);

  // Chunk in case we later increase selection size; harmless for 3
  const chunkSize = 50;
  const chunks: string[][] = [];
  for (let i = 0; i < selected.length; i += chunkSize) {
    chunks.push(selected.slice(i, i + chunkSize));
  }

  const results: any[] = [];
  for (const c of chunks) {
    try {
      const res = await yahooFinance.quote(c);
      results.push(...(Array.isArray(res) ? res : [res]));
    } catch {
      // skip failed chunk
    }
  }

  // If quotes are blocked (e.g., Yahoo 401), provide a minimal fallback using chart for core indices
  if (results.length === 0) {
    const core: Array<{ symbol: string; name: string }> = [
      { symbol: '^GSPC', name: 'S&P 500' },
      { symbol: '^DJI', name: 'Dow Jones' },
      { symbol: '^IXIC', name: 'NASDAQ' },
      { symbol: '^RUT', name: 'Russell 2000' },
      { symbol: '^FTSE', name: 'FTSE 100' },
      { symbol: '^GDAXI', name: 'DAX' },
      { symbol: '^N225', name: 'Nikkei 225' },
      { symbol: '^HSI', name: 'Hang Seng' },
      { symbol: 'NVDA', name: 'NVIDIA' },
      { symbol: 'AAPL', name: 'Apple' },
      { symbol: 'MSFT', name: 'Microsoft' },
      { symbol: 'GOOGL', name: 'Alphabet' },
      { symbol: 'AMZN', name: 'Amazon' },
      { symbol: 'META', name: 'Meta Platforms' },
      { symbol: 'TSLA', name: 'Tesla' },
      { symbol: 'BRK-B', name: 'Berkshire Hathaway' },
      { symbol: 'JPM', name: 'JPMorgan Chase' },
      { symbol: 'V', name: 'Visa' },
      { symbol: 'JNJ', name: 'Johnson & Johnson' },
      { symbol: 'WMT', name: 'Walmart' },
      { symbol: 'BAC', name: 'Bank of America' },
      { symbol: 'PG', name: 'Procter & Gamble' },
      { symbol: 'DIS', name: 'Disney' },
      { symbol: 'MA', name: 'Mastercard' },
      { symbol: 'HD', name: 'Home Depot' },
      { symbol: 'PYPL', name: 'PayPal' },
      { symbol: 'ADBE', name: 'Adobe' },
      { symbol: 'NFLX', name: 'Netflix' },
      { symbol: 'KO', name: 'Coca-Cola' },
      { symbol: 'XOM', name: 'Exxon Mobil' },
      { symbol: 'PFE', name: 'Pfizer' },
      { symbol: 'CSCO', name: 'Cisco Systems' },
      { symbol: 'T', name: 'AT&T' },
      { symbol: 'MRK', name: 'Merck' },
      { symbol: 'VZ', name: 'Verizon' },
      { symbol: 'PEP', name: 'PepsiCo' },
      { symbol: 'CRM', name: 'Salesforce' },
      { symbol: 'ABBV', name: 'AbbVie' },
      { symbol: 'NKE', name: 'Nike' },
      { symbol: 'CVX', name: 'Chevron' },
      { symbol: 'MCD', name: 'McDonald\'s' },
      { symbol: 'INTC', name: 'Intel' },
      { symbol: 'ACN', name: 'Accenture' },
      { symbol: 'LLY', name: 'Eli Lilly' },
      { symbol: 'COST', name: 'Costco' },
      { symbol: 'AVGO', name: 'Broadcom' },
      { symbol: 'QCOM', name: 'Qualcomm' },
      { symbol: 'TXN', name: 'Texas Instruments' },
      { symbol: 'ORCL', name: 'Oracle' },
      { symbol: 'NEE', name: 'NextEra Energy' },
      { symbol: 'BMY', name: 'Bristol Myers Squibb' },
      { symbol: 'UPS', name: 'United Parcel Service' },
    ];
    const fallbacks: MarketIndex[] = [];
    const selectedCore = pickRandom(core, 3);
    for (const { symbol, name } of selectedCore) {
      try {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const { quotes } = await yahooFinance.chart(symbol, {
          period1: new Date(now - 7 * dayMs),
          period2: new Date(now),
          interval: '1d',
        } as any);
        const closes = (quotes || []).map((q: any) => Number(q.close)).filter((n: number) => Number.isFinite(n));
        const last = closes[closes.length - 1];
        const prev = closes[closes.length - 2];
        if (!Number.isFinite(last) || !Number.isFinite(prev)) continue;
        const change = last - prev;
        const changePercent = prev !== 0 ? (change / prev) * 100 : 0;
        fallbacks.push({ symbol, name, price: last, change, changePercent });
      } catch {
        // ignore this symbol
      }
    }
    if (fallbacks.length) return fallbacks;
  }

  return results.map((q: any) => ({
    symbol: q.symbol,
    name: q.shortName || q.longName || q.symbol,
    price: Number(q.regularMarketPrice ?? 0),
    change: Number(q.regularMarketChange ?? 0),
    changePercent: Number(q.regularMarketChangePercent ?? 0),
  }));
}

export type MoverQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
};

export async function fetchMovers(type: 'gainers' | 'losers' | 'actives'): Promise<MoverQuote[]> {
  const screenerId = type === 'gainers' ? 'day_gainers' : type === 'losers' ? 'day_losers' : 'most_actives';
  const res = await yahooFinance.screener({ scrIds: screenerId as any, count: 25 });
  const quotes: any[] = Array.isArray((res as any)?.quotes) ? (res as any).quotes : [];
  return quotes.slice(0, 25).map((q: any) => ({
    symbol: q.symbol,
    name: q.shortName || q.longName || q.symbol,
    price: Number(q.regularMarketPrice ?? 0),
    change: Number(q.regularMarketChange ?? 0),
    changePercent: Number(q.regularMarketChangePercent ?? 0),
    volume: Number(q.regularMarketVolume ?? 0),
  }));
}

export type SymbolSearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
};

export async function searchSymbols(q: string): Promise<SymbolSearchResult[]> {
  if (!q?.trim()) return [];
  const res = await yahooFinance.search(q, { quotesCount: 10, newsCount: 0 });
  const quotes: any[] = Array.isArray(res?.quotes) ? res.quotes : [];
  return quotes
    .filter((e) => e.symbol)
    .map((e) => ({
      symbol: e.symbol,
      name: e.shortname || e.longname || e.symbol,
      exchange: e.exchDisp || 'NYSE',
      type: e.quoteType || 'EQUITY',
    }));
}

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  sector?: string;
};

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  if (!symbol?.trim()) return null;
  try {
    const q: any = (await yahooFinance.quote(symbol)) as any;
    if (!q) throw new Error('quote-null');
    const base = {
      symbol: q.symbol,
      name: q.shortName || q.longName || q.symbol,
      price: Number(q.regularMarketPrice ?? 0),
      change: Number(q.regularMarketChange ?? 0),
      changePercent: Number(q.regularMarketChangePercent ?? 0),
      volume: Number(q.regularMarketVolume ?? 0),
      marketCap: Number(q.marketCap ?? 0),
      sector: q.sector || undefined,
    } as Quote;
    if (base.marketCap && base.volume) return base;
    // Enrich with quoteSummary if partial
    try {
      const summary = await (yahooFinance as any).quoteSummary?.(symbol, ['price', 'summaryDetail', 'defaultKeyStatistics']).catch(() => null);
      if (summary) {
        base.marketCap = Number(
          (summary?.price?.marketCap?.raw ??
            summary?.defaultKeyStatistics?.marketCap?.raw ??
            summary?.summaryDetail?.marketCap?.raw ??
            base.marketCap) ?? 0
        );
        base.volume = Number(
          (summary?.price?.regularMarketVolume?.raw ??
            summary?.summaryDetail?.volume?.raw ??
            summary?.summaryDetail?.averageDailyVolume3Month?.raw ??
            base.volume) ?? 0
        );
        base.name = summary?.price?.shortName || summary?.price?.longName || base.name;
      }
    } catch {}
    if (base.marketCap && base.volume) return base;
    // otherwise fall through to chart fallback to fill remaining
    throw new Error('need-fallback');
  } catch (err) {
    // Fallbacks when quote API is blocked
    try {
      // Attempt quoteSummary for fundamentals (marketCap) and summaryDetail (volume)
      const summary = await (yahooFinance as any).quoteSummary?.(symbol, ['price', 'summaryDetail', 'defaultKeyStatistics']).catch(() => null);

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const res: any = await yahooFinance.chart(symbol, {
        period1: new Date(now - 7 * dayMs),
        period2: new Date(now),
        interval: '1d',
      } as any);
      const quotes: Array<{ date: Date; close: number; volume?: number }> = Array.isArray(res?.quotes) ? res.quotes : [];
      const closes = quotes.map((q) => Number(q.close)).filter((n) => Number.isFinite(n));
      const last = closes[closes.length - 1];
      const prev = closes[closes.length - 2];
      if (!Number.isFinite(last) || !Number.isFinite(prev)) return null;
      const change = last - prev;
      const changePercent = prev !== 0 ? (change / prev) * 100 : 0;

      // Pull marketCap and volume if present in summary
      let mcap = Number(
        summary?.price?.marketCap?.raw ??
        summary?.defaultKeyStatistics?.marketCap?.raw ??
        summary?.summaryDetail?.marketCap?.raw ?? 0
      );
      if (!Number.isFinite(mcap) || mcap === 0) {
        // Approximate market cap using price * sharesOutstanding if present
        let shares = Number(
          summary?.defaultKeyStatistics?.sharesOutstanding?.raw ??
          summary?.price?.sharesOutstanding?.raw ?? 0
        );
        if (!Number.isFinite(shares) || shares === 0) {
          try {
            const fetched = await (yahooFinance as any).fetchLatestSharesOutstanding?.(symbol);
            if (typeof fetched === 'number' && Number.isFinite(fetched) && fetched > 0) shares = fetched;
          } catch {}
        }
        if (Number.isFinite(shares) && shares > 0 && Number.isFinite(last) && last > 0) {
          mcap = last * shares;
        }
      }
      let vol = Number(
        summary?.price?.regularMarketVolume?.raw ??
        summary?.summaryDetail?.volume?.raw ??
        summary?.summaryDetail?.averageDailyVolume3Month?.raw ?? 0
      );
      if (!Number.isFinite(vol) || vol === 0) {
        const vols = quotes.map((q) => Number(q.volume)).filter((n) => Number.isFinite(n) && n > 0);
        vol = vols[vols.length - 1] ?? 0;
      }

      return {
        symbol,
        name: summary?.price?.shortName || summary?.price?.longName || symbol,
        price: last,
        change,
        changePercent,
        volume: Number.isFinite(vol) ? vol : 0,
        marketCap: Number.isFinite(mcap) ? mcap : 0,
        sector: undefined,
      };
    } catch {
      return null;
    }
  }
}


export type ChartPoint = { time: string; price: number };

export async function fetchChart(symbol: string, range: string = '1mo', interval: string = '1d'): Promise<ChartPoint[]> {
  if (!symbol?.trim()) {
    if (process.env.NODE_ENV !== 'production') console.log('No symbol provided');
    return [];
  }

  if (process.env.NODE_ENV !== 'production') console.log(`Fetching chart for ${symbol}, range: ${range}, interval: ${interval}`);

  // Valid intervals for yahoo-finance2
  const allowedIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'] as const;
  const normalizeInterval = (i: string) => (allowedIntervals as readonly string[]).includes(i) ? i : '1d';

  const rangeToDays: Record<string, number> = {
    '1d': 1,
    '5d': 5,
    '1mo': 30,
    '3mo': 90,
    '6mo': 180,
    '1y': 365,
    '2y': 730,
    '5y': 1825,
    '10y': 3650,
  };

  const candidates: Array<{ days: number; interval: string }> = [];
  const primaryDays = rangeToDays[range] ?? 30;
  const normalizedInterval = normalizeInterval(interval);
  
  candidates.push({ days: primaryDays, interval: normalizedInterval });
  
  // Add fallbacks only if the primary request fails
  candidates.push({ days: 90, interval: '1d' });
  candidates.push({ days: 365, interval: '1wk' });

  for (const cand of candidates) {
    try {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const period1 = new Date(now - cand.days * dayMs);
      const period2 = new Date(now);

      const res: any = await yahooFinance.chart(symbol, {
        period1,
        period2,
        interval: cand.interval as any,
      });

      const quotes: Array<{ date: Date; close: number }> = Array.isArray(res?.quotes) ? res.quotes : [];
      if (!quotes.length) continue;

      const points: ChartPoint[] = quotes
        .map((q) => ({ time: new Date(q.date).toISOString().split('T')[0], price: Math.round(Number(q.close) * 100) / 100 }))
        .filter((p) => Number.isFinite(p.price) && p.price > 0);

      if (points.length >= 2) return points;
    } catch {
      // try next candidate
    }
  }

  if (process.env.NODE_ENV !== 'production') console.log('All candidates failed, returning empty array');
  return [];
}

// Alternative simpler version for testing
export async function fetchChartSimple(symbol: string): Promise<ChartPoint[]> {
  try {
    if (process.env.NODE_ENV !== 'production') console.log(`Fetching simple chart for ${symbol}`);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1); // 1 month ago
    
    const result = await yahooFinance.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });

    if (process.env.NODE_ENV !== 'production') console.log('Simple chart response:', result);
    
    // Log the full structure to understand what we're getting
    if (process.env.NODE_ENV !== 'production') console.log('Response keys:', Object.keys(result || {}));
    
    return [];
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('Simple chart error:', error);
    return [];
  }
}