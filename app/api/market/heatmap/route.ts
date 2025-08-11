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

export async function GET(_req: NextRequest) {
  try {
    // Flatten all symbols and fetch in one request
    const allSymbols = Array.from(new Set(Object.values(SECTOR_SYMBOLS).flat()));
    const quotes: any[] = await yahooFinance.quote(allSymbols);
    const symbolToQuote = new Map<string, Quote>();
    for (const q of quotes) symbolToQuote.set(q.symbol, q);

    // Build sector aggregates
    const sectors = Object.entries(SECTOR_SYMBOLS).map(([name, symbols]) => {
      const stocks = symbols
        .map((s) => symbolToQuote.get(s))
        .filter(Boolean) as Quote[];

      const totalCap = stocks.reduce((acc, q) => acc + Number(q.marketCap || 0), 0);
      // Weighted average by marketCap if available, otherwise simple average
      let avgPct = 0;
      if (totalCap > 0) {
        avgPct =
          stocks.reduce(
            (acc, q) => acc + (Number(q.marketCap || 0) / totalCap) * Number(q.regularMarketChangePercent || 0),
            0
          );
      } else if (stocks.length) {
        avgPct = stocks.reduce((acc, q) => acc + Number(q.regularMarketChangePercent || 0), 0) / stocks.length;
      }

      const top = stocks
        .slice(0, 8)
        .map((q) => ({ symbol: q.symbol, change: Number(q.regularMarketChangePercent || 0) }))
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 4);

      return {
        name,
        change: Number(avgPct),
        marketCap: totalCap || stocks.length * 1_000_000_000, // fallback scale
        stocks: top,
      };
    });

    return NextResponse.json({ sectors });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message), sectors: [] }, { status: 502 });
  }
}


