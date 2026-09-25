import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const previewOrigin = ['3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX].filter(
  Boolean,
);

// The preview proxy forwards requests with the sandbox host (which differs
// from the browser Origin). Some _next dev-asset requests arrive without a
// Referer, so we also allowlist the sandbox host domain wildcard to avoid
// 403s from Next's blockCrossSiteDEV check.
const sandboxWildcard = process.env.BASE44_SANDBOX_HOST_DOMAIN
  ? ['**.' + process.env.BASE44_SANDBOX_HOST_DOMAIN]
  : [];

const nextConfig: NextConfig = {
  serverExternalPackages: ['postgres'],
  // Dev assets/HMR (hostname only, no scheme/port) — preview is cross-origin.
  allowedDevOrigins: [...previewOrigin, ...sandboxWildcard],
  // Server Actions CSRF check: the proxy forwards a different Host than the
  // browser Origin, so allowlist the preview origin for action invocations.
  // In Next 16 this lives under `experimental`.
  experimental: { serverActions: { allowedOrigins: previewOrigin } },
};

export default withNextIntl(nextConfig);
