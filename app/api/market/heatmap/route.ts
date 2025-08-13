import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

// Simple sector → representative tickers map (large caps, diversified)
const SECTOR_SYMBOLS: Record<string, string[]> = {
  Technology: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'ADBE', 'CRM', 'AMD'],
  Healthcare: ['UNH', 'LLY', 'JNJ', 'ABBV', 'MRK', 'TMO', 'PFE', 'DHR'],
  Finance: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'BLK', 'C', 'AXP'],
  Energy: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'OXY'],
  Consumer: ['AMZN', 'HD', 'MCD', 'KO', 'PEP', 'NKE', 'COST', 'SBUX'],
  Industrial: ['BA', 'CAT', 'HON', 'GE', 'LMT', 'DE', 'UPS', 'RTX'],
};

type Quote = {
  symbol: string;
  regularMarketChangePercent?: number;
  regularMarketChange?: number;
  marketCap?: number;
};

export async function GET(req: NextRequest) {
  try {
    // Flatten all symbols and fetch in one request
    const allSymbols = Array.from(new Set(Object.values(SECTOR_SYMBOLS).flat()));
    let quotes: any[] = [];
    try {
      const res = await yahooFinance.quote(allSymbols);
      quotes = Array.isArray(res) ? res : [res];
    } catch {
      quotes = [];
    }
    const symbolToQuote = new Map<string, Quote>();
    for (const q of quotes) if (q?.symbol) symbolToQuote.set(q.symbol, q);

    // Helper to pick N random unique items from an array
    const pickRandom = <T,>(arr: T[], n: number): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, Math.min(n, copy.length));
    };

    // Build sector aggregates (primary path)
    let sectors = Object.entries(SECTOR_SYMBOLS).map(([name, symbols]) => {
      const stocks = symbols
        .map((s) => symbolToQuote.get(s))
        .filter(Boolean) as Quote[];

      let totalCap = stocks.reduce((acc, q) => acc + Number(q.marketCap || 0), 0);
      // Weighted average by marketCap if available, otherwise simple average
      let avgPct = 0;
      if (stocks.length) {
        if (totalCap <= 0) {
          // If market caps are missing due to quote block, approximate using equal weights
          avgPct = stocks.reduce((acc, q) => acc + Number(q.regularMarketChangePercent || 0), 0) / stocks.length;
          totalCap = stocks.length * 1_000_000_000; // approximate to size tiles
        } else {
          avgPct = stocks.reduce(
            (acc, q) => acc + (Number(q.marketCap || 0) / totalCap) * Number(q.regularMarketChangePercent || 0),
            0
          );
        }
      }

      // Pick a random subset first to avoid showing the same names repeatedly,
      // then take the strongest movers to ensure visible differentiation
      const subset = pickRandom(stocks, 8);
      const topQuotes = subset
        .slice() // shallow copy
        .sort((a, b) => Math.abs(Number(b.regularMarketChangePercent || 0)) - Math.abs(Number(a.regularMarketChangePercent || 0)))
        .slice(0, 4);
      const top = topQuotes.map((q) => ({ symbol: q.symbol, change: Number(q.regularMarketChangePercent || 0) }));

      // Align sector tile percent with what is displayed: average of the 4 shown stocks
      let displayAvg = 0;
      if (topQuotes.length) {
        // If market caps available for these four, weight by cap; otherwise equal-weight
        const capSum = topQuotes.reduce((acc, q) => acc + Number(q.marketCap || 0), 0);
        if (capSum > 0) {
          displayAvg = topQuotes.reduce(
            (acc, q) => acc + (Number(q.marketCap || 0) / capSum) * Number(q.regularMarketChangePercent || 0),
            0
          );
        } else {
          displayAvg = topQuotes.reduce((acc, q) => acc + Number(q.regularMarketChangePercent || 0), 0) / topQuotes.length;
        }
      }

      return {
        name,
        // Use displayAvg to match the visible movers list; keep totalCap for sizing
        change: Number(displayAvg),
        marketCap: totalCap || stocks.length * 1_000_000_000,
        stocks: top,
      };
    });

    // Fallback: if we failed to get any stock-level data (e.g., quote 401), use sector ETFs to estimate
    const noData = sectors.every((s) => !s.marketCap || s.marketCap === 0);
    let usedEtfFallback = false;
    if (noData) {
      const SECTOR_ETF: Record<string, string> = {
        Technology: 'XLK',
        Healthcare: 'XLV',
        Finance: 'XLF',
        Energy: 'XLE',
        Consumer: 'XLY',
        Industrial: 'XLI',
      };
      const WEIGHTS: Record<string, number> = {
        Technology: 28,
        Healthcare: 13,
        Finance: 12,
        Consumer: 10,
        Industrial: 8,
        Energy: 4,
      };
      const items: Array<{ name: string; change: number; marketCap: number; stocks: any[] }> = [];
      for (const [name, etf] of Object.entries(SECTOR_ETF)) {
        try {
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          const res: any = await yahooFinance.chart(etf, {
            period1: new Date(now - 7 * dayMs),
            period2: new Date(now),
            interval: '1d',
          } as any);
          const quotes = Array.isArray(res?.quotes) ? res.quotes : [];
          const closes = quotes.map((q: any) => Number(q.close)).filter((n: number) => Number.isFinite(n));
          const last = closes[closes.length - 1];
          const prev = closes[closes.length - 2];
          const changePct = Number.isFinite(last) && Number.isFinite(prev) && prev !== 0 ? ((last - prev) / prev) * 100 : 0;
          items.push({
            name,
            change: changePct,
            marketCap: WEIGHTS[name] * 1_000_000_000_000, // synthetic scale for sizing differences
            stocks: [],
          });
        } catch {
          items.push({ name, change: 0, marketCap: WEIGHTS[name] * 1_000_000_000_000, stocks: [] });
        }
      }
      sectors = items;
      usedEtfFallback = true;
    }

    // If we used the ETF fallback (or stocks arrays are empty), populate per-sector breakdown stocks
    if (usedEtfFallback || sectors.every((s) => !Array.isArray(s.stocks) || s.stocks.length === 0)) {
      const computeChangePct = async (symbol: string): Promise<number> => {
        // Prefer real-time quote change percent when available; fallback to daily chart delta
        try {
          const q: any = await yahooFinance.quote(symbol as any).catch(() => null);
          const pct = Number(q?.regularMarketChangePercent ?? NaN);
          if (Number.isFinite(pct)) return pct;
        } catch {}
        try {
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          const res: any = await yahooFinance.chart(symbol, {
            period1: new Date(now - 7 * dayMs),
            period2: new Date(now),
            interval: '1d',
          } as any);
          const quotes = Array.isArray(res?.quotes) ? res.quotes : [];
          const closes = quotes.map((q: any) => Number(q.close)).filter((n: number) => Number.isFinite(n));
          const last = closes[closes.length - 1];
          const prev = closes[closes.length - 2];
          if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return 0;
          return ((last - prev) / prev) * 100;
        } catch {
          return 0;
        }
      };

      const updated = [] as typeof sectors;
      for (const sector of sectors) {
        const symbols = SECTOR_SYMBOLS[sector.name] || [];
        const subset = pickRandom(symbols, 8);
        const settled = await Promise.allSettled(subset.map((s) => computeChangePct(s)));
        const stocks = subset
          .map((symbol, i) => {
            const r: any = settled[i] as any;
            const change = r && r.status === 'fulfilled' ? Number(r.value) : 0;
            return { symbol, change };
          })
          .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
          .slice(0, 4);
        const avg = stocks.length ? stocks.reduce((acc, s) => acc + s.change, 0) / stocks.length : sector.change;
        updated.push({ ...sector, stocks, change: avg });
      }
      sectors = updated;
    }

    const debug = req.nextUrl.searchParams.get('debug') === '1' || req.nextUrl.searchParams.get('debug') === 'true';
    return NextResponse.json(
      debug ? withDebug(req, { sectors }) : { sectors },
      { headers: debugHeaders(req) }
    );
  } catch (e) {
    // Do not bubble up a 502; return error in body with 200 to keep UI functional in production
    const body = { error: String((e as Error).message), sectors: [] } as any;
    return NextResponse.json(
      req.nextUrl.searchParams.get('debug') ? withDebug(req, body) : body,
      { status: 200, headers: debugHeaders(req) }
    );
  }
}

function debugHeaders(req: NextRequest): Record<string, string> {
  const ray = req.headers.get('cf-ray') || '';
  const colo = req.headers.get('cf-ray')?.split('-')[1] || '';
  const country = req.headers.get('cf-ipcountry') || '';
  return ray || colo || country
    ? {
        'X-Debug-CF-Ray': ray,
        ...(colo ? { 'X-Debug-CF-Colo': colo } : {}),
        ...(country ? { 'X-Debug-CF-Country': country } : {}),
      }
    : {};
}

function withDebug<T extends object>(req: NextRequest, data: T): T & { __debug: any } {
  const ray = req.headers.get('cf-ray') || null;
  const colo = (req.headers.get('cf-ray') || '').split('-')[1] || null;
  const country = req.headers.get('cf-ipcountry') || null;
  return {
    ...data,
    __debug: {
      runtime: 'edge',
      cfRay: ray,
      cfColo: colo,
      cfCountry: country,
    },
  };
}


