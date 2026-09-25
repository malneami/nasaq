<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Base44 dev environment

## Running

```bash
docker compose -f docker-compose.base44.yml up -d
```

Web (Next.js 16 dev, Turbopack) on host port 3000. `deps` installs node_modules into
a named volume once; `web` waits for it. Source is bind-mounted, so edits hot-reload.

## Secrets (external Supabase project)

Delivered via `/run/base44/app.env` (listed last in compose `env_file`, so it always wins).
Required for a functional app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`. `ANTHROPIC_API_KEY` is optional (AI features only).

The app degrades gracefully without Supabase env: unauthenticated routes redirect to
`/en/login`, which still renders.

## DATABASE_URL must be the Supabase pooler (IPv4), not the direct host

The sandbox is IPv4-only. Supabase's *direct* Postgres host
(`db.<ref>.supabase.co:5432`) is **IPv6-only** and is unreachable here. The connection
**pooler** (`aws-0-<region>.pooler.supabase.com`) is IPv4 and works.

`scripts/supabase-pooler-entrypoint.sh` rewrites a direct `DATABASE_URL` to the pooler at
runtime (host → `aws-0-<region>.pooler.supabase.com`, port → **5432** session mode,
username → `postgres.<ref>`). It leaves an already-pooler URL untouched. The region
defaults to `ap-southeast-2` (override with `BASE44_SUPABASE_POOLER_REGION`).

Use **port 5432 (session mode)**, not 6543 (transaction mode): `postgres.js`/drizzle use
prepared statements, which the transaction pooler doesn't support (migrations hang).

Migrations and seed must run through the entrypoint so they get the rewritten URL:
```bash
docker compose -f docker-compose.base44.yml exec -T web \
  sh /app/scripts/supabase-pooler-entrypoint.sh npm run db:migrate
docker compose -f docker-compose.base44.yml exec -T web \
  sh /app/scripts/supabase-pooler-entrypoint.sh npm run db:seed -- <auth-user-uuid>
```

## Server Actions CSRF (Next 16)

The preview proxy forwards a `Host`/`x-forwarded-host` that differs from the browser
`Origin`, so Next's Server Actions CSRF check rejects invocations with
"Invalid Server Actions request." The allowlist lives under `experimental` in Next 16
(NOT top-level `serverActions`):

```ts
experimental: { serverActions: { allowedOrigins: ['3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX] } }
```

`allowedDevOrigins` (top-level) covers dev assets/HMR but does NOT cover server actions.

## Verifying it works

- `curl localhost:3000/` → 307 to `/en`; `/en/today` → 307 to `/en/login` (no session).
- Sign in at `/en/login` with an existing Supabase user (email/password) → lands on Today.
- The seed (`seed_user_defaults(uuid)`) is idempotent; it creates 7 life areas, 17
  transaction categories, and a SAR Cash account for a user.
