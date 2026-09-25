'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 28,
  md: 36,
  lg: 112,
} as const;

/** Path + focus-dot mark from the Nasaq brand platform. */
export function BrandMark({
  collapsed = false,
  size = 'md',
  showName = true,
  className,
}: {
  collapsed?: boolean;
  size?: keyof typeof sizes;
  showName?: boolean;
  className?: string;
}) {
  const t = useTranslations('app');
  const px = sizes[size];
  const nameVisible = showName && !collapsed;

  return (
    <div
      className={cn(
        'flex items-center gap-2.5',
        collapsed && 'justify-center',
        className,
      )}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden={!nameVisible}
        role={nameVisible ? 'img' : undefined}
        aria-label={nameVisible ? undefined : t('name')}
      >
        <title>{t('name')}</title>
        {/* Open path — direction */}
        <circle
          cx="32"
          cy="34"
          r="20"
          stroke="var(--navy)"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="88 12"
          strokeDashoffset="6"
        />
        {/* Focus orange — priority */}
        <circle cx="46" cy="14" r="5.5" fill="var(--accent)" />
      </svg>
      {nameVisible ? (
        <span className="truncate text-sm font-semibold tracking-tight text-primary">
          {t('name')}
        </span>
      ) : null}
    </div>
  );
}
