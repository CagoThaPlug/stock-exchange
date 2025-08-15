import { NextRequest, NextResponse } from 'next/server';
import { marketDataService } from '@/lib/market-data-service';
import { fetchIndices, fetchMovers } from '@/lib/market-data';

export const runtime = 'edge';

interface UnifiedMarketData {
  heatmap: {
    sectors: any[];
  };
  indices: any[];
  movers: {
    gainers: any[];
    losers: any[];
    actives: any[];
  };
  quotes: Record<string, any>;
  lastUpdated: string;
  marketStatus: {
    isOpen: boolean;
    nextOpen?: string;
    nextClose?: string;
  };
}

interface IncrementalUpdate {
  type: 'heatmap' | 'indices' | 'movers' | 'quotes';
  data: any;
  timestamp: string;
}

// Cache for the unified data
let cachedData: UnifiedMarketData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 15000; // 15 seconds

// Market status helper
function getMarketStatus() {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const hour = nyTime.getHours();
  const day = nyTime.getDay();
  const isWeekend = day === 0 || day === 6;
  const isMarketHours = hour >= 9 && hour < 16;
  
  return {
    isOpen: !isWeekend && isMarketHours,
    nextOpen: getNextMarketOpen(nyTime),
    nextClose: getNextMarketClose(nyTime)
  };
}

// Dynamic sector classification based on company name and symbol
function classifyStockSector(symbol: string, name: string): string {
  const symbolUpper = symbol.toUpperCase();
  const nameLower = name.toLowerCase();

  // Technology sector patterns
  if (
    symbolUpper.match(/^(AAPL|MSFT|GOOGL?|AMZN|META|NVDA|TSLA|AMD|INTC|ORCL|CRM|ADBE|NFLX|PYPL|SQ|SHOP|SPOT|UBER|LYFT|SNAP|TWTR|ZOOM|DOCU|OKTA|ZM|PLTR|SNOW|CRWD|DDOG|NET|TEAM|WDAY|VEEV|NOW|SPLK|ZS)$/) ||
    nameLower.match(/(tech|software|cloud|cyber|semi|chip|digital|internet|online|platform|data|ai|quantum|crypto|blockchain)/)
  ) {
    return 'Technology';
  }

  // Healthcare & Biotech
  if (
    symbolUpper.match(/^(JNJ|PFE|ABBV|LLY|UNH|MRK|BMY|AMGN|GILD|BIIB|MRNA|REGN|TMO|DHR|ABT|MDT|SYK|ZTS|CVS|ANTM|HUM|WBA|CVS)$/) ||
    nameLower.match(/(health|medical|pharma|bio|drug|therapeutic|clinical|hospital|care|medicine)/)
  ) {
    return 'Healthcare';
  }

  // Financial Services
  if (
    symbolUpper.match(/^(JPM|BAC|WFC|C|GS|MS|AXP|V|MA|BLK|SPGI|ICE|CME|SCHW|TFC|USB|PNC|TD|BK|STT|NTRS|FIS|FISV|SQ|PYPL)$/) ||
    nameLower.match(/(bank|financial|credit|payment|insurance|invest|capital|fund|trading|exchange)/)
  ) {
    return 'Finance';
  }

  // Energy sector
  if (
    symbolUpper.match(/^(XOM|CVX|COP|EOG|SLB|MPC|PSX|VLO|OXY|KMI|WMB|ENB|TRP|EPD|ET|MRO|DVN|FANG|PXD|CLR|CHK)$/) ||
    nameLower.match(/(energy|oil|gas|petroleum|coal|renewable|solar|wind|electric|power|utility)/)
  ) {
    return 'Energy';
  }

  // Consumer & Retail
  if (
    symbolUpper.match(/^(AMZN|HD|MCD|NKE|SBUX|TGT|WMT|COST|LOW|TJX|ROST|ULTA|BBY|DG|DLTR|GPS|ANF|RL|LULU|DECK)$/) ||
    nameLower.match(/(retail|consumer|store|shop|restaurant|food|beverage|apparel|clothing|fashion|brand)/)
  ) {
    return 'Consumer';
  }

  // Industrial & Manufacturing
  if (
    symbolUpper.match(/^(BA|CAT|HON|GE|MMM|UPS|FDX|RTX|LMT|NOC|GD|DE|EMR|ITW|ETN|PH|ROK|DOV|XYL|CMI|IR)$/) ||
    nameLower.match(/(industrial|manufacturing|aerospace|defense|machinery|equipment|transport|logistics|construction)/)
  ) {
    return 'Industrial';
  }

  // Real Estate
  if (
    symbolUpper.match(/^(AMT|CCI|EQIX|PLD|WELL|PSA|SPG|O|REIT|VTR|HST|HLT|MAR|IHG)$/) ||
    nameLower.match(/(real estate|property|reit|hotel|residential|commercial|land|housing)/)
  ) {
    return 'Real Estate';
  }

  // Materials & Commodities
  if (
    symbolUpper.match(/^(LIN|APD|ECL|SHW|DD|DOW|FCX|NEM|GOLD|VALE|RIO|BHP|AA|X|CLF|NUE|STLD)$/) ||
    nameLower.match(/(materials|chemical|mining|metals|gold|silver|copper|steel|aluminum|commodity)/)
  ) {
    return 'Materials';
  }

  // Telecommunications
  if (
    symbolUpper.match(/^(VZ|T|TMUS|CMCSA|CHTR|DIS|NFLX|PARA)$/) ||
    nameLower.match(/(telecom|wireless|cable|media|broadcast|communication|network)/)
  ) {
    return 'Communication';
  }

  // Default to Mixed if no clear classification
  return 'Mixed';
}

