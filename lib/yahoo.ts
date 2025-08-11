// Edge-safe Yahoo Finance minimal client implemented via fetch
// Provides quote, screener, search, chart with shapes compatible with current usage.

type QuoteResult = any;

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (compatible; StockEdge/1.0)'
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upstream ${res.status}: ${text}`);
  }
  return res.json();
}

async function quote(symbol: string): Promise<QuoteResult>;
async function quote(symbols: string[]): Promise<QuoteResult[]>;
async function quote(arg: string | string[]): Promise<QuoteResult | QuoteResult[]> {
  const symbols = Array.isArray(arg) ? arg.join(',') : arg;
  const data = await fetchJson(`https://query1.finance.yahoo.com/v7/finance/quote?formatted=false&lang=en-US&region=US&symbols=${encodeURIComponent(symbols)}`);
  const results: any[] = data?.quoteResponse?.result || [];
  return Array.isArray(arg) ? results : (results[0] || null);
}

async function screener(params: { scrIds: string; count?: number }): Promise<{ quotes: any[] }> {
  const count = params.count ?? 25;
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${encodeURIComponent(params.scrIds)}&count=${count}`;
  const data = await fetchJson(url);
  const quotes: any[] = data?.finance?.result?.[0]?.quotes || [];
  return { quotes };
}

async function search(q: string, _opts?: { quotesCount?: number; newsCount?: number }): Promise<{ quotes: any[] }> {
  const data = await fetchJson(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`);
  return { quotes: Array.isArray(data?.quotes) ? data.quotes : [] };
}

async function chart(symbol: string, opts: { period1: Date; period2: Date; interval: string }): Promise<{ quotes: Array<{ date: Date; close: number }> }> {
  const p1 = Math.floor(opts.period1.getTime() / 1000);
  const p2 = Math.floor(opts.period2.getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=${encodeURIComponent(opts.interval)}&includePrePost=false&corsDomain=finance.yahoo.com&.tsrc=finance`;
  const data = await fetchJson(url);
  const result = data?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp || [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close || [];
  const quotes: Array<{ date: Date; close: number }> = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const c = closes[i];
    if (typeof c === 'number' && Number.isFinite(c)) {
      quotes.push({ date: new Date(t * 1000), close: c });
    }
  }
  return { quotes };
}

const yahooFinance = { quote, screener, search, chart };

export default yahooFinance;


