import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';
import { searchSymbols, fetchMovers } from '@/lib/market-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

type TickerItem = {
  symbol: string;
  name?: string;
  change?: number;
  changePercent?: number;
};

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export async function GET(_req: NextRequest) {
  try {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const queries = pickRandom(alphabet.split(''), 5);

    // Gather candidates via search
    const candidatesSet = new Map<string, { symbol: string; name?: string }>();
    for (const q of queries) {
      try {
        const results = await searchSymbols(q);
        for (const r of results) {
          const sym = r.symbol?.toUpperCase();
          if (!sym) continue;
          // Prefer common equities/ETFs
          const type = (r as any)?.type || '';
          if (!candidatesSet.has(sym) && /EQUITY|ETF/i.test(type)) {
            candidatesSet.set(sym, { symbol: sym, name: r.name });
          }
        }
      } catch {}
    }

    // Fallback symbols to ensure we have candidates even if search is blocked
    const fallbackSymbols = [
      'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','BRK-B','JPM','V','JNJ','WMT','PG','DIS','MA','HD','XOM','CVX','PFE','KO'
    ];
    if (candidatesSet.size < 10) {
      for (const s of fallbackSymbols) {
        if (!candidatesSet.has(s)) candidatesSet.set(s, { symbol: s, name: s });
      }
    }

    const candidates = Array.from(candidatesSet.values()).slice(0, 50);
    if (candidates.length === 0) {
      return NextResponse.json({ items: [], lastUpdated: new Date().toISOString() }, { status: 200 });
    }

    // Fetch quotes in batch
    let quotes: any[] = [];
    try {
      const batch = await yahooFinance.quote(candidates.map(c => c.symbol));
      quotes = Array.isArray(batch) ? batch : (batch ? [batch] : []);
    } catch {
      quotes = [];
    }
    const items: TickerItem[] = Array.isArray(quotes)
      ? quotes.map((q: any) => ({
          symbol: q.symbol,
          name: q.shortName || q.longName || q.symbol,
          change: Number(q.regularMarketChange ?? 0),
          changePercent: Number(q.regularMarketChangePercent ?? 0),
        }))
      : [];

    let filtered = items.filter(i => i.symbol && Number.isFinite(i.changePercent as number));
    if (filtered.length < 5) {
      // Robust fallback: use movers endpoints
      try {
        const [g, l, a] = await Promise.all([
          fetchMovers('gainers').catch(() => []),
          fetchMovers('losers').catch(() => []),
          fetchMovers('actives').catch(() => []),
        ]);
        const merged = [...g, ...l, ...a].map((q: any) => ({
          symbol: q.symbol,
          name: q.name,
          change: q.change,
          changePercent: q.changePercent,
        }));
        filtered = filtered.concat(merged);
      } catch {}
    }

    const deduped = Array.from(new Map(filtered.map(i => [i.symbol, i])).values());
    const picked = pickRandom(deduped, 5);

    return NextResponse.json({ items: picked, lastUpdated: new Date().toISOString() }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ items: [], error: (e as Error).message }, { status: 200 });
  }
}


