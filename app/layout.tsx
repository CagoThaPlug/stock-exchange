import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { AccessibilityProvider } from '@/components/providers/AccessibilityProvider';
import { StockSelectionProvider } from '@/components/providers/StockSelectionProvider';
import { LangSync } from '@/components/layout/LangSync';
import { CurrencyProvider } from '@/components/providers/CurrencyProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Zalc.Dev AI Stock Exchange - Intelligent Trading Insights',
  description: 'AI-powered stock market analysis with real-time data and intelligent insights. No signup required.',
  keywords: 'stock market, AI trading, stock analysis, market data, investment tools',
  viewport: 'width=device-width, initial-scale=1',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6366F1' },
    { media: '(prefers-color-scheme: dark)', color: '#1F2937' }
  ]
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="https://i.imgur.com/iCoE9TK.png" />
        <meta name="robots" content="index, follow" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] bg-primary text-primary-foreground px-3 py-2 rounded">
          Skip to main content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
        >
          <AccessibilityProvider>
            <PreferencesProvider>
              <LangSync />
              <CurrencyProvider>
                <StockSelectionProvider>
                  {children}
                </StockSelectionProvider>
              </CurrencyProvider>
            </PreferencesProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}