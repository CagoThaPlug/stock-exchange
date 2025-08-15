import { NextRequest, NextResponse } from 'next/server';
import { fetchIndices, fetchMovers } from '@/lib/market-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

// Aggregated header data: only indices and stock movers

export async function GET(req: NextRequest) {
  try {
    const [indices, movers] = await Promise.all([
      fetchIndices().then(list => list.slice(0, 3)).catch(() => []),
      fetchMovers('gainers').then(list => list.slice(0, 2)).catch(() => []),
    ]);

    const body = {
      indices,
      movers,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        indices: [],
        movers: [],
        forex: [],
        crypto: [],
        lastUpdated: new Date().toISOString(),
        error: (e as Error).message || 'Unknown error',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}


