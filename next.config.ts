import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: ['postgres'],
  allowedDevOrigins: ['3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX].filter(
    Boolean,
  ),
};

export default withNextIntl(nextConfig);
