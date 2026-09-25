import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
config({ path: '.env' });

async function seed(userId: string) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set.');
  }

  const client = postgres(url, { max: 1 });

  try {
    await client`select public.seed_user_defaults(${userId}::uuid)`;
    console.log(`Seeded defaults for user ${userId}`);
  } finally {
    await client.end();
  }
}

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: npm run db:seed -- <user_id>');
  process.exit(1);
}

seed(userId).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
