import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sanitizeSymbol(input: string): string {
  const upper = (input || '').toUpperCase();
  // Allow letters, numbers, dot and dash (e.g., BRK.B, 0P00000B6G.T)
  return upper.replace(/[^A-Z0-9.\-]/g, '');
}

async function getPlaceholder(): Promise<NextResponse> {
  // Inline minimal placeholder SVG to avoid filesystem access (Edge-compatible)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80" role="img" aria-label="placeholder logo">
  <rect width="120" height="80" fill="#E5E7EB"/>
  <path d="M10 60 L35 40 L55 50 L80 30 L110 50" fill="none" stroke="#9CA3AF" stroke-width="3" stroke-linecap="round" />
  <circle cx="35" cy="40" r="3" fill="#9CA3AF"/>
  <circle cx="55" cy="50" r="3" fill="#9CA3AF"/>
  <circle cx="80" cy="30" r="3" fill="#9CA3AF"/>
  <circle cx="110" cy="50" r="3" fill="#9CA3AF"/>
  <text x="10" y="20" font-size="10" fill="#6B7280" font-family="Arial, Helvetica, sans-serif">No Logo</text>
  Sorry, your browser does not support inline SVG.
</svg>`;
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbolRaw = url.searchParams.get('symbol') || '';
  const symbol = sanitizeSymbol(symbolRaw);
  if (!symbol) return getPlaceholder();

  const remoteUrl = `https://financialmodelingprep.com/image-stock/${symbol}.png`;

  try {
    const res = await fetch(remoteUrl, {
      cache: 'no-store',
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
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return getPlaceholder();
  }
}


