import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const revalidate = 3600; // 1 hour

export async function GET(req: NextRequest) {
  const base = req.nextUrl.searchParams.get('base') || 'USD';
  try {
    const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return NextResponse.json({ error: `FX upstream ${res.status}: ${t}` }, { status: 502 });
    }
    const data = await res.json();
    // Normalize
    return NextResponse.json({ base: data.base, rates: data.rates, date: data.date });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}


