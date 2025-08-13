import yahooFinance from '../../../lib/yahoo';

const MARKET_CONFIG = {
  indices: [
    { symbol: '^GSPC', name: 'S&P 500' },
    { symbol: '^DJI', name: 'Dow Jones' },
    { symbol: '^IXIC', name: 'NASDAQ' },
    { symbol: '^RUT', name: 'Russell 2000' },
    { symbol: '^VIX', name: 'VIX' },
  ],
  forex: [
    { symbol: 'EURUSD=X', name: 'EUR/USD' },
    { symbol: 'GBPUSD=X', name: 'GBP/USD' },
    { symbol: 'USDJPY=X', name: 'USD/JPY' },
    { symbol: 'USDCAD=X', name: 'USD/CAD' },
  ],
  commodities: [
    { symbol: 'GC=F', name: 'Gold' },
    { symbol: 'SI=F', name: 'Silver' },
    { symbol: 'CL=F', name: 'Crude Oil' },
    { symbol: 'NG=F', name: 'Natural Gas' },
  ],
  crypto: [
    { symbol: 'BTC-USD', name: 'Bitcoin' },
    { symbol: 'ETH-USD', name: 'Ethereum' },
  ],
};

interface MarketItem {
  label: string;
  text: string;
  positive: boolean;
  symbol?: string;
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  marketCap?: number;
  volume?: number;
}

function processQuote(quote: any, category: string, name?: string): MarketItem {
  const price = quote.regularMarketPrice || quote.price || 0;
  const change = quote.regularMarketChange || quote.change || 0;
  const changePercent = quote.regularMarketChangePercent || quote.changePercent || 0;
  return {
    label: category,
    text: `${name || quote.shortName || quote.symbol} ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
    positive: changePercent >= 0,
    symbol: quote.symbol,
    name: name || quote.shortName || quote.symbol,
    price,
    change,
    changePercent,
    marketCap: quote.marketCap,
    volume: quote.regularMarketVolume || quote.volume,
  };
}

export async function onRequestGet(context: { request: Request }) {
  try {
    const url = new URL(context.request.url);
    const category = url.searchParams.get('category') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let symbols: string[] = [];
    const symbolMap = new Map<string, { name: string; category: string }>();

    if (category === 'all' || category === 'indices') {
      MARKET_CONFIG.indices.forEach(({ symbol, name }) => {
        symbols.push(symbol);
        symbolMap.set(symbol, { name, category: 'Index' });
      });
    }
    if (category === 'all' || category === 'forex') {
      MARKET_CONFIG.forex.forEach(({ symbol, name }) => {
        symbols.push(symbol);
        symbolMap.set(symbol, { name, category: 'Forex' });
      });
    }
    if (category === 'all' || category === 'commodities') {
      MARKET_CONFIG.commodities.forEach(({ symbol, name }) => {
        symbols.push(symbol);
        symbolMap.set(symbol, { name, category: 'Commodity' });
      });
    }
    if (category === 'all' || category === 'crypto') {
      MARKET_CONFIG.crypto.forEach(({ symbol, name }) => {
        symbols.push(symbol);
        symbolMap.set(symbol, { name, category: 'Crypto' });
      });
    }

    const quotes = await Promise.allSettled(symbols.map((symbol) => yahooFinance.quote(symbol)));

    const items: MarketItem[] = [];
    quotes.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const symbol = symbols[index];
        const info = symbolMap.get(symbol);
        if (info) items.push(processQuote(result.value, info.category, info.name));
      }
    });

    const sortedItems = items
      .sort((a, b) => {
        const categoryOrder = ['Index', 'Forex', 'Commodity', 'Crypto'];
        const categoryDiff = categoryOrder.indexOf(a.label) - categoryOrder.indexOf(b.label);
        if (categoryDiff !== 0) return categoryDiff;
        return Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0);
      })
      .slice(0, limit);

    const response = {
      items: sortedItems,
      lastUpdated: new Date().toISOString(),
      ...(items.length === 0 ? { error: 'No market data available' } : {}),
    };

    return json(response, 200, { 'X-Market-Status': getMarketStatus(), 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache', Expires: '0' });
  } catch (error) {
    const response = { items: [], lastUpdated: new Date().toISOString(), error: error instanceof Error ? error.message : 'Unknown error occurred' };
    return json(response, 502, { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache', Expires: '0' });
  }
}

function getMarketStatus(): string {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = easternTime.getHours() + easternTime.getMinutes() / 60;
  const day = easternTime.getDay();
  if (day === 0 || day === 6) return 'CLOSED';
  if (hours >= 9.5 && hours < 16) return 'OPEN';
  if (hours >= 4 && hours < 9.5) return 'PRE_MARKET';
  return 'AFTER_HOURS';
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}


