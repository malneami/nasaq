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
} from 'lucide-react';

export function LifeAreaIcon({
  id,
  className,
}: {
  id?: string | null;
  className?: string;
}) {
  switch (id) {
    case 'stethoscope':
      return <Stethoscope className={className} />;
    case 'lightbulb':
      return <Lightbulb className={className} />;
    case 'home':
      return <Home className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'wallet':
      return <Wallet className={className} />;
    case 'book':
      return <Book className={className} />;
    case 'users':
      return <Users className={className} />;
    case 'briefcase':
      return <Briefcase className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}
