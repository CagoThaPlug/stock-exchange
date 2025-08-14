import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Simple in-memory rate limiter (fixed window)
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX = 30; // ~30 free calls per minute
type WindowCounter = { start: number; count: number };
const rateMap = new Map<string, WindowCounter>();

function getClientId(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  // NextRequest may expose IP in experimental setups
  // @ts-ignore
  if ((req as any).ip) return String((req as any).ip);
  return 'anonymous';
}

function checkRateLimit(clientId: string) {
  const now = Date.now();
  const current = rateMap.get(clientId);
  if (!current || now - current.start >= RATE_WINDOW_MS) {
    rateMap.set(clientId, { start: now, count: 1 });
    return { allowed: true, remaining: RATE_MAX - 1, reset: now + RATE_WINDOW_MS };
  }
  if (current.count >= RATE_MAX) {
    return { allowed: false, remaining: 0, reset: current.start + RATE_WINDOW_MS };
  }
  current.count += 1;
  return { allowed: true, remaining: RATE_MAX - current.count, reset: current.start + RATE_WINDOW_MS };
}

export async function POST(request: NextRequest) {
  try {
    const { message, personality = 'balanced' } = await request.json();

    // Check for Groq API key
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured on server. Add it to .env.local and restart.' },
        { status: 503 }
      );
    }

    // Rate limit per client
    const clientId = getClientId(request);
    const limit = checkRateLimit(clientId);
    if (!limit.allowed) {
      return new NextResponse(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.max(0, Math.ceil((limit.reset - Date.now()) / 1000)).toString(),
          'X-RateLimit-Limit': RATE_MAX.toString(),
          'X-RateLimit-Remaining': limit.remaining.toString(),
          'X-RateLimit-Reset': limit.reset.toString(),
        },
      });
    }

    const result = await generateWithGroq(message, personality, groqApiKey);

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        {
          status: result.status || 502,
          headers: {
            'X-RateLimit-Limit': RATE_MAX.toString(),
            'X-RateLimit-Remaining': limit.remaining.toString(),
            'X-RateLimit-Reset': limit.reset.toString(),
          },
        }
      );
    }

    return NextResponse.json(
      { response: result.text, timestamp: new Date().toISOString() },
      {
        headers: {
          'X-RateLimit-Limit': RATE_MAX.toString(),
          'X-RateLimit-Remaining': limit.remaining.toString(),
          'X-RateLimit-Reset': limit.reset.toString(),
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to process chat message: ${(error as Error).message || 'unknown error'}` },
      { status: 500 }
    );
  }
}

// Groq API generation
async function generateWithGroq(
  message: string,
  personality: string,
  groqApiKey: string
): Promise<{ text: string } | { error: string; status?: number }> {
  
  // Available Groq models (all free)
  const models = [
    'llama3-8b-8192',      // Fast and reliable
    'llama3-70b-8192',     // More powerful but slower
    'mixtral-8x7b-32768',  // Good alternative
    'gemma-7b-it'          // Google's model
  ];

  // Create system message based on personality
  const systemMessage = `You are a professional stock market analyst with a ${personality} investment approach. 
Provide helpful, accurate, educational information about stocks, markets, and trading.
IMPORTANT: Keep responses under 100 words. Be concise and direct. Always include a brief disclaimer.`;

  // Temperature based on personality
  const temperature = personality === 'aggressive' ? 0.8 : personality === 'conservative' ? 0.3 : 0.5;

  let lastError: { error: string; status?: number } | null = null;

  for (const model of models) {
    
    try {
      const payload = {
        messages: [
          {
            role: "system" as const,
            content: systemMessage
          },
          {
            role: "user" as const,
            content: `${message}\n\nPlease respond in 2-3 sentences maximum.`
          }
        ],
        model: model,
        max_tokens: 120,
        temperature: temperature,
        top_p: 1,
        stream: false
      };

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        
        // Handle specific error types
        if (res.status === 401) {
          return { error: 'Invalid Groq API key. Check your GROQ_API_KEY in .env.local', status: 401 };
        }
        if (res.status === 429) {
          
          lastError = { error: `Rate limit exceeded for ${model}`, status: 429 };
          continue;
        }
        
        lastError = { error: `Groq API ${res.status}: ${errorText || 'Request failed'} (model: ${model})`, status: res.status };
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;

      if (content && content.trim()) {
        
        return { text: content.trim() };
      }

      
      lastError = { error: `Groq API returned empty content (model: ${model})` };
    } catch (err) {
      
      lastError = { error: `Network error: ${(err as Error).message}`, status: 500 };
    }
  }

  return lastError || { error: 'All Groq models failed', status: 500 };
}