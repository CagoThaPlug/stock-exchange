'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
// TickerTape rendered within MarketOverview
import { StockSearch } from '@/components/dashboard/StockSearch';
import { MarketHeatmap } from '@/components/dashboard/MarketHeatmap';
import { TrendingStocks } from '@/components/dashboard/TrendingStocks';
import { NewsFeed } from '@/components/dashboard/NewsFeed';
import { ChatButton } from '@/components/chat/ChatButton';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ComplianceNotice } from '@/components/legal/ComplianceNotice';
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';
import { OnboardingTour } from '@/components/ux/OnboardingTour';
import { usePreferences } from '@/hooks/usePreferences';
import { ErrorBoundary } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-destructive/20 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-4 text-sm">{error.message}</p>
        <div className="space-y-2">
          <button
            onClick={resetErrorBoundary}
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-muted text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted/80 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { preferences } = usePreferences();
  const [mounted, setMounted] = useState(false);
  const [switchingLayout, setSwitchingLayout] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggleChat = () => {
    if (!preferences.showChat) return;
    setIsChatOpen((prev) => !prev);
  };

  // Animate layout switch when preferences.layout changes
  useEffect(() => {
    if (!mounted) return;
    setSwitchingLayout(true);
    const t = setTimeout(() => setSwitchingLayout(false), 250);
    return () => clearTimeout(t);
    // intentionally depend on layout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.layout]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <KeyboardShortcuts onToggleChat={handleToggleChat} />
        <OnboardingTour />
        
        <Header />
        
        <main id="main-content" className="container mx-auto px-4 py-6 space-y-8 relative" role="main" aria-label="Main content">
          {/* Layout switching fade overlay */}
          {switchingLayout && (
            <div className="pointer-events-none absolute inset-0 z-10 bg-background/60 animate-fade-in" />
          )}
          <ComplianceNotice />
          
          <div className={`transition-opacity duration-200 ${switchingLayout ? 'opacity-0' : 'opacity-100'}`}>
          {preferences.layout === 'classic' && (
            <>
              {/* Market Overview Section */}
              <section className="market-overview">
                <MarketOverview />
              </section>

              {/* Stock Search Section */}
              <section className="stock-search">
                <StockSearch />
              </section>

              {/* Market Analysis Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Market Heatmap - Takes 2 columns on large screens */}
                <div className="lg:col-span-2">
                  <MarketHeatmap />
                </div>
                
                {/* Trending Stocks - Takes 1 column */}
                <div>
                  <TrendingStocks />
                </div>
              </div>

              {/* News Feed Section */}
              <section>
                <NewsFeed />
              </section>
              
            </>
          )}

          {preferences.layout === 'compact' && (
            <>
              {/* Two-column compact grid with scroll-friendly cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <MarketOverview />
                  <TrendingStocks />
                </div>
                <div className="space-y-6">
                  <StockSearch />
                  <MarketHeatmap />
                </div>
              </div>
              <NewsFeed />
            </>
          )}

          {preferences.layout === 'analysis' && (
            <>
              {/* Analysis-first layout: big StockSearch + Heatmap, then movers and news */}
              <section className="stock-search">
                <StockSearch />
              </section>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <MarketHeatmap />
                </div>
                <div>
                  <TrendingStocks />
                </div>
              </div>
              <MarketOverview />
              <NewsFeed />
            </>
          )}
          </div>
        </main>

        <Footer />

        {/* AI Chat Interface */}
        {preferences.showChat && (
          <div className="ai-chat-container">
            <ChatButton
              isOpen={isChatOpen}
              onClick={() => setIsChatOpen(!isChatOpen)}
            />
            <ChatWindow
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}