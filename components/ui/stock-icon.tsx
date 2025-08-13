"use client";

import { useState } from "react";
import clsx from "clsx";

type StockIconProps = {
  symbol: string;
  name?: string;
  size?: number;
  className?: string;
};

export function StockIcon({ symbol, name, size = 24, className }: StockIconProps) {
  const [hasError, setHasError] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const upper = (symbol || "?").toUpperCase();

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || '';
  const candidates: string[] = Array.from(
    new Set([
      `${apiBase}/api/logo?symbol=${encodeURIComponent(upper)}`,
      `${apiBase}/api/logo?symbol=${encodeURIComponent(upper.replaceAll('.', '-'))}`,
      `${apiBase}/api/logo?symbol=${encodeURIComponent(upper.split('.')[0])}`,
      `${apiBase}/api/logo?symbol=${encodeURIComponent(upper.split('-')[0])}`,
    ])
  );

  const currentSrc = candidates[Math.min(sourceIndex, candidates.length - 1)];

  if (hasError || sourceIndex >= candidates.length) {
    const initials = upper.replace(/[^A-Z]/g, '').slice(0, 3) || upper.slice(0, 2);
    return (
      <div
        style={{ width: size, height: size }}
        className={clsx(
          "rounded-full border border-border bg-muted text-foreground/80 flex items-center justify-center font-semibold",
          className
        )}
        aria-label={name || upper}
        title={name || upper}
      >
        <span style={{ fontSize: Math.max(10, Math.floor(size * 0.4)) }}>{initials}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={name || upper}
      width={size}
      height={size}
      loading="lazy"
      className={clsx("rounded-full object-cover border border-border bg-muted", className)}
      onError={() => {
        if (sourceIndex < candidates.length - 1) {
          setSourceIndex(sourceIndex + 1);
        } else {
          setHasError(true);
        }
      }}
    />
  );
}


