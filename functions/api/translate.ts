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
      headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text }),
    });
    if (res.ok) {
      const data = await res.json();
      const out = Array.isArray(data) && data[0]?.translation_text ? data[0].translation_text : String(text);
      return out;
    }
    if (res.status === 503 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
      continue;
    }
    break;
  }
  return text;
}

export async function onRequestPost(context: { request: Request; env: Record<string, string | undefined> }) {
  try {
    const body = await context.request.json();
    const text = typeof body?.text === 'string' ? body.text : '';
    const targetLang = typeof body?.targetLang === 'string' ? body.targetLang : 'en';
    if (!text.trim()) return json({ error: 'Missing text' }, 400);

    const hfToken = context.env.HF_TOKEN || context.env.HUGGINGFACE_API_KEY;
    if (!hfToken) return json({ translated: text });

    let translated = text;
    if (targetLang === 'en') {
      translated = await hfTranslate(MUL_TO_EN, hfToken, text);
    } else if (EN_TO_MODEL[targetLang]) {
      translated = await hfTranslate(EN_TO_MODEL[targetLang], hfToken, text);
    }

    return json({ translated });
  } catch (e) {
    return json({ error: (e as Error).message, translated: null }, 200);
  }
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}


