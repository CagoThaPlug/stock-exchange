export async function onRequestGet(context: { request: Request }) {
  const { request } = context;
  const url = new URL(request.url);
  const base = url.searchParams.get('base') || 'USD';
  try {
    const upstream = `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}`;
    const res = await fetch(upstream, { cache: 'no-store' });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return json({ error: `FX upstream ${res.status}: ${t}` }, 502);
    }
    const data = await res.json();
    return json({ base: data.base, rates: data.rates, date: data.date });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}


