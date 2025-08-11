import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sanitizeSymbol(input: string): string {
  const upper = (input || '').toUpperCase();
  // Allow letters, numbers, dot and dash (e.g., BRK.B, 0P00000B6G.T)
  return upper.replace(/[^A-Z0-9.\-]/g, '');
}

async function getPlaceholder(): Promise<NextResponse> {
  const filePath = join(process.cwd(), 'project', 'public', 'stock-placeholder.svg');
  try {
    const svg = await readFile(filePath);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    // Absolute fallback
    return new NextResponse('placeholder', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbolRaw = url.searchParams.get('symbol') || '';
  const symbol = sanitizeSymbol(symbolRaw);
  if (!symbol) return getPlaceholder();

  const remoteUrl = `https://financialmodelingprep.com/image-stock/${symbol}.png`;

  try {
    const res = await fetch(remoteUrl, {
      // Avoid browser caching issues; we'll set our own cache headers on success
      cache: 'no-store',
      // Some CDNs require a UA
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BoltMarketData/1.0)' },
    });

    if (!res.ok) {
      return getPlaceholder();
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 1 day
      },
    });
  } catch {
    return getPlaceholder();
  }
}


