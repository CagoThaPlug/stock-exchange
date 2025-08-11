export type SupportedCurrency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'CNY'
  | 'INR'
  | 'CAD'
  | 'AUD'
  | 'CHF';

export function formatCurrency(
  value: number,
  options: { locale: string; currency: SupportedCurrency; maximumFractionDigits?: number } 
): string {
  const { locale, currency, maximumFractionDigits } = options;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: maximumFractionDigits ?? 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(maximumFractionDigits ?? 2)}`;
  }
}

export function formatNumber(value: number, locale: string, fractionDigits = 2): string {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return value.toFixed(fractionDigits);
  }
}

export function formatCompactCurrency(
  value: number,
  options: { locale: string; currency: SupportedCurrency; maximumFractionDigits?: number }
): string {
  const { locale, currency, maximumFractionDigits } = options;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: maximumFractionDigits ?? 1,
    }).format(value);
  } catch {
    const divisor = value >= 1e12 ? 1e12 : value >= 1e9 ? 1e9 : value >= 1e6 ? 1e6 : 1;
    const suffix = value >= 1e12 ? 'T' : value >= 1e9 ? 'B' : value >= 1e6 ? 'M' : '';
    const base = (value / divisor).toFixed(maximumFractionDigits ?? 1);
    return `${currency} ${base}${suffix}`;
  }
}


