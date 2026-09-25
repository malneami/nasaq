import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

const messageLoaders = {
  en: () => import('../../messages/en.json'),
  ar: () => import('../../messages/ar.json'),
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await messageLoaders[locale]()).default;

  return {
    locale,
    messages,
    timeZone: 'Asia/Riyadh',
    formats: {
      number: {
        currency: {
          style: 'currency',
          currency: 'SAR',
        },
      },
    },
  };
});
