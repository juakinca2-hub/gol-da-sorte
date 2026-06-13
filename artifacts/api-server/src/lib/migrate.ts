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
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_id INTEGER NOT NULL REFERENCES users(id),
      referred_id INTEGER NOT NULL REFERENCES users(id),
      rewarded BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    INSERT INTO settings (key, value)
    VALUES ('valor_acumulado', '3632.00')
    ON CONFLICT (key) DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO settings (key, value) VALUES ('ug_nome', '')        ON CONFLICT (key) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO settings (key, value) VALUES ('ug_cidade_estado', '') ON CONFLICT (key) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO settings (key, value) VALUES ('ug_valor', '')       ON CONFLICT (key) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO settings (key, value) VALUES ('ug_foto', '')        ON CONFLICT (key) DO NOTHING
  `);

  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS saldo INTEGER NOT NULL DEFAULT 0`);

  await db.execute(sql`INSERT INTO settings (key, value) VALUES ('premiacao_ativa', 'true')     ON CONFLICT (key) DO NOTHING`);
  await db.execute(sql`INSERT INTO settings (key, value) VALUES ('bonus_row3', '1')              ON CONFLICT (key) DO NOTHING`);
  await db.execute(sql`INSERT INTO settings (key, value) VALUES ('bonus_row4', '5')              ON CONFLICT (key) DO NOTHING`);
  await db.execute(sql`INSERT INTO settings (key, value) VALUES ('bonus_row5', '15')             ON CONFLICT (key) DO NOTHING`);
  await db.execute(sql`INSERT INTO settings (key, value) VALUES ('whatsapp_atendimento', '')     ON CONFLICT (key) DO NOTHING`);
  await db.execute(sql`INSERT INTO settings (key, value) VALUES ('valor_pago_premios', '0')      ON CONFLICT (key) DO NOTHING`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plays INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      tx_id TEXT NOT NULL UNIQUE,
      mp_payment_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      confirmed_at TIMESTAMP
    )
  `);
}
