#!/bin/sh
set -e

# Base44 dev entrypoint.
#
# This sandbox is IPv4-only, but Supabase's *direct* Postgres host
# (db.<ref>.supabase.co:5432) is IPv6-only and unreachable here. Supabase's
# connection pooler (aws-0-<region>.pooler.supabase.com:6543) is IPv4 and works.
#
# If DATABASE_URL points at the direct host, rewrite it to the pooler at runtime.
# The database password stays inside the URL untouched — we never log it.
# If DATABASE_URL is already a pooler (or any other) URL, it is left as-is.
#
# Region is this project's Supabase pooler region (detected during setup).
export SUPABASE_POOLER_REGION="${BASE44_SUPABASE_POOLER_REGION:-ap-southeast-2}"

if [ -n "$DATABASE_URL" ]; then
  REWRITTEN=$(node -e '
    const u = new URL(process.env.DATABASE_URL);
    const m = u.hostname.match(/^db\.([^.]+)\.supabase\.co$/);
    if (m) {
      const ref = m[1];
      u.hostname = "aws-0-" + process.env.SUPABASE_POOLER_REGION + ".pooler.supabase.com";
      u.port = "5432";
      u.username = "postgres." + ref;
    }
    process.stdout.write(u.toString());
  ')
  export DATABASE_URL="$REWRITTEN"
fi

exec "$@"
