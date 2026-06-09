import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const VALOR_KEY = "valor_acumulado";

router.get("/valor-acumulado", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, VALOR_KEY))
      .limit(1);

    const valor = rows[0]?.value ?? "0";
    res.json({ valor });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar valor acumulado" });
  }
});

router.post("/valor-acumulado", async (req, res) => {
  try {
    const { valor } = req.body as { valor: string };
    if (!valor || isNaN(Number(valor.replace(",", ".")))) {
      return res.status(400).json({ error: "Valor inválido" });
    }

    await db
      .insert(settingsTable)
      .values({ key: VALOR_KEY, value: valor })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value: valor, updatedAt: new Date() },
      });

    res.json({ ok: true, valor });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar valor acumulado" });
  }
});

export default router;
