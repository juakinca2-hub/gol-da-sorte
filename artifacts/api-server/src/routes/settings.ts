import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function getSetting(key: string, fallback = ""): Promise<string> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? fallback;
}

async function setSetting(key: string, value: string) {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

router.get("/valor-acumulado", async (_req, res) => {
  try {
    const valor = await getSetting("valor_acumulado", "0");
    res.json({ valor });
  } catch {
    res.status(500).json({ error: "Erro ao buscar valor acumulado" });
  }
});

router.post("/valor-acumulado", async (req, res) => {
  try {
    const { valor } = req.body as { valor: string };
    if (!valor || isNaN(Number(valor.replace(",", ".")))) {
      return res.status(400).json({ error: "Valor inválido" });
    }
    await setSetting("valor_acumulado", valor);
    res.json({ ok: true, valor });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar valor acumulado" });
  }
});

router.get("/ultimo-ganhador", async (_req, res) => {
  try {
    const [nome, cidadeEstado, valor, foto] = await Promise.all([
      getSetting("ug_nome", ""),
      getSetting("ug_cidade_estado", ""),
      getSetting("ug_valor", ""),
      getSetting("ug_foto", ""),
    ]);
    res.json({ nome, cidadeEstado, valor, foto });
  } catch {
    res.status(500).json({ error: "Erro ao buscar último ganhador" });
  }
});

router.post("/ultimo-ganhador", async (req, res) => {
  try {
    const { nome, cidadeEstado, valor, foto } = req.body as {
      nome?: string; cidadeEstado?: string; valor?: string; foto?: string;
    };
    await Promise.all([
      nome !== undefined ? setSetting("ug_nome", nome) : Promise.resolve(),
      cidadeEstado !== undefined ? setSetting("ug_cidade_estado", cidadeEstado) : Promise.resolve(),
      valor !== undefined ? setSetting("ug_valor", valor) : Promise.resolve(),
      foto !== undefined ? setSetting("ug_foto", foto) : Promise.resolve(),
    ]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar último ganhador" });
  }
});

// ── Broadcast message (public) ────────────────────────────────────────────────

router.get("/broadcast", async (_req, res) => {
  try {
    const [message, broadcastId] = await Promise.all([
      getSetting("broadcast_message", ""),
      getSetting("broadcast_id", ""),
    ]);
    res.json({ message, broadcastId });
  } catch {
    res.status(500).json({ error: "Erro ao buscar mensagem" });
  }
});

export default router;
