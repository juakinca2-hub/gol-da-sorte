import { Router, Request } from "express";
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

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ip.trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

router.post("/register", async (req, res) => {
  const { name, phone, cidade, estado, fotoBase64, referralCode } = req.body as {
    name: string;
    phone: string;
    cidade: string;
    estado: string;
    fotoBase64?: string;
    referralCode?: string;
  };

  if (!name || !phone || !cidade || !estado) {
    res.status(400).json({ error: "Nome, telefone, cidade e estado são obrigatórios." });
    return;
  }

  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    res.status(400).json({ error: "Telefone inválido." });
    return;
  }

  const existingPhone = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, cleanPhone));
  if (existingPhone.length > 0) {
    res.status(409).json({ error: "Este telefone já está cadastrado. Use 'Já tenho conta'." });
    return;
  }

  const clientIp = getClientIp(req);
  if (clientIp !== "unknown") {
    const existingIp = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.ipAddress, clientIp));
    if (existingIp.length > 0) {
      res.status(409).json({ error: "Já existe um cadastro neste aparelho. Use 'Já tenho conta'." });
      return;
    }
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
    phone: cleanPhone,
    cidade,
    estado: estado.toUpperCase(),
    fotoBase64: fotoBase64 || null,
    ipAddress: clientIp,
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
        let bonusPlays = 3;
        let challengeGranted = false;

        // Check if referrer just completed the 30-friends-in-30-days challenge
        if (!referrer.challengeRewardGranted) {
          const thirtyDaysAgo = new Date(referrer.createdAt);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() + 30);
          const now = new Date();

          if (now <= thirtyDaysAgo) {
            // Count total rewarded referrals (including this new one)
            const allRewarded = await db.select().from(referralsTable).where(
              and(eq(referralsTable.referrerId, referrer.id), eq(referralsTable.rewarded, true))
            );
            if (allRewarded.length >= 30) {
              bonusPlays += 100;
              challengeGranted = true;
            }
          }
        }

        await db.update(usersTable).set({
          playsRemaining: referrer.playsRemaining + bonusPlays,
          ...(challengeGranted ? { challengeRewardGranted: true } : {}),
        }).where(eq(usersTable.id, referrer.id));
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

router.get("/:id/challenge-info", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const CHALLENGE_GOAL = 30;
  const CHALLENGE_DAYS = 30;
  const CHALLENGE_REWARD = 100;

  const startDate = new Date(user.createdAt);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + CHALLENGE_DAYS);
  const now = new Date();

  const msRemaining = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const isWithinWindow = now <= endDate;

  const rewardedReferrals = await db.select().from(referralsTable).where(
    and(eq(referralsTable.referrerId, id), eq(referralsTable.rewarded, true))
  );
  const payingFriendsCount = rewardedReferrals.length;

  const challengeCompleted = user.challengeRewardGranted;
  const challengeExpired = !isWithinWindow && !challengeCompleted;
  const challengeActive = isWithinWindow && !challengeCompleted;

  res.json({
    payingFriendsCount,
    payingFriendsGoal: CHALLENGE_GOAL,
    rewardPlays: CHALLENGE_REWARD,
    daysRemaining,
    daysTotal: CHALLENGE_DAYS,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    challengeActive,
    challengeCompleted,
    challengeExpired,
  });
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
