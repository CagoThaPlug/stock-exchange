import yahooFinance from '../../../lib/yahoo';
import { marketDataService } from '../../../lib/market-data-service';

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

export async function onRequestGet(context: { request: Request }) {
  const { request } = context;
  
  try {
    const data = await marketDataService.getMarketHeatmapData();
    
    if (!data.sectors || data.sectors.length === 0) {
      throw new Error('No valid sector data available from any provider');
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Heatmap API error:', error);
    
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      sectors: [],
      timestamp: Date.now()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function executeHeatmapLogic(request: Request, debug: boolean) {
  const startTime = Date.now();
  const maxExecutionTime = 15000; // 15 seconds max
  
  const checkTimeRemaining = () => {
    const elapsed = Date.now() - startTime;
    return elapsed < maxExecutionTime;
  };
  
  try {
    if (debug) {
      console.log('🔍 Heatmap API called with debug mode');
      console.log('⏰ Request timestamp:', new Date().toISOString());
    }

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

    // Emergency individual stock fetch for sectors with all-zero data (Cloudflare optimized)
    const emergencyFetch = async () => {
      const zeroSectors = sectors.filter(s => Math.abs(s.change) < 0.001);
      if (zeroSectors.length === 0) return sectors;
      
      if (debug) {
        console.log(`\n🚨 Emergency individual fetch for ${zeroSectors.length} zero sectors:`, zeroSectors.map(s => s.name).join(', '));
      }
      
      // Process sectors sequentially to avoid overwhelming Cloudflare runtime
      const updatedSectors = [...sectors];
      
      for (let i = 0; i < sectors.length; i++) {
        // Check if we have enough time remaining
        if (!checkTimeRemaining()) {
          if (debug) console.log('⏰ Time limit approaching, skipping remaining sectors');
          break;
        }
        
        const sector = sectors[i];
        if (Math.abs(sector.change) > 0.001) continue; // Skip sectors with data
        
        const sectorSymbols = SECTOR_SYMBOLS[sector.name] || [];
        if (debug) console.log(`🔍 Individual fetch for ${sector.name}: ${sectorSymbols.slice(0, 4).join(', ')}`);
        
        // Limit to first 4 symbols to reduce load and stay within Cloudflare limits
        const limitedSymbols = sectorSymbols.slice(0, 4);
        
        // Add timeout wrapper for individual requests
        const fetchWithTimeout = async (symbol: string, timeoutMs = 3000) => {
          return Promise.race([
            yahooFinance.quote(symbol as any),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), timeoutMs)
            )
          ]);
        };
        
        // Fetch with limited concurrency (2 at a time)
        const individualResults = [];
        for (let j = 0; j < limitedSymbols.length; j += 2) {
          const batch = limitedSymbols.slice(j, j + 2);
          const batchResults = await Promise.allSettled(
            batch.map(async (symbol) => {
              try {
                const q: any = await fetchWithTimeout(symbol, 2000); // 2 second timeout
                const change = deriveChangePctFromQuote(q, debug);
                if (debug && Math.abs(change) > 0.001) {
                  console.log(`💎 Individual fetch success: ${symbol} = ${change.toFixed(2)}%`);
                }
                return { symbol, change, quote: q };
              } catch (error) {
                if (debug) console.log(`❌ Individual fetch failed for ${symbol}:`, error);
                return { symbol, change: 0, quote: null };
              }
            })
          );
          individualResults.push(...batchResults);
          
          // Small delay between batches to avoid rate limiting
          if (j + 2 < limitedSymbols.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        const validResults = individualResults
          .filter((result): result is PromiseFulfilledResult<{symbol: string, change: number, quote: any}> => 
            result.status === 'fulfilled' && Math.abs(result.value.change) > 0.001
          )
          .map(result => result.value);
        
        if (validResults.length === 0) {
          if (debug) console.log(`❌ No valid individual results for ${sector.name}`);
          continue;
        }
        
        // Take all valid results (already limited to 4)
        const topStocks = validResults
          .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
          .map(r => ({ symbol: r.symbol, change: r.change }));
        
        const sectorChange = topStocks.reduce((acc, stock) => acc + stock.change, 0);
        
        if (debug) {
          console.log(`🎯 Emergency fetch success for ${sector.name}: ${sectorChange.toFixed(2)}%`);
          console.log(`   Top stocks:`, topStocks.map(s => `${s.symbol}: ${s.change.toFixed(2)}%`).join(', '));
        }
        
        updatedSectors[i] = {
          ...sector,
          stocks: topStocks,
          change: sectorChange
        };
      }
      
      return updatedSectors;
    };
    
    // Run emergency fetch first
    sectors = await emergencyFetch();

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
      
      // Process ETFs with timeout and limited concurrency for Cloudflare
      const etfEntries = Object.entries(SECTOR_ETF);
      for (let i = 0; i < etfEntries.length; i++) {
        const [name, etf] = etfEntries[i];
        try {
          // Add timeout for ETF chart requests
          const chartPromise = yahooFinance.chart(etf, {
            period1: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            period2: new Date(),
            interval: '1d' as any,
          });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('ETF timeout')), 3000)
          );
          
          const res: any = await Promise.race([chartPromise, timeoutPromise]);
          const quotes = Array.isArray(res?.quotes) ? res.quotes : [];
          const closes = quotes.map((q: any) => Number(q.close)).filter((n: number) => Number.isFinite(n));
          const last = closes[closes.length - 1];
          const prev = closes[closes.length - 2];
          const changePct = Number.isFinite(last) && Number.isFinite(prev) && prev !== 0 ? ((last - prev) / prev) * 100 : 0;
          items.push({ name, change: changePct, marketCap: WEIGHTS[name] * 1_000_000_000_000, stocks: [] });
          
          if (debug) console.log(`📊 ETF ${etf} for ${name}: ${changePct.toFixed(2)}%`);
          
          // Small delay between ETF requests
          if (i < etfEntries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          if (debug) console.log(`❌ ETF ${etf} failed:`, error);
          items.push({ name, change: 0, marketCap: WEIGHTS[name] * 1_000_000_000_000, stocks: [] });
        }
      }
      sectors = items;
      usedEtfFallback = true;
    }

    if (usedEtfFallback || sectors.every((s) => !Array.isArray(s.stocks) || s.stocks.length === 0)) {
      const computeChangePct = async (symbol: string): Promise<number> => {
        try {
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          const res: any = await yahooFinance.chart(symbol, {
            period1: new Date(now - 7 * dayMs),
            period2: new Date(now),
            interval: '1d' as any,
          });
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
        const subset = symbols.slice(0, 6);
        const settled = await Promise.allSettled(subset.map((s) => computeChangePct(s)));
        const stocks = subset
          .map((symbol, i) => {
            const r: any = settled[i] as any;
            const change = r && r.status === 'fulfilled' ? Number(r.value) : 0;
            return { symbol, change };
          })
          .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
          .slice(0, 4);
        updated.push({ ...sector, stocks });
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

    return json(debug ? withDebug(request, { sectors }) : { sectors }, 200, debugHeaders(request));
  } catch (e) {
    const body: any = { error: String((e as Error).message), sectors: [] };
    return json(body, 200, debugHeaders(request));
  }
}

function debugHeaders(req: Request): Record<string, string> {
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

function withDebug<T extends object>(req: Request, data: T): T & { __debug: any } {
  const ray = req.headers.get('cf-ray') || null;
  const colo = (req.headers.get('cf-ray') || '').split('-')[1] || null;
  const country = req.headers.get('cf-ipcountry') || null;
  return {
    ...data,
    __debug: { runtime: 'pages-function', cfRay: ray, cfColo: colo, cfCountry: country },
  };
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}


