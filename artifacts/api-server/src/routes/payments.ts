import { Router } from "express";
import { db, paymentsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";

const router = Router();

const PIX_KEY  = process.env.PIX_KEY  ?? "";
const PIX_NAME = (process.env.PIX_NAME ?? "Gol da Sorte").slice(0, 25);
const PIX_CITY = (process.env.PIX_CITY ?? "Brasil").slice(0, 15);

const PACKAGES: Record<number, number> = { 5: 500, 15: 1000, 30: 2000 };

// ── PIX EMV payload (BACEN spec) ──────────────────────────────────────────────

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ((crc & 0xffff).toString(16).toUpperCase().padStart(4, "0"));
}

function buildPixPayload(key: string, name: string, city: string, amountCents: number, txId: string): string {
  const amount = (amountCents / 100).toFixed(2);
  const gui   = tlv("00", "BR.GOV.BCB.PIX");
  const pixK  = tlv("01", key);
  const merchant = tlv("26", gui + pixK);
  const refLabel = tlv("05", txId.slice(0, 25));
  const additional = tlv("62", refLabel);

  const body =
    tlv("00", "01") +
    merchant +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount) +
    tlv("58", "BR") +
    tlv("59", name) +
    tlv("60", city) +
    additional +
    "6304";

  return body + crc16(body);
}

// ── Create pending payment + return QR code ───────────────────────────────────

router.post("/create", async (req, res) => {
  const { userId, plays } = req.body as { userId: number; plays: number };

  const amountCents = PACKAGES[plays];
  if (!amountCents) {
    res.status(400).json({ error: "Pacote inválido." });
    return;
  }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  if (!PIX_KEY) {
    res.status(503).json({ error: "Chave PIX não configurada. Fale com o administrador." });
    return;
  }

  const txId = `GOL${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  await db.insert(paymentsTable).values({
    userId,
    plays,
    amountCents,
    txId,
    status: "pending",
  });

  const payload = buildPixPayload(PIX_KEY, PIX_NAME, PIX_CITY, amountCents, txId);
  const qrDataUrl = await QRCode.toDataURL(payload, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  res.json({
    txId,
    pixKey: PIX_KEY,
    pixName: PIX_NAME,
    amount: (amountCents / 100).toFixed(2),
    plays,
    pixPayload: payload,
    qrCode: qrDataUrl,
  });
});

// ── Poll payment status ───────────────────────────────────────────────────────

router.get("/:txId/status", async (req, res) => {
  const { txId } = req.params;
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.txId, txId));
  if (!payment) {
    res.status(404).json({ error: "Pagamento não encontrado." });
    return;
  }
  res.json({ status: payment.status, plays: payment.plays });
});

// ── Generic webhook — any PIX gateway can POST here ──────────────────────────
// Expected body: { txId, status: "confirmed" }  OR  { referenceLabel, status }

router.post("/webhook", async (req, res) => {
  const body = req.body as Record<string, string>;
  const txId = body.txId || body.referenceLabel || body.reference || body.endToEndId;
  if (!txId) {
    res.status(400).json({ error: "txId não encontrado no webhook." });
    return;
  }
  await confirmPayment(txId);
  res.json({ ok: true });
});

// ── Admin manual confirmation ─────────────────────────────────────────────────

router.post("/admin/confirm/:txId", async (req, res) => {
  const { txId } = req.params;
  const result = await confirmPayment(txId);
  if (!result) {
    res.status(404).json({ error: "Pagamento não encontrado ou já confirmado." });
    return;
  }
  res.json({ ok: true, playsAdded: result.plays });
});

// ── Shared confirm logic ──────────────────────────────────────────────────────

async function confirmPayment(txId: string) {
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.txId, txId));
  if (!payment || payment.status !== "pending") return null;

  await db.update(paymentsTable)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(paymentsTable.txId, txId));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId));
  if (user) {
    await db.update(usersTable)
      .set({ playsRemaining: user.playsRemaining + payment.plays, hasPaid: true })
      .where(eq(usersTable.id, payment.userId));
  }
  return payment;
}

export default router;
