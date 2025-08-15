import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

// Simple sector → representative tickers map (large caps, diversified)
const SECTOR_SYMBOLS: Record<string, string[]> = {
  Technology: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'ADBE', 'CRM', 'AMD'],
  Healthcare: ['UNH', 'LLY', 'JNJ', 'ABBV', 'MRK', 'TMO', 'PFE', 'DHR'],
  Finance: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'BLK', 'C', 'AXP'],
  Energy: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'OXY'],
  Consumer: ['AMZN', 'HD', 'MCD', 'KO', 'PEP', 'NKE', 'COST', 'SBUX'],
  Industrial: ['BA', 'CAT', 'HON', 'GE', 'LMT', 'DE', 'UPS', 'RTX'],
};

type Quote = {
  symbol: string;
  regularMarketChangePercent?: number;
  regularMarketChange?: number;
  marketCap?: number;
};

export async function GET(req: NextRequest) {
  try {
    const debug = req.nextUrl.searchParams.get('debug') === '1' || req.nextUrl.searchParams.get('debug') === 'true';
    
    if (debug) {
      console.log('🔍 Heatmap API called with debug mode');
      console.log('⏰ Request timestamp:', new Date().toISOString());
    }

    // Flatten all symbols and fetch in one request
    const allSymbols = Array.from(new Set(Object.values(SECTOR_SYMBOLS).flat()));
    
    if (debug) {
      console.log('📋 All symbols to fetch:', allSymbols);
      console.log('📊 Total symbols:', allSymbols.length);
    }
    
    let quotes: any[] = [];
    try {
      const res = await yahooFinance.quote(allSymbols);
      quotes = Array.isArray(res) ? res : [res];
      
      if (debug) {
        console.log('✅ Yahoo Finance bulk quote response received');
        console.log('📈 Quotes received:', quotes.length);
        console.log('🔢 Quote symbols:', quotes.map(q => q?.symbol).filter(Boolean));
        
        // Check for missing symbols
        const receivedSymbols = new Set(quotes.map(q => q?.symbol).filter(Boolean));
        const missingSymbols = allSymbols.filter(s => !receivedSymbols.has(s));
        if (missingSymbols.length > 0) {
          console.log('❌ Missing symbols from bulk fetch:', missingSymbols);
          console.log('📊 Success rate:', `${receivedSymbols.size}/${allSymbols.length} (${((receivedSymbols.size/allSymbols.length)*100).toFixed(1)}%)`);
        }
      }
    } catch (error) {
      if (debug) {
        console.log('❌ Yahoo Finance bulk quote failed:', error);
      }
      quotes = [];
    }
    
    // If bulk fetch failed or returned very few results, try smaller batches
    if (quotes.length < allSymbols.length * 0.5) {
      if (debug) {
        console.log('🔄 Bulk fetch returned few results, trying batch approach...');
      }
      
      const batchSize = 8;
      const batches = [];
      for (let i = 0; i < allSymbols.length; i += batchSize) {
        batches.push(allSymbols.slice(i, i + batchSize));
      }
      
      const batchResults = await Promise.allSettled(
        batches.map(async (batch, index) => {
          try {
            if (debug) console.log(`📦 Fetching batch ${index + 1}/${batches.length}: ${batch.join(', ')}`);
            const res = await yahooFinance.quote(batch);
            const batchQuotes = Array.isArray(res) ? res : [res];
            if (debug) console.log(`✅ Batch ${index + 1} returned ${batchQuotes.length}/${batch.length} quotes`);
            return batchQuotes;
          } catch (error) {
            if (debug) console.log(`❌ Batch ${index + 1} failed:`, error);
            return [];
          }
        })
      );
      
      // Merge successful batch results
      const additionalQuotes = batchResults
        .filter((result): result is PromiseFulfilledResult<any[]> => result.status === 'fulfilled')
        .flatMap(result => result.value)
        .filter(q => q?.symbol);
      
      // Combine with original quotes, avoiding duplicates
      const existingSymbols = new Set(quotes.map(q => q?.symbol));
      const newQuotes = additionalQuotes.filter(q => !existingSymbols.has(q.symbol));
      quotes = [...quotes, ...newQuotes];
      
      if (debug) {
        console.log(`🔄 After batch retry: ${quotes.length}/${allSymbols.length} total quotes`);
      }
    }
    const symbolToQuote = new Map<string, Quote>();
    for (const q of quotes) if (q?.symbol) symbolToQuote.set(q.symbol, q);

    // Enhanced robust change percent calculation with multiple fallback methods
    const deriveChangePctFromQuote = (q: Quote, debugEnabled = false): number => {
      const symbol = (q as any)?.symbol;
      
      // Try regularMarketChangePercent first (most reliable when present)
      const pct = Number((q as any)?.regularMarketChangePercent);
      if (Number.isFinite(pct) && Math.abs(pct) > 0.001) {
        if (debugEnabled) console.log(`✅ ${symbol}: Using regularMarketChangePercent: ${pct}%`);
        return pct;
      }
      
      // Try alternative percent fields
      const postPct = Number((q as any)?.postMarketChangePercent);
      if (Number.isFinite(postPct) && Math.abs(postPct) > 0.001) {
        if (debugEnabled) console.log(`📈 ${symbol}: Using postMarketChangePercent: ${postPct}%`);
        return postPct;
      }
      
      const prePct = Number((q as any)?.preMarketChangePercent);
      if (Number.isFinite(prePct) && Math.abs(prePct) > 0.001) {
        if (debugEnabled) console.log(`🌅 ${symbol}: Using preMarketChangePercent: ${prePct}%`);
        return prePct;
      }
      
      // Calculate from change and previous close
      const change = Number((q as any)?.regularMarketChange);
      const prevClose = Number((q as any)?.regularMarketPreviousClose);
      if (Number.isFinite(change) && Number.isFinite(prevClose) && Math.abs(prevClose) > 0.001) {
        const calcPct = (change / prevClose) * 100;
        if (Number.isFinite(calcPct) && Math.abs(calcPct) > 0.001) {
          if (debugEnabled) console.log(`🧮 ${symbol}: Calculated from change/prevClose: ${calcPct}% (${change}/${prevClose})`);
          return calcPct;
        }
      }
      
      // Calculate from current price and previous close
      const price = Number((q as any)?.regularMarketPrice || (q as any)?.price);
      if (Number.isFinite(price) && Number.isFinite(prevClose) && Math.abs(prevClose) > 0.001) {
        const calcPct = ((price - prevClose) / prevClose) * 100;
        if (Number.isFinite(calcPct) && Math.abs(calcPct) > 0.001) {
          if (debugEnabled) console.log(`💰 ${symbol}: Calculated from price/prevClose: ${calcPct}% (${price}/${prevClose})`);
          return calcPct;
        }
      }
      
      // Try bid/ask spread calculation as last resort
      const bid = Number((q as any)?.bid);
      const ask = Number((q as any)?.ask);
      if (Number.isFinite(bid) && Number.isFinite(ask) && Number.isFinite(prevClose) && Math.abs(prevClose) > 0.001) {
        const midPrice = (bid + ask) / 2;
        const calcPct = ((midPrice - prevClose) / prevClose) * 100;
        if (Number.isFinite(calcPct) && Math.abs(calcPct) > 0.001) {
          if (debugEnabled) console.log(`🎯 ${symbol}: Calculated from bid/ask spread: ${calcPct}% (${midPrice}/${prevClose})`);
          return calcPct;
        }
      }
      
      // Log the failed case
      if (debugEnabled) {
        console.log(`❌ ${symbol}: No valid change calculation found`);
        console.log(`   - regularMarketChangePercent: ${(q as any)?.regularMarketChangePercent}`);
        console.log(`   - regularMarketChange: ${(q as any)?.regularMarketChange}`);
        console.log(`   - regularMarketPreviousClose: ${(q as any)?.regularMarketPreviousClose}`);
        console.log(`   - regularMarketPrice: ${(q as any)?.regularMarketPrice}`);
        console.log(`   - bid: ${(q as any)?.bid}, ask: ${(q as any)?.ask}`);
      }
      
      // Return original percent if it exists, even if small/zero
      return Number.isFinite(pct) ? pct : 0;
    };

    // Helper to pick N random unique items from an array
    const pickRandom = <T,>(arr: T[], n: number): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, Math.min(n, copy.length));
    };

    // Build sector aggregates (primary path)
    let sectors = Object.entries(SECTOR_SYMBOLS).map(([name, symbols]) => {
      if (debug) {
        console.log(`\n🏢 Processing sector: ${name}`);
        console.log(`📋 Sector symbols: ${symbols.join(', ')}`);
      }
      
      const stocks = symbols
        .map((s) => symbolToQuote.get(s))
        .filter(Boolean) as Quote[];

      if (debug) {
        console.log(`📊 Found quotes for ${stocks.length}/${symbols.length} stocks`);
        const foundSymbols = stocks.map(s => (s as any)?.symbol).filter(Boolean);
        const missingSymbols = symbols.filter(s => !foundSymbols.includes(s));
        if (missingSymbols.length > 0) {
          console.log(`❌ Missing quotes: ${missingSymbols.join(', ')}`);
        }
      }

      let totalCap = stocks.reduce((acc, q) => acc + Number((q as any).marketCap || 0), 0);
      // Weighted average by marketCap if available, otherwise simple average
      let avgPct = 0;
      if (stocks.length) {
        if (totalCap <= 0) {
          // If market caps are missing due to quote block, approximate using equal weights
          avgPct = stocks.reduce((acc, q) => acc + deriveChangePctFromQuote(q, debug), 0) / stocks.length;
          totalCap = stocks.length * 1_000_000_000; // approximate to size tiles
          if (debug) console.log(`💰 No market caps found, using equal weights. Average: ${avgPct.toFixed(2)}%`);
        } else {
          avgPct = stocks.reduce((acc, q) => {
            const cap = Number((q as any).marketCap || 0);
            const pct = deriveChangePctFromQuote(q, debug);
            return acc + (cap / totalCap) * pct;
          }, 0);
          if (debug) console.log(`💰 Market cap weighted average: ${avgPct.toFixed(2)}%`);
        }
      }

      // Pick a random subset first to avoid showing the same names repeatedly,
      // then take the strongest movers to ensure visible differentiation
      const subset = pickRandom(stocks, 8);
      const topQuotes = subset
        .slice() // shallow copy
        .sort((a, b) => Math.abs(deriveChangePctFromQuote(b, debug)) - Math.abs(deriveChangePctFromQuote(a, debug)))
        .slice(0, 4);
      const top = topQuotes.map((q) => ({ symbol: (q as any).symbol, change: deriveChangePctFromQuote(q, debug) }));

      if (debug) {
        console.log(`🎯 Top movers for ${name}:`, top.map(s => `${s.symbol}: ${s.change.toFixed(2)}%`).join(', '));
      }

      // Align sector tile percent with what is displayed: sum of the 4 shown stocks
      let displaySum = 0;
      if (topQuotes.length) {
        // Sum raw percent changes (not an average)
        displaySum = topQuotes.reduce((acc, q) => acc + deriveChangePctFromQuote(q, debug), 0);
      }

      if (debug) {
        console.log(`📈 ${name} final change: ${displaySum.toFixed(2)}%`);
      }

      return {
        name,
        // Use sum of visible movers to match user's expectation of "total"; keep totalCap for sizing
        change: Number(displaySum),
        marketCap: totalCap || stocks.length * 1_000_000_000,
        stocks: top,
      };
    });

    // Enhanced second-pass: retry individual quotes for stocks with missing/zero data
    // Use timeout and parallel fetching to prevent blocking
    const retryStockWithTimeout = async (symbol: string): Promise<number> => {
      const timeoutId = setTimeout(() => {
        throw new Error('Quote timeout');
      }, 3000); // 3 second timeout
      
      try {
        const q: any = await yahooFinance.quote(symbol as any).catch(() => null);
        clearTimeout(timeoutId);
        
          if (q) {
          const pct = deriveChangePctFromQuote(q);
          if (Math.abs(pct) > 0.001) return pct;
        }
        
        // Fallback to chart data if quote fails
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const chartRes: any = await yahooFinance.chart(symbol, {
          period1: new Date(now - 3 * dayMs),
          period2: new Date(now),
          interval: '1d',
        } as any).catch(() => null);
        
        if (chartRes?.quotes?.length >= 2) {
          const quotes = chartRes.quotes;
          const last = Number(quotes[quotes.length - 1]?.close);
          const prev = Number(quotes[quotes.length - 2]?.close);
          if (Number.isFinite(last) && Number.isFinite(prev) && Math.abs(prev) > 0.001) {
            return ((last - prev) / prev) * 100;
          }
        }
      } catch {
        clearTimeout(timeoutId);
      }
      
      return 0;
    };

    // Process sectors in parallel with limited concurrency
    const enhancedSectors = await Promise.all(
      sectors.map(async (sector) => {
        const problematicStocks = sector.stocks.filter((stock) => 
          !Number.isFinite(stock.change) || Math.abs(stock.change) < 0.001
        );
        
        if (debug && problematicStocks.length > 0) {
          console.log(`\n🔄 Retrying stocks in ${sector.name}:`, problematicStocks.map(s => s.symbol).join(', '));
        }
        
        if (problematicStocks.length === 0) return sector;
        
        // Retry up to 3 stocks per sector to avoid excessive API calls
        const stocksToRetry = problematicStocks.slice(0, 3);
        const retryResults = await Promise.allSettled(
          stocksToRetry.map((stock) => {
            if (debug) console.log(`🔍 Retrying individual quote for ${stock.symbol}`);
            return retryStockWithTimeout(stock.symbol);
          })
        );
        
        if (debug) {
          retryResults.forEach((result, index) => {
            const symbol = stocksToRetry[index].symbol;
            if (result.status === 'fulfilled') {
              console.log(`✅ ${symbol} retry succeeded: ${result.value.toFixed(2)}%`);
            } else {
              console.log(`❌ ${symbol} retry failed:`, result.reason);
            }
          });
        }
        
        const updatedStocks = sector.stocks.map((stock) => {
          const retryIndex = stocksToRetry.findIndex((s) => s.symbol === stock.symbol);
          if (retryIndex >= 0) {
            const result = retryResults[retryIndex];
            if (result.status === 'fulfilled' && Math.abs(result.value) > 0.001) {
              if (debug) console.log(`🔄 Updated ${stock.symbol}: ${stock.change.toFixed(2)}% → ${result.value.toFixed(2)}%`);
              return { ...stock, change: result.value };
            }
          }
          return stock;
        });
        
        // Recompute sector change with updated stock data
        const sectorChange = updatedStocks.reduce((acc, stock) => acc + (Number.isFinite(stock.change) ? stock.change : 0), 0);
        
        if (debug) {
          console.log(`📊 ${sector.name} updated change: ${sector.change.toFixed(2)}% → ${sectorChange.toFixed(2)}%`);
        }
        
        return { ...sector, stocks: updatedStocks, change: sectorChange };
      })
    );
    
    sectors = enhancedSectors;

    // Fallback: if we failed to get any stock-level data (e.g., quote 401), use sector ETFs to estimate
    const noData = sectors.every((s) => !s.marketCap || s.marketCap === 0);
    let usedEtfFallback = false;
    if (noData) {
      const SECTOR_ETF: Record<string, string> = {
        Technology: 'XLK',
        Healthcare: 'XLV',
        Finance: 'XLF',
        Energy: 'XLE',
        Consumer: 'XLY',
        Industrial: 'XLI',
      };
      const WEIGHTS: Record<string, number> = {
        Technology: 28,
        Healthcare: 13,
        Finance: 12,
        Consumer: 10,
        Industrial: 8,
        Energy: 4,
      };
      const items: Array<{ name: string; change: number; marketCap: number; stocks: any[] }> = [];
      for (const [name, etf] of Object.entries(SECTOR_ETF)) {
        try {
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          const res: any = await yahooFinance.chart(etf, {
            period1: new Date(now - 7 * dayMs),
            period2: new Date(now),
            interval: '1d',
          } as any);
          const quotes = Array.isArray(res?.quotes) ? res.quotes : [];
          const closes = quotes.map((q: any) => Number(q.close)).filter((n: number) => Number.isFinite(n));
          const last = closes[closes.length - 1];
          const prev = closes[closes.length - 2];
          const changePct = Number.isFinite(last) && Number.isFinite(prev) && prev !== 0 ? ((last - prev) / prev) * 100 : 0;
          items.push({
            name,
            change: changePct,
            marketCap: WEIGHTS[name] * 1_000_000_000_000, // synthetic scale for sizing differences
            stocks: [],
          });
        } catch {
          items.push({ name, change: 0, marketCap: WEIGHTS[name] * 1_000_000_000_000, stocks: [] });
        }
      }
      sectors = items;
      usedEtfFallback = true;
    }

    // If we used the ETF fallback (or stocks arrays are empty), populate per-sector breakdown stocks
    if (usedEtfFallback || sectors.every((s) => !Array.isArray(s.stocks) || s.stocks.length === 0)) {
      const computeChangePct = async (symbol: string): Promise<number> => {
        // Prefer real-time quote change percent when available; fallback to derived fields; then chart delta
        try {
          const q: any = await yahooFinance.quote(symbol as any).catch(() => null);
          if (q) {
            const pct = Number(q?.regularMarketChangePercent ?? NaN);
            if (Number.isFinite(pct) && pct !== 0) return pct;
            const change = Number(q?.regularMarketChange ?? NaN);
            const prevClose = Number(q?.regularMarketPreviousClose ?? NaN);
            const price = Number(q?.regularMarketPrice ?? NaN);
            if (Number.isFinite(change) && Number.isFinite(prevClose) && prevClose !== 0) {
              return (change / prevClose) * 100;
            }
            if (Number.isFinite(price) && Number.isFinite(prevClose) && prevClose !== 0) {
              return ((price - prevClose) / prevClose) * 100;
            }
          }
        } catch {}
        try {
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          const res: any = await yahooFinance.chart(symbol, {
            period1: new Date(now - 7 * dayMs),
            period2: new Date(now),
            interval: '1d',
          } as any);
          const quotes = Array.isArray(res?.quotes) ? res.quotes : [];
          const closes = quotes.map((q: any) => Number(q.close)).filter((n: number) => Number.isFinite(n));
          const last = closes[closes.length - 1];
          const prev = closes[closes.length - 2];
          if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return 0;
          return ((last - prev) / prev) * 100;
        } catch {
          return 0;
        }
      };

      const updated = [] as typeof sectors;
      for (const sector of sectors) {
        const symbols = SECTOR_SYMBOLS[sector.name] || [];
        const subset = pickRandom(symbols, 8);
        const settled = await Promise.allSettled(subset.map((s) => computeChangePct(s)));
        const stocks = subset
          .map((symbol, i) => {
            const r: any = settled[i] as any;
            const change = r && r.status === 'fulfilled' ? Number(r.value) : 0;
            return { symbol, change };
          })
          .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
          .slice(0, 4);
        const sum = stocks.length ? stocks.reduce((acc, s) => acc + s.change, 0) : sector.change;
        updated.push({ ...sector, stocks, change: sum });
      }
      sectors = updated;
    }

    if (debug) {
      console.log('\n📋 Final sector summary:');
      sectors.forEach(sector => {
        console.log(`${sector.name}: ${sector.change.toFixed(2)}% (${sector.stocks.length} stocks)`);
        sector.stocks.forEach(stock => {
          console.log(`  - ${stock.symbol}: ${stock.change.toFixed(2)}%`);
        });
      });
    }

    return NextResponse.json(
      debug ? withDebug(req, { sectors }) : { sectors },
      { headers: debugHeaders(req) }
    );
  } catch (e) {
    // Do not bubble up a 502; return error in body with 200 to keep UI functional in production
    const body = { error: String((e as Error).message), sectors: [] } as any;
    return NextResponse.json(
      req.nextUrl.searchParams.get('debug') ? withDebug(req, body) : body,
      { status: 200, headers: debugHeaders(req) }
    );
  }
}

function debugHeaders(req: NextRequest): Record<string, string> {
  const ray = req.headers.get('cf-ray') || '';
  const colo = req.headers.get('cf-ray')?.split('-')[1] || '';
  const country = req.headers.get('cf-ipcountry') || '';
  return ray || colo || country
    ? {
        'X-Debug-CF-Ray': ray,
        ...(colo ? { 'X-Debug-CF-Colo': colo } : {}),
        ...(country ? { 'X-Debug-CF-Country': country } : {}),
      }
    : {};
}

function withDebug<T extends object>(req: NextRequest, data: T): T & { __debug: any } {
  const ray = req.headers.get('cf-ray') || null;
  const colo = (req.headers.get('cf-ray') || '').split('-')[1] || null;
  const country = req.headers.get('cf-ipcountry') || null;
  return {
    ...data,
    __debug: {
      runtime: 'edge',
      cfRay: ray,
      cfColo: colo,
      cfCountry: country,
    },
  };
}


