'use client';

import { cn } from '@/lib/utils';

export function MoneyBars({
  items,
  max,
  className,
}: {
  items: { key: string; label: string; value: number; href?: string }[];
  max?: number;
  className?: string;
}) {
  const peak = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn('space-y-2', className)}>
      {items.map((item) => {
        const width = Math.max(2, Math.round((item.value / peak) * 100));
        const bar = (
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex justify-between gap-2 text-xs">
              <span className="truncate text-foreground">{item.label}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80 transition-[width]"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
        return (
          <li key={item.key} className="flex items-center gap-2">
            {item.href ? (
              <a href={item.href} className="min-w-0 flex-1 hover:opacity-90">
                {bar}
              </a>
            ) : (
              bar
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function TrendBars({
  items,
}: {
  items: { key: string; label: string; value: number }[];
}) {
  const peak = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-28 items-end gap-2">
      {items.map((item) => {
        const height = Math.max(4, Math.round((item.value / peak) * 100));
        return (
          <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-20 w-full items-end justify-center">
              <div
                className="w-full max-w-[2.5rem] rounded-t-md bg-accent/80"
                style={{ height: `${height}%` }}
                title={String(item.value)}
              />
            </div>
            <span className="truncate text-[10px] text-muted-foreground">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
