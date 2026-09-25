import {
  Book,
  Briefcase,
  Heart,
  Home,
  Lightbulb,
  Sparkles,
  Stethoscope,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export const LIFE_AREA_ICON_OPTIONS = [
  { id: 'stethoscope', Icon: Stethoscope },
  { id: 'lightbulb', Icon: Lightbulb },
  { id: 'home', Icon: Home },
  { id: 'heart', Icon: Heart },
  { id: 'wallet', Icon: Wallet },
  { id: 'book', Icon: Book },
  { id: 'users', Icon: Users },
  { id: 'briefcase', Icon: Briefcase },
  { id: 'sparkles', Icon: Sparkles },
] as const;

export type LifeAreaIconId = (typeof LIFE_AREA_ICON_OPTIONS)[number]['id'];

export const LIFE_AREA_COLOR_OPTIONS = [
  '#1A3480',
  '#E8A01C',
  '#0F766E',
  '#7C3AED',
  '#BE123C',
  '#0369A1',
  '#B45309',
  '#365314',
] as const;

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  LIFE_AREA_ICON_OPTIONS.map((option) => [option.id, option.Icon]),
);

export function getLifeAreaIcon(id: string | null | undefined): LucideIcon {
  if (!id) {
    return Sparkles;
  }
  return ICON_MAP[id] ?? Sparkles;
}
