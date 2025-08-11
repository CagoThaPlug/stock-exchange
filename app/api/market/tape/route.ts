import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

// Market data configuration
const MARKET_CONFIG = {
  // Major US Indices
  indices: [
    { symbol: '^GSPC', name: 'S&P 500' },
    { symbol: '^DJI', name: 'Dow Jones' },
    { symbol: '^IXIC', name: 'NASDAQ' },
    { symbol: '^RUT', name: 'Russell 2000' },
    { symbol: '^VIX', name: 'VIX' }
  ],
  // Major forex pairs (using ETFs as proxies)
  forex: [
    { symbol: 'EURUSD=X', name: 'EUR/USD' },
    { symbol: 'GBPUSD=X', name: 'GBP/USD' },
    { symbol: 'USDJPY=X', name: 'USD/JPY' },
    { symbol: 'USDCAD=X', name: 'USD/CAD' }
  ],
  // Commodities
  commodities: [
    { symbol: 'GC=F', name: 'Gold' },
    { symbol: 'SI=F', name: 'Silver' },
    { symbol: 'CL=F', name: 'Crude Oil' },
    { symbol: 'NG=F', name: 'Natural Gas' }
  ],
  // Crypto (using popular proxies)
  crypto: [
    { symbol: 'BTC-USD', name: 'Bitcoin' },
    { symbol: 'ETH-USD', name: 'Ethereum' }
  ]
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

interface MarketDataResponse {
  items: MarketItem[];
  lastUpdated: string;
  error?: string;
}

// Helper function to format numbers
function formatNumber(num: number, decimals = 2): string {
  if (Math.abs(num) >= 1e12) {
    return (num / 1e12).toFixed(1) + 'T';
  } else if (Math.abs(num) >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B';
  } else if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  } else if (Math.abs(num) >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  }
  return num.toFixed(decimals);
}

// Helper function to get market status
function getMarketStatus(): string {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const hours = easternTime.getHours();
  const day = easternTime.getDay();
  
  // Weekend
  if (day === 0 || day === 6) return 'CLOSED';
  
  // Market hours: 9:30 AM - 4:00 PM ET
  if (hours >= 9.5 && hours < 16) return 'OPEN';
  if (hours >= 4 && hours < 9.5) return 'PRE_MARKET';
  return 'AFTER_HOURS';
}

// Process quote data into market item
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
    price: price,
    change: change,
    changePercent: changePercent,
    marketCap: quote.marketCap,
    volume: quote.regularMarketVolume || quote.volume
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';
    const limit = parseInt(searchParams.get('limit') || '10');
    
    let symbols: string[] = [];
    let symbolMap = new Map<string, { name: string; category: string }>();
    
    // Build symbol list based on category
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
    
    // Fetch quotes with timeout and error handling
    const quotes = await Promise.allSettled(
      symbols.map(symbol => 
        Promise.race([
          yahooFinance.quote(symbol),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ])
      )
    );
    
    // Process successful quotes
    const items: MarketItem[] = [];
    quotes.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const symbol = symbols[index];
        const symbolInfo = symbolMap.get(symbol);
        if (symbolInfo) {
          const item = processQuote(result.value, symbolInfo.category, symbolInfo.name);
          items.push(item);
        }
      }
    });
    
    // Sort by category and then by absolute change percent (most volatile first)
    const sortedItems = items
      .sort((a, b) => {
        // First by category order
        const categoryOrder = ['Index', 'Forex', 'Commodity', 'Crypto'];
        const categoryDiff = categoryOrder.indexOf(a.label) - categoryOrder.indexOf(b.label);
        if (categoryDiff !== 0) return categoryDiff;
        
        // Then by absolute change percent (descending)
        return Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0);
      })
      .slice(0, limit);
    
    const response: MarketDataResponse = {
      items: sortedItems,
      lastUpdated: new Date().toISOString(),
      ...(items.length === 0 && { error: 'No market data available' })
    };
    
    // Add market status to response headers
    const marketStatus = getMarketStatus();
    const headers = {
      'X-Market-Status': marketStatus,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    return NextResponse.json(response, { 
      status: 200, 
      headers 
    });
    
  } catch (error) {
    console.error('Market data API error:', error);
    
    const errorResponse: MarketDataResponse = {
      items: [],
      lastUpdated: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    
    return NextResponse.json(errorResponse, { 
      status: 502,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}

// Optional: Add POST method for custom symbol requests
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbols: customSymbols } = body;
    
    if (!Array.isArray(customSymbols) || customSymbols.length === 0) {
      return NextResponse.json(
        { error: 'Invalid symbols array' }, 
        { status: 400 }
      );
    }
    
    if (customSymbols.length > 20) {
      return NextResponse.json(
        { error: 'Too many symbols (max 20)' }, 
        { status: 400 }
      );
    }
    
    // Fetch custom symbols
    const quotes = await Promise.allSettled(
      customSymbols.map(symbol => yahooFinance.quote(symbol))
    );
    
    const items: MarketItem[] = [];
    quotes.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const item = processQuote(result.value, 'Custom');
        items.push(item);
      }
    });
    
    const response: MarketDataResponse = {
      items,
      lastUpdated: new Date().toISOString()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Custom symbols API error:', error);
    return NextResponse.json(
      { 
        items: [], 
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }, 
      { status: 502 }
    );
  }
}