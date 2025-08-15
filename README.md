# Zalc.Dev AI Stock Exchange

A modern, AI-powered stock market analysis platform built with Next.js. Think "ChatGPT meets Bloomberg Terminal" — providing real-time market data, intelligent analysis, and beautiful visualizations without requiring user accounts.

Originally developed for the [BridgeMind AI Competition](https://www.bridgemind.ai/competition)


## Live Demo

- Deployed URL: https://stocks.zalc.dev


## Highlights (mapped to judging criteria)

- Number/usefulness of AI tools: 
  - AI Chat analyst with persona control (conservative/balanced/aggressive)
  - AI translation for multilingual UX (Hugging Face Inference API)
  - Heuristic news sentiment tagging for fast triage
- Quality of stock market integration:
  - Real quotes, movers, search, and charts via Yahoo Finance (edge-safe fetch client)
  - Cloudflare Pages Functions backend with resilient fallbacks and zero-config browser calls
  - Market heatmap, ticker tape, indices overview, FX conversion
- Modern UI/UX: 
  - Clean, responsive UI with Tailwind + shadcn/ui patterns
  - Keyboard shortcuts, accessible components, local preferences
- Overall experience: 
  - No login required; all preferences in localStorage
  - Fast, resilient APIs with graceful fallbacks and rate limiting
- Code quality & docs:
  - TypeScript, modular API routes, providers, clear README


## ✨ Features

### 🤖 **AI-Powered Analysis**
- **Smart Chat Assistant**: Persona-tuned AI analyst (Conservative/Balanced/Aggressive) using Groq LLMs
- **Multilingual Support**: Auto-translation for global markets via Hugging Face models
- **Sentiment Analysis**: Real-time news sentiment scoring for market insights

### 📊 **Advanced Market Visualization**
- **Dynamic Heatmap**: Interactive sector performance with drill-down capability
- **Market Overview**: Live indices with market status and countdown timers
- **Professional Charts**: Multi-timeframe analysis with smart fallbacks (1D to 5Y)
- **Market Movers**: Real-time gainers, losers, and most active stocks

### 🔍 **Intelligent Stock Search**
- **Smart Search**: Typeahead with company name resolution and deduplication
- **Detailed Analysis**: Complete stock profiles with sector, volume, and market cap
- **Visual Stock Icons**: Company logos for instant recognition
- **Quick Selection**: Click-to-analyze from any component

### 📰 **Comprehensive News Feed**
- **Multi-Source Aggregation**: Yahoo Finance + Google News with smart filtering
- **Sentiment Tagging**: Automated positive/negative/neutral classification
- **Stock Association**: News articles linked to relevant symbols

### 🎨 **Modern User Experience**
- **Multiple Layouts**: Classic, Compact, and Analysis views for different workflows
- **Responsive Design**: Mobile-first with elegant desktop experience
- **Accessibility First**: WCAG compliant with keyboard shortcuts and screen reader support
- **No Authentication**: All preferences stored locally for privacy

### 🌐 **Global Market Support**
- **Multi-Currency**: Real-time FX conversion for global analysis
- **Multi-Language**: 5+ supported languages with AI translation
- **Market Hours**: Intelligent market status with timezone awareness


## 🛠️ Tech Stack

### **Frontend**
- **Framework**: Next.js 15 with App Router (TypeScript)
- **Styling**: Tailwind CSS with custom design system
- **Components**: Radix UI primitives + shadcn/ui patterns
- **Icons**: Lucide React for consistent iconography
- **Charts**: Recharts for financial data visualization
- **State Management**: React Context + Custom Hooks

### **Backend & APIs**
- **Runtime**: Edge Runtime for optimal performance
- **Data Sources**: Yahoo Finance, ExchangeRate-API, Google News RSS
- **AI Integration**: Groq LLMs + Hugging Face Transformers
- **Deployment**: Cloudflare Pages with Functions

### **Architecture**
- **Unified API**: Single endpoint for all market data (`/api/market/unified`)
- **Incremental Updates**: Smart caching with selective data refresh
- **Type Safety**: Comprehensive TypeScript with shared type definitions
- **Error Handling**: Graceful degradation with fallback strategies


## 📁 Project Structure

### **Frontend Components**
```
app/
├── page.tsx                     # Main dashboard with layout switching
├── layout.tsx                   # Root layout with providers
└── globals.css                  # Global styles and animations

components/
├── dashboard/
│   ├── MarketOverview.tsx       # Market indices with live status
│   ├── MarketHeatmap.tsx        # Interactive sector visualization
│   ├── TrendingStocks.tsx       # Market movers with tabs
│   ├── StockSearch.tsx          # Search with charts and analysis
│   └── NewsFeed.tsx             # Aggregated news with sentiment
├── chat/
│   ├── ChatButton.tsx           # Floating chat toggle
│   └── ChatWindow.tsx           # AI assistant interface
├── providers/
│   ├── PreferencesProvider.tsx  # User settings and layout
│   ├── ThemeProvider.tsx        # Dark/light mode management
│   ├── CurrencyProvider.tsx     # Multi-currency support
│   └── StockSelectionProvider.tsx # Cross-component stock sharing
└── ui/                          # Reusable UI primitives
```

### **Backend & API Routes**
```
app/api/
├── chat/route.ts                # AI chat with Groq LLMs
├── market/
│   ├── unified/route.ts         # 🔥 Main market data endpoint
│   └── data/route.ts            # Legacy endpoint (search, quotes, charts)
├── news/route.ts                # News aggregation + sentiment
├── translate/route.ts           # Hugging Face translation
└── fx/route.ts                  # Currency exchange rates

functions/api/                   # Cloudflare Pages Functions
├── fx.ts                        # FX rates for production
├── news.ts                      # News aggregation
└── translate.ts                 # Translation service
```

### **Core Libraries**
```
lib/
├── market-data.ts               # Market data fetching utilities
├── yahoo.ts                     # Edge-safe Yahoo Finance client
├── unified-cache.ts             # Client-side caching system
├── format.ts                    # Number and currency formatting
├── i18n.ts                      # Internationalization helpers
└── utils.ts                     # Common utilities

types/
└── common.ts                    # Shared TypeScript definitions

hooks/
└── useUnifiedMarketData.ts      # Unified data hook with caching
```


## AI Integration Details

- Chat (server route: `POST /api/chat`)
  - Models: `llama3-8b-8192`, `llama3-70b-8192`, `mixtral-8x7b-32768`, `gemma-7b-it`
  - Strategy: try in order with robust error handling and 30 req/min/IP rate limit
  - Persona: `conservative` (lower temperature), `balanced` (default), `aggressive` (higher temperature)
  - Response style: concise (<100 words) with disclaimer
- Translation (server route: `POST /api/translate`)
  - Uses Hugging Face Inference API with Helsinki-NLP models
  - Works both en→multilingual and multilingual→en; falls back to original text if token not set
- Sentiment
  - Heuristic keyword-based scoring over news titles/summaries for responsiveness


## 🔌 API Endpoints

### **Primary Endpoints**

#### **🚀 Unified Market Data** (Recommended)
```
GET /api/market/unified
GET /api/market/unified?mode=incremental&section=heatmap|indices|movers
```
- **Full Mode**: Returns complete market snapshot (heatmap, indices, movers)
- **Incremental Mode**: Returns specific section data for efficient updates
- **Caching**: Smart server-side caching with 30-second TTL
- **Response**: `{ heatmap, indices, movers, quotes, lastUpdated, marketStatus }`

#### **🤖 AI Chat**
```
POST /api/chat
Body: { message: string, personality?: 'conservative'|'balanced'|'aggressive' }
```
- **Models**: Groq LLMs with automatic fallback
- **Rate Limiting**: 30 requests/minute per IP
- **Requires**: `GROQ_API_KEY` environment variable

### **Legacy Endpoints**

#### **📊 Market Data (Legacy)**
```
GET /api/market/data?section=indices|movers|search|quote|chart
```
- `section=indices` → `{ indices }`
- `section=movers&type=gainers|losers|actives` → `{ movers }`
- `section=search&q=TSLA` → `{ results }`
- `section=quote&symbol=TSLA` → `{ quote }`
- `section=chart&symbol=TSLA&range=1mo&interval=1d` → `{ chart }`

#### **📰 News & Services**
```
GET /api/news?category=all|Technology|Finance|...    # → { articles }
POST /api/translate                                  # → { translated }
GET /api/fx?base=USD                                 # → { base, rates, date }
```

### **Debug Mode**
Add `&debug=1` to any endpoint for detailed debugging information including:
- Request timing and performance metrics
- Data source information and fallback usage
- Cloudflare edge location and caching headers


## Environment Variables

Create `project/.env.local` with:

```
GROQ_API_KEY=your_groq_api_key_here           # required for AI chat
HF_TOKEN=your_huggingface_token_here          # optional (or use HUGGINGFACE_API_KEY)
# Optional: override API base for client fetches (default is same-origin)
# NEXT_PUBLIC_API_BASE=https://your-api.example.com
```

Notes:
- If `GROQ_API_KEY` is missing, the chat route returns a helpful 503 error.
- If `HF_TOKEN`/`HUGGINGFACE_API_KEY` is missing, translation gracefully returns the original text.


## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ and npm
- Optional: Groq API key for AI chat functionality
- Optional: Hugging Face token for translation features

### **Local Development**
```bash
# Clone and setup
cd project
npm install

# Create environment file
cp .env.local.example .env.local  # or create manually

# Add required environment variables
echo "GROQ_API_KEY=your_groq_api_key_here" >> .env.local
echo "HF_TOKEN=your_huggingface_token_here" >> .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run cf:build     # Build for Cloudflare Pages
```


## 💡 Usage Tips

### **Keyboard Shortcuts**
- `Ctrl + /` - Toggle AI chat window
- `Ctrl + K` - Focus stock search
- `Ctrl + H` - View all keyboard shortcuts
- `Escape` - Close modals and dropdowns

### **Navigation**
- **Layout Switching**: Choose between Classic, Compact, or Analysis layouts in the header
- **Stock Selection**: Click any stock symbol to load detailed analysis
- **Sector Exploration**: Click heatmap sectors to drill down into individual stocks
- **Cross-Component Integration**: Selections flow seamlessly between all components

### **Customization**
- **Preferences**: Access via gear icon in header
  - Language (5+ supported with AI translation)
  - Currency (9+ major currencies with live FX rates)
  - AI Personality (Conservative/Balanced/Aggressive)
  - Theme (Light/Dark/High Contrast)
  - Layout preferences
- **Privacy**: All settings stored locally in browser (no accounts required)


## 🛡️ Safety & Performance

### **Rate Limiting & Security**
- **AI Chat**: 30 requests/minute per IP address with graceful degradation
- **API Protection**: Server-side validation and sanitization of all inputs
- **Edge Runtime**: Isolated execution environment for enhanced security

### **Data Reliability**
- **Multiple Fallbacks**: Automatic retry logic with alternative data sources
- **Smart Caching**: 30-second server cache with client-side optimization
- **Timeout Handling**: Graceful degradation when services are unavailable
- **Error Boundaries**: UI remains functional even when individual components fail

### **Performance Optimization**
- **Lazy Loading**: Charts and heavy components load on demand
- **Code Splitting**: Optimized bundle sizes with dynamic imports
- **Edge Deployment**: Global CDN with sub-100ms response times
- **Efficient Updates**: Incremental data fetching for real-time updates


## Deploying to Cloudflare Pages

This repo is configured for Cloudflare Pages with Pages Functions.

- Build command: `npm run cf:build` (uses `@cloudflare/next-on-pages`)
- Output directory: `.vercel/output/static`
- Functions directory: `functions/` (auto-detected by Pages)
- Config: `wrangler.toml` (includes `nodejs_compat`)

Environment variables to set on Pages (Project → Settings → Variables):
- `GROQ_API_KEY` (required for chat)
- `HF_TOKEN` or `HUGGINGFACE_API_KEY` (optional for translation)

Notes:
- Cloudflare’s runtime does not implement the `cache` field on `fetch` RequestInit. Client/server fetches in this repo avoid that field.
- The app uses same-origin API calls by default via `apiFetch`, so you don’t need a separate API origin.


## Development Notes

- Styling: Tailwind CSS + utility-first components
- Charts: Recharts (client-side only; small datasets)
- i18n: lightweight runtime `translate(...)` helper with optional AI translation
- Linting: ESLint config present; build does not block on lint

Market data fallbacks:
- Quotes: enrich with `quoteSummary` when partial.
- Market cap: approximated as `price × sharesOutstanding` using multiple fundamentals time series when top-level fields are missing.
- Charts: alternate ranges/intervals tried when primary request returns no points.

## ⚠️ Disclaimer

**This project is for educational and demonstration purposes only.** 

- 📚 **Educational Use**: Designed to showcase modern web development and AI integration techniques
- 🚫 **Not Financial Advice**: No content should be considered as investment recommendations
- 🔍 **Do Your Research**: Always conduct thorough research and consult with qualified financial advisors
- 📊 **Data Accuracy**: While we strive for accuracy, real-time data may have delays or discrepancies
- 💼 **Risk Warning**: All investments carry risk, and past performance does not guarantee future results

---

**Built with ❤️ using Next.js, TypeScript, and modern AI technologies.**


