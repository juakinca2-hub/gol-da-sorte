import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function runMigrations() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      referral_code TEXT NOT NULL UNIQUE,
      referred_by_id INTEGER REFERENCES users(id),
      plays_remaining INTEGER NOT NULL DEFAULT 5,
      free_plays_total_used INTEGER NOT NULL DEFAULT 0,
      has_paid BOOLEAN NOT NULL DEFAULT false,
      paid_plays_used INTEGER NOT NULL DEFAULT 0,
      referral_unlocked BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cidade TEXT NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS foto_base64 TEXT`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ip_address TEXT`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS challenge_reward_granted BOOLEAN NOT NULL DEFAULT false`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_id INTEGER NOT NULL REFERENCES users(id),
      referred_id INTEGER NOT NULL REFERENCES users(id),
      rewarded BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}
