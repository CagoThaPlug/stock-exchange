// Cloudflare Pages Function mirroring Next.js /api/market/data route
// Keeps the UI code unchanged while running on Cloudflare Pages

import { fetchIndices, fetchMovers, searchSymbols, fetchQuote, fetchChart } from '../../../lib/market-data';

export async function onRequestGet(context: { request: Request }) {
  const { request } = context;
  const url = new URL(request.url);
  const section = (url.searchParams.get('section') || 'indices').toLowerCase();
  const debug = url.searchParams.get('debug') === '1' || url.searchParams.get('debug') === 'true';

  try {
    if (section === 'indices') {
      const indices = await fetchIndices();
      return jsonResponse(debug ? withDebug(request, { indices }) : { indices }, { headers: debugHeaders(request) });
    }

    if (section === 'movers') {
      const type = (url.searchParams.get('type') || 'gainers') as 'gainers' | 'losers' | 'actives';
      const results = await fetchMovers(type);
      const body = { movers: results } as const;
      return jsonResponse(debug ? withDebug(request, body) : body, { headers: debugHeaders(request) });
    }

    if (section === 'search') {
      const q = url.searchParams.get('q') || '';
      const results = await searchSymbols(q);
      return jsonResponse(debug ? withDebug(request, { results }) : { results }, { headers: debugHeaders(request) });
    }

    if (section === 'quote') {
      const symbol = url.searchParams.get('symbol') || '';
      const quote = await fetchQuote(symbol);
      return jsonResponse(debug ? withDebug(request, { quote }) : { quote }, {
        headers: {
          ...debugHeaders(request),
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (section === 'chart') {
      const symbol = url.searchParams.get('symbol') || '';
      const range = url.searchParams.get('range') || '1mo';
      const interval = url.searchParams.get('interval') || '1d';
      const chart = await fetchChart(symbol, range, interval);
      return jsonResponse(debug ? withDebug(request, { chart }) : { chart }, { headers: debugHeaders(request) });
    }

    // default
    const indices = await fetchIndices();
    return jsonResponse(debug ? withDebug(request, { indices }) : { indices }, { headers: debugHeaders(request) });
  } catch (e) {
    // Return explicit errors in body but keep 200 to avoid platform 502 HTML responses breaking fetch JSON parsing
    const message = String((e as Error).message || 'Upstream error');
    const body = debug ? withDebug(request, { error: message }) : { error: message };
    return jsonResponse(body, { status: 200, headers: debugHeaders(request) });
  }
}

function jsonResponse(
  data: unknown,
  init?: { status?: number; headers?: Record<string, string> }
): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
  });
}

function debugHeaders(req: Request): Record<string, string> {
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

function withDebug<T extends object>(req: Request, data: T): T & { __debug: any } {
  const ray = req.headers.get('cf-ray') || null;
  const colo = (req.headers.get('cf-ray') || '').split('-')[1] || null;
  const country = req.headers.get('cf-ipcountry') || null;
  return {
    ...data,
    __debug: {
      runtime: 'pages-function',
      cfRay: ray,
      cfColo: colo,
      cfCountry: country,
    },
  };
}


