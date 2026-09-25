import { cn } from '@/lib/utils';
import { LifeAreaIcon } from '@/components/life-areas/life-area-icon';

export function LifeAreaBadge({
  name,
  color,
  icon,
  archived = false,
  className,
}: {
  name: string;
  color?: string | null;
  icon?: string | null;
  archived?: boolean;
  className?: string;
}) {
  const tone = color || '#1A3480';

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        archived && 'opacity-60',
        className,
      )}
      style={{
        borderColor: `${tone}55`,
        backgroundColor: `${tone}18`,
        color: tone,
      }}
    >
      <LifeAreaIcon id={icon} className="size-3 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}
