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
  // Try v10 then v6, across query2 and query1 hosts
  const urls = [
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(mod)}`,
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(mod)}`,
    `https://query2.finance.yahoo.com/v6/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(mod)}`,
    `https://query1.finance.yahoo.com/v6/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(mod)}`,
  ];
  let data: any = null;
  let lastError: unknown = null;
  for (const u of urls) {
    try {
      data = await fetchJson(u);
      if (data) break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!data && lastError) return null;
  const result = data?.quoteSummary?.result?.[0] || null;
  return result;
}

async function fetchLatestSharesOutstanding(symbol: string): Promise<number | null> {
  // Try multiple series that may contain share counts
  const types = [
    'sharesOutstanding',
    'trailingSharesOutstanding',
    'impliedSharesOutstanding',
    'floatShares',
    'basicAverageShares',
    'dilutedAverageShares',
    'annualBasicAverageShares',
    'annualDilutedAverageShares',
    'quarterlyBasicAverageShares',
    'quarterlyDilutedAverageShares',
  ];
  const params = `type=${encodeURIComponent(types.join(','))}&merge=false&period1=0`;
  const urls = [
    `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?${params}`,
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?${params}`,
  ];
  for (const u of urls) {
    try {
      const data = await fetchJson(u);
      const result = data?.timeseries?.result?.[0] || {};
      for (const key of types) {
        const series = result?.[key];
        if (Array.isArray(series) && series.length) {
          for (let i = series.length - 1; i >= 0; i--) {
            const raw = series[i]?.reportedValue?.raw ?? series[i]?.reportedValue ?? series[i]?.raw;
            if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
              return raw;
            }
          }
        }
      }
    } catch {
      // try next url
    }
  }
  return null;
}

async function fetchLatestMarketCap(symbol: string): Promise<number | null> {
  // Try multiple series that may contain market cap or close proxy (EV)
  const types = [
    'marketCap',
    'annualMarketCap',
    'quarterlyMarketCap',
    'enterpriseValue',
  ];
  const params = `type=${encodeURIComponent(types.join(','))}&merge=false&period1=0`;
  const urls = [
    `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?${params}`,
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?${params}`,
  ];
  for (const u of urls) {
    try {
      const data = await fetchJson(u);
      const result = data?.timeseries?.result?.[0] || {};
      for (const key of types) {
        const series = result?.[key];
        if (Array.isArray(series) && series.length) {
          for (let i = series.length - 1; i >= 0; i--) {
            const raw = series[i]?.reportedValue?.raw ?? series[i]?.reportedValue ?? series[i]?.raw;
            if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
              return raw;
            }
          }
        }
      }
    } catch {
      // try next url
    }
  }
  return null;
}

function parseCompact(value: string): number | null {
  if (!value) return null;
  const v = value.replace(/[,\s]/g, '').toUpperCase();
  const match = v.match(/^(\d+(?:\.\d+)?)([KMBT])?$/);
  if (!match) return Number.isFinite(Number(v)) ? Number(v) : null;
  const num = parseFloat(match[1]);
  const suffix = match[2] as 'K' | 'M' | 'B' | 'T' | undefined;
  const mult = suffix === 'T' ? 1e12 : suffix === 'B' ? 1e9 : suffix === 'M' ? 1e6 : suffix === 'K' ? 1e3 : 1;
  return num * mult;
}

async function scrapeQuotePage(symbol: string): Promise<{ marketCap?: number; sharesOutstanding?: number } | null> {
  const urls = [
    `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}?p=${encodeURIComponent(symbol)}`,
    `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/key-statistics?p=${encodeURIComponent(symbol)}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, { timeoutMs: 8000 });
      if (!res.ok) continue;
      const html = await res.text();
      // Try extracting raw values from embedded JSON
      const mcRaw = html.match(/"marketCap"\s*:\s*\{\s*"raw"\s*:\s*(\d+(?:\.\d+)?)\s*[,}]/);
      const soRaw = html.match(/"sharesOutstanding"\s*:\s*\{\s*"raw"\s*:\s*(\d+(?:\.\d+)?)\s*[,}]/);
      if (mcRaw || soRaw) {
        const marketCap = mcRaw ? Number(mcRaw[1]) : undefined;
        const sharesOutstanding = soRaw ? Number(soRaw[1]) : undefined;
        return { ...(Number.isFinite(marketCap as number) ? { marketCap: marketCap as number } : {}), ...(Number.isFinite(sharesOutstanding as number) ? { sharesOutstanding: sharesOutstanding as number } : {}) };
      }
      // Fallback to summary table value like data-test="MARKET_CAP-value">1.29T
      const capMatch = html.match(/data-test=\"MARKET_CAP-value\"[^>]*>\s*([^<\s][^<]*)\s*<\/td>/i) || html.match(/>\s*Market Cap\s*<[^>]*>\s*([^<\s][^<]*)\s*</i);
      const sharesMatch = html.match(/data-test=\"SHARES_OUTSTANDING-value\"[^>]*>\s*([^<\s][^<]*)\s*<\/td>/i) || html.match(/>\s*Shares Outstanding\s*<[^>]*>\s*([^<\s][^<]*)\s*</i);
      const marketCap = capMatch ? parseCompact(capMatch[1]) : null;
      const sharesOutstanding = sharesMatch ? parseCompact(sharesMatch[1]) : null;
      if ((marketCap && marketCap > 0) || (sharesOutstanding && sharesOutstanding > 0)) {
        return {
          ...(marketCap && marketCap > 0 ? { marketCap } : {}),
          ...(sharesOutstanding && sharesOutstanding > 0 ? { sharesOutstanding } : {}),
        } as any;
      }
    } catch {
      // try next url
    }
  }
  return null;
}

const yahooFinance = { quote, screener, search, chart, quoteSummary, fetchLatestSharesOutstanding, fetchLatestMarketCap, scrapeQuotePage };

export default yahooFinance;


