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
  const upper = (symbol || "?").toUpperCase();
  const remoteSrc = `/api/logo?symbol=${encodeURIComponent(upper)}`;
  const fallbackSrc = "/stock-placeholder.svg";

  if (hasError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fallbackSrc}
        alt={name || upper}
        width={size}
        height={size}
        loading="lazy"
        className={clsx("rounded-full object-cover border border-border bg-muted", className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={remoteSrc}
      alt={name || upper}
      width={size}
      height={size}
      loading="lazy"
      className={clsx("rounded-full object-cover border border-border bg-muted", className)}
      onError={() => setHasError(true)}
    />
  );
}


