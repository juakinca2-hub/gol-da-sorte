import { useState } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\//, "")
  ? `/${import.meta.env.BASE_URL.replace(/^\/|\/$/g, "")}/api`
  : "/api";

function getApiUrl(path: string) {
  return `${window.location.origin}${API_BASE}${path}`;
}

const PACKAGES = [
  { plays: 5, price: "R$ 5,00", label: "STARTER", highlight: false },
  { plays: 15, price: "R$ 10,00", label: "POPULAR", highlight: true },
  { plays: 30, price: "R$ 20,00", label: "PRO", highlight: false },
];

interface Props {
  userId: number;
  onPurchased: (newPlays: number) => void;
  onClose: () => void;
}

export default function PurchaseModal({ userId, onPurchased, onClose }: Props) {
  const [selected, setSelected] = useState<number>(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePurchase = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(getApiUrl(`/users/${userId}/purchase`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plays: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao processar compra.");
        return;
      }
      onPurchased(data.user.playsRemaining);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "linear-gradient(160deg, #111 0%, #1c1500 100%)",
        border: "1.5px solid rgba(255,200,0,0.3)",
        borderRadius: 20, padding: 28, width: "100%", maxWidth: 340,
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>⚽</div>
          <div style={{ color: "#FFD700", fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>
            SUAS JOGADAS ACABARAM!
          </div>
          <div style={{ color: "#888", fontSize: 13, marginTop: 6 }}>
            Escolha um pacote para continuar jogando
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {PACKAGES.map(pkg => (
            <div
              key={pkg.plays}
              onClick={() => setSelected(pkg.plays)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", borderRadius: 12, cursor: "pointer",
                border: selected === pkg.plays
                  ? "2px solid #FFD700"
                  : "1.5px solid rgba(255,255,255,0.1)",
                background: selected === pkg.plays
                  ? "rgba(255,200,0,0.12)"
                  : pkg.highlight ? "rgba(255,255,255,0.04)" : "transparent",
                position: "relative",
              }}
            >
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
                  {pkg.plays} jogadas
                </div>
                {pkg.highlight && (
                  <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 700 }}>MAIS POPULAR</div>
                )}
              </div>
              <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 17 }}>{pkg.price}</div>
              {selected === pkg.plays && (
                <div style={{
                  position: "absolute", right: -8, top: -8,
                  background: "#FFD700", color: "#000", borderRadius: "50%",
                  width: 20, height: 20, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 11, fontWeight: 900,
                }}>✓</div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ color: "#ff6060", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{error}</div>
        )}

        <button
          onClick={handlePurchase}
          disabled={loading}
          style={{
            width: "100%", background: loading ? "#444" : "linear-gradient(135deg, #FFD700, #FF8C00)",
            color: "#000", border: "none", borderRadius: 12, padding: "16px",
            fontSize: 16, fontWeight: 900, cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "PROCESSANDO..." : "COMPRAR AGORA"}
        </button>

        <button
          onClick={onClose}
          style={{
            width: "100%", background: "transparent", color: "#666",
            border: "none", fontSize: 13, cursor: "pointer", padding: "12px 0 0",
          }}
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
