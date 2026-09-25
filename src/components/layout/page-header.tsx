import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-8 flex items-start gap-3 border-b border-sand/80 pb-4',
        className,
      )}
    >
      <span className="nasaq-focus-dot mt-2" aria-hidden />
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
