import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  cidade: text("cidade").notNull().default(""),
  estado: text("estado").notNull().default(""),
  fotoBase64: text("foto_base64"),
  ipAddress: text("ip_address"),
  referralCode: text("referral_code").notNull().unique(),
  referredById: integer("referred_by_id"),
  playsRemaining: integer("plays_remaining").notNull().default(5),
  freePlaysTotalUsed: integer("free_plays_total_used").notNull().default(0),
  hasPaid: boolean("has_paid").notNull().default(false),
  paidPlaysUsed: integer("paid_plays_used").notNull().default(0),
  referralUnlocked: boolean("referral_unlocked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  referralCode: true,
  playsRemaining: true,
  freePlaysTotalUsed: true,
  hasPaid: true,
  paidPlaysUsed: true,
  referralUnlocked: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
