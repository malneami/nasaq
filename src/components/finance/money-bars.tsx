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
    <ul className={cn('space-y-2.5', className)}>
      {items.map((item, i) => {
        const width = Math.max(2, Math.round((item.value / peak) * 100));
        const bar = (
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="truncate text-foreground">{item.label}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="bento-bar-grow h-full rounded-full"
                style={{
                  width: `${width}%`,
                  background: 'linear-gradient(90deg, #9db497, #5a9a82)',
                  animationDelay: `${0.35 + i * 0.07}s`,
                }}
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
      {items.map((item, i) => {
        const height = Math.max(4, Math.round((item.value / peak) * 100));
        return (
          <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-20 w-full items-end justify-center">
              <div
                className="bento-bar-grow w-full max-w-[2.5rem] rounded-t-lg"
                style={{
                  height: `${height}%`,
                  background: 'linear-gradient(180deg, #9db497, #6f8c6d)',
                  animationDelay: `${0.35 + i * 0.07}s`,
                }}
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
