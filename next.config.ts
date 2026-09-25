import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const previewOrigin = ['3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX].filter(
  Boolean,
);

const nextConfig: NextConfig = {
  serverExternalPackages: ['postgres'],
  // Dev assets/HMR (hostname only, no scheme/port) — preview is cross-origin.
  allowedDevOrigins: previewOrigin,
  // Server Actions CSRF check: the proxy forwards a different Host than the
  // browser Origin, so allowlist the preview origin for action invocations.
  // In Next 16 this lives under `experimental`.
  experimental: { serverActions: { allowedOrigins: previewOrigin } },
};

export default withNextIntl(nextConfig);
