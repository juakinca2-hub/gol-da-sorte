import { Router } from "express";
import { db, usersTable, referralsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function generateReferralCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function uniqueReferralCode(): Promise<string> {
  let code: string;
  let exists = true;
  do {
    code = generateReferralCode();
    const [row] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, code));
    exists = !!row;
  } while (exists);
  return code;
}

router.post("/register", async (req, res) => {
  const { name, phone, referralCode } = req.body as { name: string; phone: string; referralCode?: string };

  if (!name || !phone) {
    res.status(400).json({ error: "name e phone são obrigatórios" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (existing.length > 0) {
    res.status(409).json({ error: "Telefone já cadastrado" });
    return;
  }

  let referredById: number | null = null;
  if (referralCode) {
    const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode.toUpperCase()));
    if (referrer) {
      referredById = referrer.id;
    }
  }

  const myCode = await uniqueReferralCode();

  const [user] = await db.insert(usersTable).values({
    name,
    phone,
    referralCode: myCode,
    referredById: referredById ?? undefined,
    playsRemaining: 5,
  }).returning();

  if (referredById) {
    await db.insert(referralsTable).values({
      referrerId: referredById,
      referredId: user.id,
      rewarded: false,
    });
  }

  res.json({ user });
});

router.get("/by-phone/:phone", async (req, res) => {
  const { phone } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json({ user });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json({ user });
});

router.post("/:id/use-play", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));

  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  if (user.playsRemaining <= 0) {
    res.status(400).json({ error: "Sem jogadas disponíveis" });
    return;
  }

  const newRemaining = user.playsRemaining - 1;
  const newFreeUsed = user.hasPaid ? user.freePlaysTotalUsed : user.freePlaysTotalUsed + 1;
  const newPaidUsed = user.hasPaid ? user.paidPlaysUsed + 1 : user.paidPlaysUsed;

  let newReferralUnlocked = user.referralUnlocked;
  if (user.hasPaid && newPaidUsed >= 5 && !user.referralUnlocked) {
    newReferralUnlocked = true;
  }

  const [updated] = await db.update(usersTable).set({
    playsRemaining: newRemaining,
    freePlaysTotalUsed: newFreeUsed,
    paidPlaysUsed: newPaidUsed,
    referralUnlocked: newReferralUnlocked,
  }).where(eq(usersTable.id, id)).returning();

  res.json({ user: updated });
});

router.post("/:id/purchase", async (req, res) => {
  const id = parseInt(req.params.id);
  const { plays } = req.body as { plays: number };

  if (![5, 15, 30].includes(plays)) {
    res.status(400).json({ error: "Pacote inválido. Use 5, 15 ou 30 jogadas." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const wasFirstPurchase = !user.hasPaid;

  const [updated] = await db.update(usersTable).set({
    playsRemaining: user.playsRemaining + plays,
    hasPaid: true,
  }).where(eq(usersTable.id, id)).returning();

  if (wasFirstPurchase && user.referredById) {
    const [referral] = await db.select().from(referralsTable).where(
      and(
        eq(referralsTable.referrerId, user.referredById),
        eq(referralsTable.referredId, id),
        eq(referralsTable.rewarded, false)
      )
    );

    if (referral) {
      await db.update(referralsTable).set({ rewarded: true }).where(eq(referralsTable.id, referral.id));

      const [referrer] = await db.select().from(usersTable).where(eq(usersTable.id, user.referredById));
      if (referrer) {
        await db.update(usersTable).set({
          playsRemaining: referrer.playsRemaining + 3,
        }).where(eq(usersTable.id, user.referredById));
      }
    }
  }

  res.json({ user: updated, wasFirstPurchase });
});

router.post("/:id/credit-plays", async (req, res) => {
  const id = parseInt(req.params.id);
  const { amount } = req.body as { amount: number };
  if (!amount || amount < 1) {
    res.status(400).json({ error: "Quantidade inválida" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  const [updated] = await db.update(usersTable)
    .set({ playsRemaining: user.playsRemaining + amount })
    .where(eq(usersTable.id, id))
    .returning();
  res.json({ user: updated, bonusGranted: amount });
});

router.get("/:id/referral-info", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, id));
  const rewardedCount = referrals.filter(r => r.rewarded).length;
  const pendingCount = referrals.filter(r => !r.rewarded).length;

  res.json({
    referralCode: user.referralCode,
    referralUnlocked: user.referralUnlocked,
    totalFriends: referrals.length,
    rewardedFriends: rewardedCount,
    pendingFriends: pendingCount,
    totalBonusPlays: rewardedCount * 3,
  });
});

export default router;
