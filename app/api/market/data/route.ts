import { NextRequest, NextResponse } from 'next/server';
import { fetchIndices, fetchMovers, searchSymbols, fetchQuote, fetchChart } from '@/lib/market-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

// Unified market data endpoint
// Modes:
//  - /api/market/data?section=indices
//  - /api/market/data?section=movers&type=gainers|losers|actives
//  - /api/market/data?section=search&q=TSLA
//  - /api/market/data?section=quote&symbol=TSLA
//  - /api/market/data?section=chart&symbol=TSLA&range=1mo&interval=1d

export async function GET(req: NextRequest) {
  const section = (req.nextUrl.searchParams.get('section') || 'indices').toLowerCase();
  const debug = req.nextUrl.searchParams.get('debug') === '1' || req.nextUrl.searchParams.get('debug') === 'true';

  try {
    if (section === 'indices') {
      const indices = await fetchIndices();
      return NextResponse.json(
        debug ? withDebug(req, { indices }) : { indices },
        { headers: debugHeaders(req) }
      );
    }

    if (section === 'movers') {
      const type = (req.nextUrl.searchParams.get('type') || 'gainers') as 'gainers' | 'losers' | 'actives';
      const results = await fetchMovers(type);
      const body = { movers: results } as const;
      return NextResponse.json(debug ? withDebug(req, body) : body, { headers: debugHeaders(req) });
    }

    if (section === 'search') {
      const q = req.nextUrl.searchParams.get('q') || '';
      const results = await searchSymbols(q);
      return NextResponse.json(debug ? withDebug(req, { results }) : { results }, { headers: debugHeaders(req) });
    }

    if (section === 'quote') {
      const symbol = req.nextUrl.searchParams.get('symbol') || '';
      const quote = await fetchQuote(symbol);
      return NextResponse.json(
        debug ? withDebug(req, { quote }) : { quote },
        {
          headers: {
            ...debugHeaders(req),
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    if (section === 'chart') {
      const symbol = req.nextUrl.searchParams.get('symbol') || '';
      const range = req.nextUrl.searchParams.get('range') || '1mo';
      const interval = req.nextUrl.searchParams.get('interval') || '1d';
      const chart = await fetchChart(symbol, range, interval);
      return NextResponse.json(debug ? withDebug(req, { chart }) : { chart }, { headers: debugHeaders(req) });
    }

    // default
    const indices = await fetchIndices();
    return NextResponse.json(debug ? withDebug(req, { indices }) : { indices }, { headers: debugHeaders(req) });
  } catch (e) {
    // Return explicit errors in body but keep 200 to avoid platform 502 HTML responses breaking fetch JSON parsing
    const message = String((e as Error).message || 'Upstream error');
    const body = debug ? withDebug(req, { error: message }) : { error: message };
    return NextResponse.json(body, { status: 200, headers: debugHeaders(req) });
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


