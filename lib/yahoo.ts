// Edge-safe Yahoo Finance minimal client implemented via fetch
// Provides quote, screener, search, chart with shapes compatible with current usage.

type QuoteResult = any;

// Fetch with timeout and production-friendly headers to reduce upstream blocking
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 8000, headers, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Origin: 'https://finance.yahoo.com',
        Referer: 'https://finance.yahoo.com/',
        ...(headers || {}),
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJson(url: string, opts?: RequestInit & { timeoutMs?: number }): Promise<any> {
  const res = await fetchWithTimeout(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${url} -> ${res.status}: ${text}`);
  }
  return res.json();
}

async function quote(symbol: string): Promise<QuoteResult>;
async function quote(symbols: string[]): Promise<QuoteResult[]>;
async function quote(arg: string | string[]): Promise<QuoteResult | QuoteResult[]> {
  const symbols = Array.isArray(arg) ? arg.join(',') : arg;
  const urls = [
    `https://query2.finance.yahoo.com/v7/finance/quote?formatted=false&lang=en-US&region=US&symbols=${encodeURIComponent(symbols)}`,
    `https://query1.finance.yahoo.com/v7/finance/quote?formatted=false&lang=en-US&region=US&symbols=${encodeURIComponent(symbols)}`,
  ];
  let results: any[] = [];
  let lastError: unknown = null;
  for (const u of urls) {
    try {
      const data = await fetchJson(u);
      results = data?.quoteResponse?.result || [];
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!results.length && lastError) throw lastError instanceof Error ? lastError : new Error(String(lastError));
  return Array.isArray(arg) ? results : (results[0] || null);
}

async function screener(params: { scrIds: string; count?: number }): Promise<{ quotes: any[] }> {
  const count = params.count ?? 25;
  const urls = [
    `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${encodeURIComponent(params.scrIds)}&count=${count}`,
    `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${encodeURIComponent(params.scrIds)}&count=${count}`,
  ];
  let data: any = null;
  let lastError: unknown = null;
  for (const u of urls) {
    try {
      data = await fetchJson(u);
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!data && lastError) throw lastError instanceof Error ? lastError : new Error(String(lastError));
  const quotes: any[] = data?.finance?.result?.[0]?.quotes || [];
  return { quotes };
}

async function search(q: string, _opts?: { quotesCount?: number; newsCount?: number }): Promise<{ quotes: any[] }> {
  const data = await fetchJson(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`);
  return { quotes: Array.isArray(data?.quotes) ? data.quotes : [] };
}

async function chart(symbol: string, opts: { period1: Date; period2: Date; interval: string }): Promise<{ quotes: Array<{ date: Date; close: number; volume?: number }> }> {
  const p1 = Math.floor(opts.period1.getTime() / 1000);
  const p2 = Math.floor(opts.period2.getTime() / 1000);
  const urls = [
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=${encodeURIComponent(opts.interval)}&includePrePost=false&corsDomain=finance.yahoo.com&.tsrc=finance`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=${encodeURIComponent(opts.interval)}&includePrePost=false&corsDomain=finance.yahoo.com&.tsrc=finance`,
  ];
  let data: any = null;
  let lastError: unknown = null;
  for (const u of urls) {
    try {
      data = await fetchJson(u);
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!data && lastError) throw lastError instanceof Error ? lastError : new Error(String(lastError));
  const result = data?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp || [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close || [];
  const volumes: Array<number | null> = result?.indicators?.quote?.[0]?.volume || [];
  const quotes: Array<{ date: Date; close: number; volume?: number }> = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const c = closes[i];
    if (typeof c === 'number' && Number.isFinite(c)) {
      const v = volumes?.[i];
      quotes.push({ date: new Date(t * 1000), close: c, ...(typeof v === 'number' && Number.isFinite(v) ? { volume: v } : {}) });
    }
  }
  return { quotes };
}

async function quoteSummary(symbol: string, modules: string[]): Promise<any | null> {
  const mod = modules.join(',');
  const urls = [
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(mod)}`,
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(mod)}`,
  ];
  let data: any = null;
  let lastError: unknown = null;
  for (const u of urls) {
    try {
      data = await fetchJson(u);
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!data) return null;
  const result = data?.quoteSummary?.result?.[0] || null;
  return result;
}

async function fetchLatestSharesOutstanding(symbol: string): Promise<number | null> {
  const params = `type=sharesOutstanding&merge=false&period1=0`;
  const urls = [
    `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?${params}`,
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?${params}`,
  ];
  for (const u of urls) {
    try {
      const data = await fetchJson(u);
      const arr = data?.timeseries?.result?.[0]?.sharesOutstanding;
      if (Array.isArray(arr) && arr.length) {
        // Find last entry with a numeric raw value
        for (let i = arr.length - 1; i >= 0; i--) {
          const raw = arr[i]?.reportedValue?.raw ?? arr[i]?.reportedValue ?? arr[i]?.raw;
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            return raw;
          }
        }
      }
    } catch {
      // try next url
    }
  }
  return null;
}

const yahooFinance = { quote, screener, search, chart, quoteSummary, fetchLatestSharesOutstanding };

export default yahooFinance;


