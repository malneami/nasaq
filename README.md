# Nasaq (نسق)

A decision-support system for work and life.

> The system remembers. AI organizes. The user decides.

This repository currently contains the **project foundation** plus the **Postgres schema and typed data layer**. Feature UI, domain logic, and AI calls come later.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth)
- Drizzle ORM (schema, migrations, typed queries)
- next-intl (`en` LTR, `ar` RTL)
- TanStack Query, Zod, React Hook Form

Regional defaults: **SAR**, **Asia/Riyadh**.

## Setup

Node.js **22+** is recommended. `@supabase/supabase-js` still runs on Node 20 with a deprecation warning.

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose this in the browser)
3. Open **Project Settings → Database** and copy the connection string → `DATABASE_URL`.
4. Under **Authentication → Providers**, keep **Email** enabled if you still want password sign-in.
5. Enable **Google** under **Authentication → Providers → Google**:
   1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 **Web application** client.
   2. Add authorized JavaScript origins: `http://localhost:3000` and your production origin.
   3. Add the authorized redirect URI from Supabase (shown on the Google provider screen), typically `https://<project-ref>.supabase.co/auth/v1/callback`.
   4. Paste the Google **Client ID** and **Client secret** into Supabase and save.
6. Under **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000` (or your production origin) and add these Redirect URLs:
   - `http://localhost:3000/api/auth/callback`
   - `http://localhost:3000/**`
   - your production equivalents
7. For a local single-user MVP, disable **Confirm email** under **Authentication → Providers → Email** so password accounts can sign in immediately after creating an account.

Auth users live in Supabase Auth (`auth.users`), including Google (Gmail) accounts. Application tables live in `public` and reference `auth.users(id)`.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Key | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for browser + server auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin/server jobs later) |
| `DATABASE_URL` | Postgres URI for Drizzle |
| `ANTHROPIC_API_KEY` | Placeholder for later AI features. Never call Anthropic from client code. |

### 4. Apply the database schema

```bash
npm run db:migrate
npm run db:seed -- <auth-user-uuid>
npm run db:studio
```

`db:migrate` creates all tables, enums, RLS policies, and the `seed_user_defaults(user_id)` function. `db:seed` inserts the 7 default life areas, default transaction categories, and a SAR Cash account for that user. It is idempotent.

The user id is the UUID from **Authentication → Users** in the Supabase dashboard (or the signed-in user's `id`).

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visits to app routes redirect to `/login`. After sign-in you land on **Today**.

### Scripts

```bash
npm run dev          # development server
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run format       # Prettier
npm run db:generate  # generate Drizzle SQL from schema
npm run db:migrate   # apply migrations
npm run db:seed -- <user_id>
npm run db:studio    # inspect tables
```

## Conventions

- Server Components by default; Client Components only for interactivity.
- All user-facing strings go through `src/messages/en.json` and `src/messages/ar.json`.
- Validate inputs with Zod. Do not use `any`.
- Store money as bigint minor units (halalas). Use `toMinor` / `toMajor` / `formatMoney` in `src/lib/money.ts`.
- Query helpers in `src/lib/db/queries` always take `userId` and never bypass that scope. Soft-deleted rows stay in the database (`deleted_at`).
- Inbox classification runs only on the server (`POST /api/inbox/classify`). Set `ANTHROPIC_API_KEY` in `.env.local`. The model never creates records; Accept does.
- External AI and banking APIs are called only from server route handlers — never from client code.

## Locales

| Locale | Direction | URL prefix |
| --- | --- | --- |
| English | LTR | `/en/...` |
| Arabic | RTL | `/ar/...` |

The language switcher in the top bar changes copy and document direction together.
