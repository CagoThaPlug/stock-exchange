import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const EN_TO_MODEL: Record<string, string> = {
  es: 'Helsinki-NLP/opus-mt-en-es',
  fr: 'Helsinki-NLP/opus-mt-en-fr',
  de: 'Helsinki-NLP/opus-mt-en-de',
  zh: 'Helsinki-NLP/opus-mt-en-zh',
};

const MUL_TO_EN = 'Helsinki-NLP/opus-mt-mul-en';

async function hfTranslate(model: string, hfToken: string, text: string, retries = 2): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text }),
    });
    if (res.ok) {
      const data = await res.json();
      const out = Array.isArray(data) && data[0]?.translation_text ? data[0].translation_text : String(text);
      return out;
    }
    // If model is loading (503) or rate limited, wait briefly and retry
    if (res.status === 503 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
      continue;
    }
    // Other errors: break
    break;
  }
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }
    const target = typeof targetLang === 'string' ? targetLang : 'en';

    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
      // Graceful fallback to original text
      return NextResponse.json({ translated: text });
    }

    let translated: string = text;

    if (target === 'en') {
      translated = await hfTranslate(MUL_TO_EN, hfToken, text);
    } else if (EN_TO_MODEL[target]) {
      translated = await hfTranslate(EN_TO_MODEL[target], hfToken, text);
    } else {
      // Unsupported target: return original
      translated = text;
    }

    return NextResponse.json({ translated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, translated: null }, { status: 200 });
  }
}


