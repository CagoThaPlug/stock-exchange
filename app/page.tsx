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
        
        <main id="main-content" className={`container mx-auto px-4 py-6 relative layout-${preferences.layout}`} role="main" aria-label="Main content" style={{ gap: 'var(--layout-gap)' }}>
          {/* Layout switching fade overlay */}
          {switchingLayout && (
            <div className="pointer-events-none absolute inset-0 z-10 bg-background/60 animate-fade-in" />
          )}
          <ComplianceNotice />
          
          <div className={`transition-all duration-300 ease-in-out ${switchingLayout ? 'opacity-0 transform scale-[0.98]' : 'opacity-100 transform scale-100'}`}>
          {preferences.layout === 'classic' && (
            <div className="space-y-8">
              {/* Hero Section - Market Overview with enhanced spacing */}
              <section className="market-overview animate-fade-in">
                <MarketOverview />
              </section>

              {/* Primary Analysis Section - Stock Search with prominence */}
              <section className="stock-search animate-fade-in" style={{ animationDelay: '100ms' }}>
                <StockSearch />
              </section>

              {/* Interactive Market Analysis Grid - Responsive flow */}
              <section className="market-analysis animate-fade-in" style={{ animationDelay: '200ms' }}>
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                  {/* Market Heatmap - Premium placement */}
                  <div className="xl:col-span-3 order-1">
                    <MarketHeatmap />
                  </div>
                  
                  {/* Trending Stocks - Companion panel */}
                  <div className="xl:col-span-2 order-2">
                    <TrendingStocks />
                  </div>
                </div>
              </section>

              {/* News & Information Section */}
              <section className="news-section animate-fade-in" style={{ animationDelay: '300ms' }}>
                <NewsFeed />
              </section>
            </div>
          )}

          {preferences.layout === 'compact' && (
            <div className="space-y-6">
              {/* Efficient Two-Column Layout for Screen Real Estate */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Primary Column - Essential Data */}
                <div className="space-y-6 lg:col-span-1 xl:col-span-1">
                  <div className="animate-fade-in">
                    <MarketOverview />
                  </div>
                  <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
                    <TrendingStocks />
                  </div>
                </div>
                
                {/* Secondary Column - Analysis Tools */}
                <div className="space-y-6 lg:col-span-1 xl:col-span-2">
                  <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <StockSearch />
                  </div>
                  <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <MarketHeatmap />
                  </div>
                </div>
              </div>
              
              {/* Full-width News Section */}
              <div className="animate-fade-in" style={{ animationDelay: '250ms' }}>
                <NewsFeed />
              </div>
            </div>
          )}

          {preferences.layout === 'analysis' && (
            <div className="space-y-8">
              {/* Analysis-First Approach - Stock Search Takes Center Stage */}
              <section className="primary-analysis animate-fade-in">
                <StockSearch />
              </section>
              
              {/* Advanced Market Visualization Grid */}
              <section className="market-visualization animate-fade-in" style={{ animationDelay: '100ms' }}>
                <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {/* Enhanced Heatmap - Prominent Display */}
                  <div className="lg:col-span-3 xl:col-span-3 order-1">
                    <MarketHeatmap />
                  </div>
                  
                  {/* Market Movers - Side Panel */}
                  <div className="lg:col-span-1 xl:col-span-2 order-2 space-y-6">
                    <TrendingStocks />
                    <div className="lg:block xl:hidden">
                      <MarketOverview />
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Supporting Information Row */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Market Overview - Supporting role in analysis layout */}
                <div className="xl:col-span-1 hidden xl:block animate-fade-in" style={{ animationDelay: '200ms' }}>
                  <MarketOverview />
                </div>
                
                {/* News Feed - Takes remaining space */}
                <div className="xl:col-span-2 animate-fade-in" style={{ animationDelay: '250ms' }}>
                  <NewsFeed />
                </div>
              </div>
            </div>
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