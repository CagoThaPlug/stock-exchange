import { NextRequest, NextResponse } from 'next/server';
import { fetchIndices, fetchMovers, searchSymbols, fetchQuote, fetchChart } from '@/lib/market-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Unified market data endpoint
// Modes:
//  - /api/market/data?section=indices
//  - /api/market/data?section=movers&type=gainers|losers|actives
//  - /api/market/data?section=search&q=TSLA
//  - /api/market/data?section=quote&symbol=TSLA
//  - /api/market/data?section=chart&symbol=TSLA&range=1mo&interval=1d

export async function GET(req: NextRequest) {
  const section = (req.nextUrl.searchParams.get('section') || 'indices').toLowerCase();

  try {
    if (section === 'indices') {
      const indices = await fetchIndices();
      return NextResponse.json({ indices });
    }

    if (section === 'movers') {
      const type = (req.nextUrl.searchParams.get('type') || 'gainers') as 'gainers' | 'losers' | 'actives';
      const results = await fetchMovers(type);
      return NextResponse.json({ results });
    }

    if (section === 'search') {
      const q = req.nextUrl.searchParams.get('q') || '';
      const results = await searchSymbols(q);
      return NextResponse.json({ results });
    }

    if (section === 'quote') {
      const symbol = req.nextUrl.searchParams.get('symbol') || '';
      const quote = await fetchQuote(symbol);
      return NextResponse.json({ quote });
    }

    if (section === 'chart') {
      const symbol = req.nextUrl.searchParams.get('symbol') || '';
      const range = req.nextUrl.searchParams.get('range') || '1mo';
      const interval = req.nextUrl.searchParams.get('interval') || '1d';
      const chart = await fetchChart(symbol, range, interval);
      return NextResponse.json({ chart });
    }

    // default
    const indices = await fetchIndices();
    return NextResponse.json({ indices });
  } catch (e) {
    // Return explicit errors so UI can show an error state
    const message = String((e as Error).message || 'Upstream error');
    if (section === 'movers') return NextResponse.json({ error: message }, { status: 502 });
    if (section === 'search') return NextResponse.json({ error: message }, { status: 502 });
    if (section === 'quote') return NextResponse.json({ error: message }, { status: 502 });
    if (section === 'chart') return NextResponse.json({ error: message }, { status: 502 });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}


