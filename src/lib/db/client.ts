import 'server-only';

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  postgres?: ReturnType<typeof postgres>;
  db?: Database;
};

export function getDb(): Database {
  const url = process.env.DATABASE_URL;

  if (!url || url.includes('[YOUR-PASSWORD]') || url.includes('your-project')) {
    throw new Error(
      'DATABASE_URL is missing or still a placeholder. Copy the Postgres URI from Supabase → Project Settings → Database into .env.local.',
    );
  }

  try {
    // Validate early — postgres() otherwise throws opaque "Invalid URL".
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    throw new Error(
      'DATABASE_URL is not a valid Postgres URI. Use the connection string from Supabase → Database.',
    );
  }

  if (!globalForDb.postgres) {
    globalForDb.postgres = postgres(url, { max: 1 });
  }

  if (!globalForDb.db) {
    globalForDb.db = drizzle(globalForDb.postgres, { schema });
  }

  return globalForDb.db;
}

export type { Database };
export { schema };
