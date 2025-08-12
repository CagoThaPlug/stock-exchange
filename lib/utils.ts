import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Centralized API fetch that targets backend origin when configured
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const base = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_BASE || 'https://api.zalc.dev') : '';
  let url = input;
  if (!input.startsWith('http')) {
    if (base) {
      // Strip leading /api when targeting api.zalc.dev-style roots
      const [pathOnly, query = ''] = input.split('?', 2);
      const strippedPath = pathOnly === '/api'
        ? '/'
        : pathOnly.startsWith('/api/')
        ? pathOnly.slice(4)
        : pathOnly;
      const normalizedPath = strippedPath.startsWith('/') ? strippedPath : `/${strippedPath}`;
      url = `${base.replace(/\/$/, '')}${normalizedPath}${query ? `?${query}` : ''}`;
    } else {
      url = input;
    }
  }
  const finalInit: RequestInit = {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'X-Requested-With': 'web-client',
    },
  };
  return fetch(url, finalInit);
}