// Generate dynamic heatmap from market movers
function generateDynamicHeatmap(gainers: any[], losers: any[], actives: any[], debug = false): { sectors: any[] } {
  if (debug) {
    console.log('🔥 Generating dynamic heatmap from movers data...');
  }

  // Combine all movers into one array
  const allMovers = [...gainers, ...losers, ...actives].filter((stock, index, self) => 
    // Remove duplicates by symbol
    index === self.findIndex(s => s.symbol === stock.symbol)
  );

  if (debug) {
    console.log(`📊 Processing ${allMovers.length} unique stocks for heatmap`);
  }

  // Group stocks by sector
  const sectorGroups: Record<string, any[]> = {};
  
  allMovers.forEach(stock => {
    const sector = classifyStockSector(stock.symbol, stock.name);
    if (!sectorGroups[sector]) {
      sectorGroups[sector] = [];
    }
    
    // Only add if we don't already have 4 stocks in this sector
    if (sectorGroups[sector].length < 4) {
      sectorGroups[sector].push({
        symbol: stock.symbol,
        change: stock.changePercent || 0
      });
    }
  });

  // Convert to sector format expected by the UI
  const sectors = Object.entries(sectorGroups).map(([sectorName, stocks]) => {
    // Only include sectors with at least 2 stocks
    if (stocks.length < 2) {
      if (debug) {
        console.log(`⚠️ Skipping sector ${sectorName}: only ${stocks.length} stock(s) - need at least 2`);
      }
      return null;
    }

    // Calculate sector performance as average of stock performances
    const avgChange = stocks.reduce((sum, stock) => sum + stock.change, 0) / stocks.length;
    
    // Estimate market cap based on sector (simplified)
    const marketCapMultipliers: Record<string, number> = {
      'Technology': 50,
      'Healthcare': 30,
      'Finance': 25,
      'Consumer': 20,
      'Energy': 15,
      'Industrial': 12,
      'Communication': 18,
      'Materials': 8,
      'Real Estate': 10,
      'Mixed': 5
    };

    const estimatedMarketCap = (marketCapMultipliers[sectorName] || 5) * 1_000_000_000_000;

    if (debug) {
      console.log(`🏢 Sector ${sectorName}: ${avgChange.toFixed(2)}% (${stocks.length} stocks)`);
      stocks.forEach(stock => {
        console.log(`  - ${stock.symbol}: ${stock.change.toFixed(2)}%`);
      });
    }

    return {
      name: sectorName,
      change: avgChange,
      marketCap: estimatedMarketCap,
      stocks: stocks
    };
  }).filter((sector): sector is NonNullable<typeof sector> => sector !== null); // Remove null entries with proper type guard

  // Sort sectors by absolute change (most volatile first)
  sectors.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  if (debug) {
    console.log(`✅ Generated ${sectors.length} sectors for heatmap`);
  }

  return { sectors };
}

function getNextMarketOpen(nyTime: Date): string {
  const tomorrow = new Date(nyTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 30, 0, 0);
  return tomorrow.toISOString();
}

