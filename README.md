# Zalc.Dev AI Stock Exchange — BridgeMind AI Competition Submission

Build: Next.js + AI for stock market insights — think “ChatGPT meets Bloomberg Terminal.” This app focuses on actionable market data, fast UX, and practical AI tools that enhance analysis without requiring user accounts.

Competition: [BridgeMind AI Competition](https://www.bridgemind.ai/competition)


## Live Demo

- Deployed URL: https://stocks.zalc.dev


## Highlights (mapped to judging criteria)

- Number/usefulness of AI tools: 
  - AI Chat analyst with persona control (conservative/balanced/aggressive)
  - AI translation for multilingual UX (Hugging Face Inference API)
  - Heuristic news sentiment tagging for fast triage
- Quality of stock market integration: 
  - Real quotes, movers, search, and charts via yahoo-finance2 (server-side)
  - Market heatmap, ticker tape, indices overview, FX conversion
- Modern UI/UX: 
  - Clean, responsive UI with Tailwind + shadcn/ui patterns
  - Keyboard shortcuts, accessible components, local preferences
- Overall experience: 
  - No login required; all preferences in localStorage
  - Fast, resilient APIs with graceful fallbacks and rate limiting
- Code quality & docs:
  - TypeScript, modular API routes, providers, clear README


## Features

- AI Stock Assistant
  - Chat with a persona-tuned analyst using Groq LLMs with model fallback
  - Safety defaults: concise replies, brief disclaimer, server-side rate limits
- Market Overview
  - Global indices snapshot with open/closed status indicator
- Ticker Tape
  - Indices/forex/commodities/crypto, smooth scrolling, manual refresh controls
- Market Heatmap
  - Sector performance view with weighted averages and drill-down to top movers
- Trending Stocks
  - Top gainers/losers/most active with quick selection
- Stock Search & Mini-Chart
  - Typeahead search, quote panel, 30-day chart with smart range fallbacks
- Market News Feed
  - Aggregated from Yahoo Finance and Google News RSS
  - Lightweight sentiment tagging; optional AI translation per user language
- Preferences (no auth)
  - Language, currency, AI personality, layout, keyboard shortcuts, show/hide chat
  - Persisted in localStorage only
- Accessibility & Theming
  - Dark/light theme, high-contrast toggle, keyboard shortcuts dialog


## Tech Stack

- Framework: Next.js 13 App Router (TypeScript)
- UI: Tailwind CSS, Radix/shadcn-inspired primitives, Lucide icons, Recharts
- Data: yahoo-finance2 (server-side), ExchangeRate.host (FX)
- AI: Groq Chat Completions API; Hugging Face Inference API for translation


## Project Structure (key paths)

- UI pages/components
  - `app/page.tsx` main dashboard
  - `components/dashboard/*` market UI (overview, heatmap, movers, search, news, ticker)
  - `components/chat/*` floating chat button and window
  - `components/providers/*` theme, preferences, currency, stock selection, accessibility
- API routes
  - `app/api/chat/route.ts` AI chat via Groq with IP rate limiting
  - `app/api/market/data/route.ts` indices, movers, search, quote, chart (yahoo-finance2)
  - `app/api/market/heatmap/route.ts` sector aggregates + top movers
  - `app/api/market/tape/route.ts` compact feed for ticker tape with market status
  - `app/api/news/route.ts` Yahoo/Google aggregation + sentiment tagging
  - `app/api/translate/route.ts` Hugging Face MT (optional)
  - `app/api/fx/route.ts` FX rates (ExchangeRate.host)
  - `app/api/logo/route.ts` company logo proxy with placeholder fallback
- Server utilities
  - `lib/market-data.ts` unified market data helpers
  - `lib/yahoo.ts` shared yahoo-finance2 config (cookie jar, quiet logger)


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


## API Endpoints

- `POST /api/chat`
  - Body: `{ message: string, personality?: 'conservative'|'balanced'|'aggressive' }`
  - Env required: `GROQ_API_KEY`
- `GET /api/market/data?section=indices|movers|search|quote|chart&...`
  - `indices` → `{ indices }`
  - `movers&type=gainers|losers|actives` → `{ results }`
  - `search&q=TSLA` → `{ results }`
  - `quote&symbol=TSLA` → `{ quote }`
  - `chart&symbol=TSLA&range=1mo&interval=1d` → `{ chart }`
- `GET /api/market/heatmap` → `{ sectors }`
- `GET /api/market/tape?category=all|indices|forex|commodities|crypto&limit=10` → `{ items, lastUpdated }` (+ `X-Market-Status` header)
- `GET /api/news?category=all|Technology|Finance|...` → `{ articles }`
- `POST /api/translate` → `{ translated }` (optional token)
- `GET /api/fx?base=USD` → `{ base, rates, date }`
- `GET /api/logo?symbol=AAPL` → proxied PNG or SVG placeholder


## Environment Variables

Create `project/.env.local` with:

```
GROQ_API_KEY=your_groq_api_key_here           # required for AI chat
HF_TOKEN=your_huggingface_token_here          # optional (or use HUGGINGFACE_API_KEY)
```

Notes:
- If `GROQ_API_KEY` is missing, the chat route returns a helpful 503 error.
- If `HF_TOKEN`/`HUGGINGFACE_API_KEY` is missing, translation gracefully returns the original text.


## Getting Started (local)

Prereqs: Node.js 18+ and npm

```
cd project
npm install
cp .env.local.example .env.local   # if you create one; otherwise create manually
# add GROQ_API_KEY (and optional HF_TOKEN)
npm run dev
```

Open http://localhost:3000


## Usage Tips

- Toggle AI chat: button at bottom-right or keyboard `Ctrl + /`
- Focus search: `Ctrl + K`; view shortcuts: `Ctrl + H`
- Preferences: gear icon in header → language, currency, AI personality, layout, theme
- Watchlist/Preferences: saved to `localStorage` only (no accounts)


## Safety & Limits

- The AI chat endpoint enforces a fixed-window rate limit (~30 requests/min/IP)
- All market data pulled server-side with timeouts/fallbacks; UI fails gracefully
- Educational use only — this app does not provide financial advice


## Development Notes

- Styling: Tailwind CSS + utility-first components
- Charts: Recharts (client-side only; small datasets)
- i18n: lightweight runtime `translate(...)` helper with optional AI translation
- Linting: ESLint config present; build does not block on lint


## Roadmap (post-competition ideas)

- Strategy backtesting and factor screens
- Portfolio simulator with PnL, risk metrics, and alerts
- Deeper AI tools: earnings call Q&A, RAG over filings/transcripts


## Disclaimer

This project is for educational purposes only and is not investment advice. Always do your own research.


