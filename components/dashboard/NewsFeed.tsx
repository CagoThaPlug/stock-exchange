'use client';

import { useState, useEffect } from 'react';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { translate } from '@/lib/i18n';
import { Newspaper, ExternalLink, Clock, TrendingUp } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevantStocks: string[];
  category: string;
}

export function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { preferences } = usePreferences();

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/news?category=${encodeURIComponent(selectedCategory)}`, { cache: 'no-store', signal: controller.signal });
        const data = await res.json();
        const items: any[] = Array.isArray(data.articles) ? data.articles : [];
        const mapped: NewsItem[] = items.map((a: any, idx: number) => ({
          id: a.id || String(idx),
          title: a.title || 'Untitled',
          summary: a.summary || a.description || '',
          source: a.source?.name || a.source || 'News',
          publishedAt: a.publishedAt || new Date().toISOString(),
          url: a.url || '#',
          sentiment: a.sentiment || 'neutral',
          relevantStocks: a.relevantStocks || a.relevantSymbols || [],
          category: selectedCategory === 'all' ? 'General' : selectedCategory,
        }));
        if (preferences.autoTranslateNews && preferences.language !== 'en') {
          const translated = await Promise.all(
            mapped.slice(0, 12).map(async (n) => {
              try {
                const [tTitleRes, tSumRes] = await Promise.all([
                  fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: n.title, targetLang: preferences.language }) }),
                  n.summary ? fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: n.summary, targetLang: preferences.language }) }) : Promise.resolve(null),
                ]);
                const tTitleJson = await tTitleRes?.json();
                const tSumJson = n.summary ? await tSumRes?.json() : null;
                return { ...n, title: tTitleJson?.translated || n.title, summary: tSumJson?.translated || n.summary };
              } catch {
                return n;
              }
            })
          );
          setNews(translated);
        } else {
          setNews(mapped);
        }
      } catch (e) {
        setNews([]);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [selectedCategory, preferences.language]);

  const categories = [
    'all',
    'Technology',
    'Finance',
    'World',
    'Games',
    'Automotive',
    'Healthcare',
    'Energy',
    'Retail',
    'Crypto',
    'Commodities',
    'Macro',
  ];
  const filteredNews = selectedCategory === 'all' 
    ? news 
    : news.filter(item => item.category === selectedCategory);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border border-green-200 dark:border-green-800';
      case 'negative':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border border-red-200 dark:border-red-800';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return translate(preferences.language, 'time.justNow', 'Just now');
    if (diffInHours < 24) return translate(preferences.language, 'time.hoursAgo', `${diffInHours}h ago`).replace('{h}', String(diffInHours));
    const d = Math.floor(diffInHours / 24);
    return translate(preferences.language, 'time.daysAgo', `${d}d ago`).replace('{d}', String(d));
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Newspaper className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">{translate(preferences.language, 'news.title', 'Market News & Analysis')}</h2>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <TrendingUp className="w-4 h-4" />
          <span>{translate(preferences.language, 'news.live', 'Live Updates')}</span>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedCategory === category
                ? 'bg-background text-foreground shadow-sm ring-1 ring-primary/30'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent/20'
            }`}
          >
            {category === 'all' ? translate(preferences.language, 'news.all', 'All News') : translate(preferences.language, `category.${category}`, category)}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse p-4 border border-border rounded-lg">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-muted rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* News Items */}
      {!loading && (
        <div className="max-h-[60vh] md:max-h-[520px] overflow-y-auto pr-1">
          <div className="space-y-4">
            {filteredNews.map((item) => (
            <article
              key={item.id}
              className="p-4 border border-border rounded-lg hover:bg-accent/10 hover:shadow-md transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSentimentColor(item.sentiment)}`}>
                    {translate(preferences.language, `sentiment.${item.sentiment}`, item.sentiment)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{translate(preferences.language, `category.${item.category}`, item.category)}</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(item.publishedAt)}</span>
                </div>
              </div>

              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-lg mb-2 group-hover:underline transition-colors inline-block"
                aria-label={`Open article: ${item.title}`}
              >
                {item.title}
              </a>
              
              <p className="text-muted-foreground text-sm mb-3 leading-relaxed">
                {item.summary}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-muted-foreground font-medium">
                    {item.source}
                  </span>
                  {item.relevantStocks.length > 0 && (
                    <div className="flex items-center space-x-1">
                  <span className="text-xs text-muted-foreground">{translate(preferences.language, 'news.related', 'Related:')}</span>
                      <div className="flex space-x-1">
                        {item.relevantStocks.slice(0, 3).map((stock) => (
                          <span
                            key={stock}
                            className="px-2 py-1 bg-muted text-xs font-medium rounded"
                          >
                            {stock}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1 text-xs text-foreground hover:underline"
                >
                  <span>{translate(preferences.language, 'news.readMore', 'Read More')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          {translate(preferences.language, 'news.footerNote', 'News updates every 5 minutes • AI-powered sentiment analysis')}
        </p>
      </div>
    </div>
  );
}