function getNextMarketClose(nyTime: Date): string {
  const today = new Date(nyTime);
  today.setHours(16, 0, 0, 0);
  return today.toISOString();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'full'; // 'full' | 'incremental'
  const section = searchParams.get('section'); // for incremental updates
  const debug = searchParams.get('debug') === '1';
  
  try {
    // For incremental updates, return only specific section
    if (mode === 'incremental' && section) {
      const update = await getIncrementalUpdate(section as any, debug);
      return NextResponse.json(update, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Check if we have fresh cached data
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
      if (debug) {
        console.log('📦 Returning cached unified data');
      }
      return NextResponse.json(cachedData, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
          'X-Data-Source': 'cache'
        }
      });
    }

    // Fetch all data in parallel for maximum efficiency
    if (debug) {
      console.log('🚀 Fetching unified market data...');
    }

    const startTime = Date.now();
    
    const [indicesData, moversData] = await Promise.allSettled([
      // Indices data
      fetchIndices().catch(error => {
        console.warn('Indices data failed:', error);
        return [];
      }),
      
      // Movers data (all types in parallel)
      Promise.all([
        fetchMovers('gainers').catch(() => []),
        fetchMovers('losers').catch(() => []),
        fetchMovers('actives').catch(() => [])
      ]).catch(error => {
        console.warn('Movers data failed:', error);
        return [[], [], []];
      })
    ]);

    // Extract results with fallbacks
    const indices = indicesData.status === 'fulfilled' ? indicesData.value : [];
    const [gainers, losers, actives] = moversData.status === 'fulfilled' ? moversData.value : [[], [], []];

    // Generate dynamic heatmap from movers data
    const heatmap = generateDynamicHeatmap(gainers, losers, actives, debug);

    // Build unified response
    const unifiedData: UnifiedMarketData = {
      heatmap,
      indices: indices.slice(0, 5), // Limit to top 5 indices
      movers: {
        gainers: gainers.slice(0, 10),
        losers: losers.slice(0, 10),
        actives: actives.slice(0, 10)
      },
      quotes: {}, // Can be populated with specific symbols on demand
      lastUpdated: new Date().toISOString(),
      marketStatus: getMarketStatus()
    };

    // Cache the result
    cachedData = unifiedData;
    cacheTimestamp = now;

    const fetchTime = Date.now() - startTime;
    
    if (debug) {
      console.log(`✅ Unified data fetched in ${fetchTime}ms`);
      console.log(`📊 Sectors: ${heatmap.sectors.length}`);
      console.log(`📈 Indices: ${indices.length}`);
      console.log(`🔥 Gainers: ${gainers.length}, Losers: ${losers.length}, Actives: ${actives.length}`);
    }

    return NextResponse.json(unifiedData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'X-Fetch-Time': fetchTime.toString(),
        'X-Data-Source': 'fresh'
      }
    });

  } catch (error) {
    console.error('Unified market data error:', error);
    
    // Return cached data if available, even if stale
    if (cachedData) {
      return NextResponse.json({
        ...cachedData,
        error: 'Using cached data due to fetch error',
        lastUpdated: new Date(cacheTimestamp).toISOString()
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
          'X-Data-Source': 'stale-cache'
        }
      });
    }

    return NextResponse.json({
      heatmap: { sectors: [] },
      indices: [],
      movers: { gainers: [], losers: [], actives: [] },
      quotes: {},
      lastUpdated: new Date().toISOString(),
      marketStatus: getMarketStatus(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Get incremental updates for specific sections
async function getIncrementalUpdate(section: string, debug: boolean): Promise<IncrementalUpdate> {
  const timestamp = new Date().toISOString();
  
  try {
    switch (section) {
      case 'heatmap':
        // Generate heatmap from fresh movers data
        const [gainers, losers, actives] = await Promise.all([
          fetchMovers('gainers').catch(() => []),
          fetchMovers('losers').catch(() => []),
          fetchMovers('actives').catch(() => [])
        ]);
        const heatmapData = generateDynamicHeatmap(gainers, losers, actives, debug);
        return {
          type: 'heatmap',
          data: heatmapData,
          timestamp
        };
        
      case 'indices':
        const indicesData = await fetchIndices();
        return {
          type: 'indices',
          data: indicesData.slice(0, 5),
          timestamp
        };
        
      case 'movers':
        const [gainersData, losersData, activesData] = await Promise.all([
          fetchMovers('gainers').catch(() => []),
          fetchMovers('losers').catch(() => []),
          fetchMovers('actives').catch(() => [])
        ]);
        return {
          type: 'movers',
          data: {
            gainers: gainersData.slice(0, 10),
            losers: losersData.slice(0, 10),
            actives: activesData.slice(0, 10)
          },
          timestamp
        };
        
      default:
        throw new Error(`Unknown section: ${section}`);
    }
  } catch (error) {
    if (debug) {
      console.error(`Incremental update failed for ${section}:`, error);
    }
    
    return {
      type: section as any,
      data: null,
      timestamp
    };
  }
}

// POST endpoint for requesting specific quote updates
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbols } = body;
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'Invalid symbols array' }, { status: 400 });
    }

    // Limit to 50 symbols to prevent abuse
    const limitedSymbols = symbols.slice(0, 50);
    
    const quotes = await Promise.allSettled(
      limitedSymbols.map(symbol => 
        marketDataService.getQuote(symbol).catch(error => ({
          symbol,
          error: error.message,
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          timestamp: Date.now()
        }))
      )
    );

    const results = quotes.reduce((acc, result, index) => {
      const symbol = limitedSymbols[index];
      if (result.status === 'fulfilled') {
        acc[symbol] = result.value;
      } else {
        acc[symbol] = {
          symbol,
          error: result.reason?.message || 'Failed to fetch',
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          timestamp: Date.now()
        };
      }
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      quotes: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
