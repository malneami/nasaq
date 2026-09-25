'use client';

import { useTranslations } from 'next-intl';
import { LifeAreaBadge } from '@/components/life-areas/life-area-badge';
import { cn } from '@/lib/utils';

export type LifeAreaOption = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  archivedAt?: string | null;
};

export function LifeAreaMultiSelect({
  areas,
  value,
  onChange,
  className,
}: {
  areas: LifeAreaOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const t = useTranslations('lifeAreas');
  const selected = new Set(value);
  const visible = areas.filter(
    (area) => !area.archivedAt || selected.has(area.id),
  );

  function toggle(id: string) {
    if (selected.has(id)) {
      onChange(value.filter((item) => item !== id));
      return;
    }
    onChange([...value, id]);
  }

  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="sr-only">{t('selectAreas')}</legend>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noneAvailable')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((area) => {
            const isOn = selected.has(area.id);
            return (
              <button
                key={area.id}
                type="button"
                disabled={Boolean(area.archivedAt)}
                onClick={() => toggle(area.id)}
                className={cn(
                  'rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  isOn ? 'ring-2 ring-ring/70' : 'opacity-70 hover:opacity-100',
                )}
                aria-pressed={isOn}
              >
                <LifeAreaBadge
                  name={area.name}
                  color={area.color}
                  icon={area.icon}
                  archived={Boolean(area.archivedAt)}
                />
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
