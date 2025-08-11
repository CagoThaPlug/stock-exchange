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
  
  const quoteRes = await yahooFinance.quote(symbols);
  return quoteRes.map((q: any) => ({
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
  const q: any = (await yahooFinance.quote(symbol)) as any;
  return q
    ? {
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: Number(q.regularMarketPrice ?? 0),
        change: Number(q.regularMarketChange ?? 0),
        changePercent: Number(q.regularMarketChangePercent ?? 0),
        volume: Number(q.regularMarketVolume ?? 0),
        marketCap: Number(q.marketCap ?? 0),
        sector: q.sector || undefined,
      }
    : null;
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