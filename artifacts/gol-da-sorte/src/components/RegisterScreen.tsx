import { useState } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\//, "") 
  ? `/${import.meta.env.BASE_URL.replace(/^\/|\/$/g, "")}/api`
  : "/api";

function getApiUrl(path: string) {
  return `${window.location.origin}${API_BASE}${path}`;
}

interface Props {
  referralCode?: string;
  onRegistered: (userId: number) => void;
}

export default function RegisterScreen({ referralCode, onRegistered }: Props) {
  const [mode, setMode] = useState<"choice" | "register" | "login">("choice");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  };

  const handleRegister = async () => {
    if (!name.trim() || phone.replace(/\D/g, "").length < 10) {
      setError("Preencha nome e telefone completo.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(getApiUrl("/users/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.replace(/\D/g, ""),
          referralCode: referralCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao cadastrar.");
        return;
      }
      localStorage.setItem("golUserId", String(data.user.id));
      onRegistered(data.user.id);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Digite seu telefone completo.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(getApiUrl(`/users/by-phone/${phone.replace(/\D/g, "")}`));
      const data = await res.json();
      if (!res.ok) {
        setError("Telefone não encontrado. Cadastre-se primeiro.");
        return;
      }
      localStorage.setItem("golUserId", String(data.user.id));
      onRegistered(data.user.id);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "linear-gradient(160deg, #0a0a0a 0%, #1a1200 60%, #0a0a0a 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", zIndex: 9999, padding: 24,
    }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>⚽</div>
        <div style={{ color: "#FFD700", fontSize: 28, fontWeight: 900, letterSpacing: 2, textShadow: "0 0 20px rgba(255,200,0,0.5)" }}>
          GOL DA SORTE
        </div>
        {referralCode && (
          <div style={{
            marginTop: 12, background: "rgba(255,200,0,0.15)", border: "1px solid rgba(255,200,0,0.4)",
            borderRadius: 10, padding: "8px 16px", color: "#FFD700", fontSize: 13,
          }}>
            🎁 Você ganhou <strong>5 jogadas grátis</strong>!
          </div>
        )}
      </div>

      {mode === "choice" && (
        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={() => setMode("register")}
            style={{
              background: "linear-gradient(135deg, #FFD700, #FF8C00)",
              color: "#000", border: "none", borderRadius: 12, padding: "16px",
              fontSize: 16, fontWeight: 900, cursor: "pointer", letterSpacing: 1,
            }}
          >
            CRIAR CONTA
          </button>
          <button
            onClick={() => setMode("login")}
            style={{
              background: "transparent", color: "#FFD700",
              border: "2px solid rgba(255,200,0,0.5)", borderRadius: 12, padding: "14px",
              fontSize: 16, fontWeight: 700, cursor: "pointer",
            }}
          >
            JÁ TENHO CONTA
          </button>
        </div>
      )}

      {(mode === "register" || mode === "login") && (
        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <div>
              <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>SEU NOME</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: João Silva"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,200,0,0.3)",
                  borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 15,
                  outline: "none",
                }}
              />
            </div>
          )}
          <div>
            <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>TELEFONE (WHATSAPP)</label>
            <input
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,200,0,0.3)",
                borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 15,
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{ color: "#ff6060", fontSize: 13, textAlign: "center" }}>{error}</div>
          )}

          <button
            onClick={mode === "register" ? handleRegister : handleLogin}
            disabled={loading}
            style={{
              background: loading ? "#444" : "linear-gradient(135deg, #FFD700, #FF8C00)",
              color: "#000", border: "none", borderRadius: 12, padding: "16px",
              fontSize: 16, fontWeight: 900, cursor: loading ? "default" : "pointer", marginTop: 4,
            }}
          >
            {loading ? "AGUARDE..." : mode === "register" ? "CADASTRAR E JOGAR" : "ENTRAR"}
          </button>

          <button
            onClick={() => { setMode("choice"); setError(""); }}
            style={{
              background: "transparent", color: "#888", border: "none",
              fontSize: 13, cursor: "pointer", padding: 8,
            }}
          >
            ← Voltar
          </button>
        </div>
      )}
    </div>
  );
}
