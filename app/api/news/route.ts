import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

type YahooNews = {
  title?: string;
  link?: string;
  publisher?: string;
  providerPublishTime?: number; // seconds
  summary?: string;
};

const CATEGORY_TO_QUERIES: Record<string, string[]> = {
  all: ['stock market news today', 'markets wrap stocks bonds'],
  Technology: [
    'technology stocks semiconductors software cloud AI',
    'big tech earnings apple microsoft google meta nvidia',
  ],
  Finance: [
    'banks earnings credit risk interest rates bond yields',
    'investment banks brokers asset managers finance sector',
  ],
  World: [
    'global markets europe asia stocks geopolitics',
    'world economy currencies central banks global stocks',
  ],
  Games: [
    'video game industry publishers consoles esports gaming',
    'gaming stocks earnings activision ea take-two nintendo',
  ],
  Automotive: [
    'automotive EV charging batteries car sales automakers',
    'electric vehicles tesla legacy automakers suppliers',
  ],
  Healthcare: [
    'biotech pharma fda approvals healthcare stocks',
    'healthcare insurers hospitals devices life sciences',
  ],
  Energy: [
    'energy oil gas OPEC shale refinery stocks',
    'WTI Brent natural gas utilities renewable energy',
  ],
  Retail: [
    'retail consumer discretionary earnings ecommerce',
    'big box retailers same-store sales retail sector',
  ],
  Crypto: [
    'bitcoin ethereum crypto ETF blockchain exchanges',
    'crypto regulation SEC ETFs altcoins DeFi',
  ],
  Commodities: [
    'commodities oil gold copper wheat futures',
    'metals mining agriculture softs commodity markets',
  ],
  Macro: [
    'inflation CPI PPI jobs payroll GDP FOMC fed policy',
    'recession soft landing PMI housing macroeconomic data',
  ],
};

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category') || 'all';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '12');
  const candidates = CATEGORY_TO_QUERIES[category] || CATEGORY_TO_QUERIES.all;
  const q = candidates[Math.floor(Math.random() * candidates.length)];

  try {
    const yahooArticles = await fetchYahooArticles(q, limit);
    const googleArticles = await fetchGoogleNewsArticles(q, limit);

    // Merge, dedupe by URL/title, sort newest first, and slice to limit
    const merged = [...yahooArticles, ...googleArticles];
    const seenKeys = new Set<string>();
    const deduped = merged.filter((a) => {
      const key = (a.url || a.title).toLowerCase();
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    deduped.sort((a: any, b: any) => {
      const ta = new Date(a.publishedAt || 0).getTime();
      const tb = new Date(b.publishedAt || 0).getTime();
      return tb - ta;
    });

    const articles = deduped.slice(0, limit).map((a, idx) => ({ ...a, id: `${idx}-${a.title}` }));
    return NextResponse.json({ articles, totalResults: articles.length });
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json({ articles: [], totalResults: 0 }, { status: 200 });
  }
}

async function fetchYahooArticles(q: string, limit: number) {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=${limit}&enableFuzzyQuery=true`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finance.yahoo.com/',
      },
    });
    if (!response.ok) return [] as any[];
    const data = await response.json();
    const items: YahooNews[] = Array.isArray((data as any).news)
      ? (data as any).news
      : Array.isArray((data as any).items)
      ? (data as any).items
      : [];
    return items.map((n) => ({
      title: decodeHtml(n.title || 'Untitled'),
      summary: decodeHtml(n.summary || ''),
      url: n.link || '#',
      source: n.publisher || 'Yahoo Finance',
      publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : new Date().toISOString(),
      category: 'Yahoo',
      sentiment: inferSentiment(n.title || '', n.summary || ''),
      relevantStocks: [] as string[],
    }));
  } catch {
    return [] as any[];
  }
}

async function fetchGoogleNewsArticles(q: string, limit: number) {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(rssUrl);
    if (!res.ok) return [] as any[];
    const xml = await res.text();
    const items = parseRssItems(xml).slice(0, limit);
    return items.map((i) => ({
      title: decodeHtml(i.title || 'Untitled'),
      summary: '',
      url: normalizeGoogleLink(i.link),
      source: i.source || 'Google News',
      publishedAt: i.pubDate || new Date().toISOString(),
      category: 'Google',
      sentiment: inferSentiment(i.title || ''),
      relevantStocks: [] as string[],
    }));
  } catch {
    return [] as any[];
  }
}

function parseRssItems(xml: string): Array<{ title: string; link: string; pubDate?: string; source?: string }> {
  const items: Array<{ title: string; link: string; pubDate?: string; source?: string }> = [];
  const itemRegex = /<item[\s\S]*?<\/item>/g;
  const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i;
  const linkRegex = /<link>(.*?)<\/link>/i;
  const dateRegex = /<pubDate>(.*?)<\/pubDate>/i;
  const sourceRegex = /<source[^>]*>(.*?)<\/source>/i;
  const matches = xml.match(itemRegex) || [];
  for (const block of matches) {
    const titleMatch = block.match(titleRegex);
    const title = (titleMatch?.[1] || titleMatch?.[2] || 'Untitled').trim();
    const linkMatch = block.match(linkRegex);
    const link = (linkMatch?.[1] || '').trim();
    if (!link) continue;
    const pub = block.match(dateRegex)?.[1];
    const source = block.match(sourceRegex)?.[1];
    items.push({ title, link, pubDate: pub, source });
  }
  return items;
}

function normalizeGoogleLink(link: string): string {
  try {
    // Many Google News links contain a final url param
    const url = new URL(link);
    const real = url.searchParams.get('url');
    return real || link;
  } catch {
    return link;
  }
}

function inferSentiment(title: string, summary?: string): 'positive' | 'negative' | 'neutral' {
  const text = `${title} ${summary || ''}`.toLowerCase();
  const positiveKeywords = [
    'beat', 'beats', 'above expectations', 'tops', 'surge', 'soar', 'soars', 'rally', 'jump', 'jumps', 'rise', 'rises', 'upgrade', 'upgraded', 'record', 'strong', 'growth', 'expands', 'accelerates', 'adds', 'raises', 'boosts', 'approved', 'wins', 'profit', 'outperform'
  ];
  const negativeKeywords = [
    'miss', 'misses', 'below expectations', 'falls short', 'plunge', 'plunges', 'drop', 'drops', 'fall', 'falls', 'slump', 'sinks', 'downgrade', 'downgraded', 'cut', 'cuts', 'recall', 'ban', 'weak', 'slowdown', 'lawsuit', 'loss', 'warns', 'warning', 'underperform'
  ];

  let score = 0;
  for (const k of positiveKeywords) if (text.includes(k)) score += 1;
  for (const k of negativeKeywords) if (text.includes(k)) score -= 1;

  const posPct = /(\+|up\s)\d+(\.\d+)?%/.test(text);
  const negPct = /(-|down\s)\d+(\.\d+)?%/.test(text);
  if (posPct) score += 1;
  if (negPct) score -= 1;

  if (score >= 1) return 'positive';
  if (score <= -1) return 'negative';
  return 'neutral';
}

function decodeHtml(input: string): string {
  if (!input) return '';
  let s = input
    .replace(/&amp;/g, '&')
    .replace(/&amp(?=\b)/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—');

  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try { return String.fromCharCode(parseInt(hex, 16)); } catch { return _; }
  });
  s = s.replace(/&#(\d+);/g, (_, num) => {
    try { return String.fromCharCode(parseInt(num, 10)); } catch { return _; }
  });
  return s;
}