import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';

export function TodaySection({
  title,
  href,
  hrefLabel,
  children,
  className,
}: {
  title: string;
  href?: '/calendar' | '/people' | '/finance' | '/projects';
  hrefLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {href && hrefLabel ? (
          <Link
            href={href}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {hrefLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function TodaySkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bento-card space-y-2 p-4">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded-md bg-muted"
          style={{ width: `${88 - index * 12}%` }}
        />
      ))}
    </div>
  );
}
