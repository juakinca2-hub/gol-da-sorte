import { useState, useRef } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\//, "")
  ? `/${import.meta.env.BASE_URL.replace(/^\/|\/$/g, "")}/api`
  : "/api";

function getApiUrl(path: string) {
  return `${window.location.origin}${API_BASE}${path}`;
}

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

interface Props {
  referralCode?: string;
  onRegistered: (userId: number) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.07)",
  border: "1.5px solid rgba(255,200,0,0.3)",
  borderRadius: 10,
  padding: "12px 14px",
  color: "#fff",
  fontSize: 15,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  color: "#aaa",
  fontSize: 11,
  display: "block",
  marginBottom: 5,
  letterSpacing: 0.5,
};

export default function RegisterScreen({ referralCode, onRegistered }: Props) {
  const [mode, setMode] = useState<"choice" | "register" | "login">("choice");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneConfirm, setPhoneConfirm] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setFotoPreview(result);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 300;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setFotoBase64(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleRegister = async () => {
    setError("");
    if (!name.trim()) { setError("Informe seu nome."); return; }
    if (phone.replace(/\D/g, "").length < 10) { setError("Telefone incompleto."); return; }
    if (phone !== phoneConfirm) { setError("Os telefones não conferem."); return; }
    if (!cidade.trim()) { setError("Informe sua cidade."); return; }
    if (!estado) { setError("Selecione seu estado."); return; }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/users/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.replace(/\D/g, ""),
          cidade: cidade.trim(),
          estado,
          fotoBase64: fotoBase64 || undefined,
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
      justifyContent: "flex-start", zIndex: 9999,
      overflowY: "auto", padding: "24px 24px 40px",
    }}>
      <div style={{ marginBottom: 24, textAlign: "center", marginTop: 16 }}>
        <div style={{ fontSize: 46, marginBottom: 6 }}>⚽</div>
        <div style={{ color: "#FFD700", fontSize: 26, fontWeight: 900, letterSpacing: 2, textShadow: "0 0 20px rgba(255,200,0,0.5)" }}>
          GOL DA SORTE
        </div>
        {referralCode && (
          <div style={{
            marginTop: 10, background: "rgba(255,200,0,0.15)", border: "1px solid rgba(255,200,0,0.4)",
            borderRadius: 10, padding: "7px 14px", color: "#FFD700", fontSize: 13,
          }}>
            🎁 Você ganhou <strong>5 jogadas grátis</strong>!
          </div>
        )}
      </div>

      {mode === "choice" && (
        <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
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

      {mode === "register" && (
        <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* FOTO */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 90, height: 90, borderRadius: "50%",
                background: fotoPreview ? "transparent" : "rgba(255,255,255,0.07)",
                border: "2px dashed rgba(255,200,0,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", overflow: "hidden", position: "relative",
              }}
            >
              {fotoPreview
                ? <img src={fotoPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 32 }}>📷</span>
              }
            </div>
            <span style={{ color: "#888", fontSize: 12 }}>Toque para adicionar sua foto</span>
            <input ref={fileInputRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={handleFotoChange} />
          </div>

          {/* NOME */}
          <div>
            <label style={labelStyle}>SEU NOME COMPLETO</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: João Silva"
              style={inputStyle}
            />
          </div>

          {/* TELEFONE */}
          <div>
            <label style={labelStyle}>TELEFONE (WHATSAPP)</label>
            <input
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              style={inputStyle}
            />
          </div>

          {/* CONFIRMAÇÃO DO TELEFONE */}
          <div>
            <label style={labelStyle}>CONFIRME O TELEFONE</label>
            <input
              value={phoneConfirm}
              onChange={e => setPhoneConfirm(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              style={{
                ...inputStyle,
                borderColor: phoneConfirm && phone !== phoneConfirm
                  ? "rgba(255,80,80,0.7)"
                  : phoneConfirm && phone === phoneConfirm
                  ? "rgba(80,255,80,0.7)"
                  : "rgba(255,200,0,0.3)",
              }}
            />
            {phoneConfirm && phone !== phoneConfirm && (
              <span style={{ color: "#ff6060", fontSize: 11, marginTop: 3, display: "block" }}>Telefones não conferem</span>
            )}
            {phoneConfirm && phone === phoneConfirm && (
              <span style={{ color: "#80ff80", fontSize: 11, marginTop: 3, display: "block" }}>✓ Telefones conferem</span>
            )}
          </div>

          {/* CIDADE + ESTADO */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>CIDADE</label>
              <input
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                placeholder="Ex: São Paulo"
                style={inputStyle}
              />
            </div>
            <div style={{ width: 90 }}>
              <label style={labelStyle}>ESTADO</label>
              <select
                value={estado}
                onChange={e => setEstado(e.target.value)}
                style={{
                  ...inputStyle,
                  padding: "12px 8px",
                  appearance: "none",
                  WebkitAppearance: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">UF</option>
                {ESTADOS_BR.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div style={{ color: "#ff6060", fontSize: 13, textAlign: "center", padding: "8px", background: "rgba(255,0,0,0.08)", borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={loading}
            style={{
              background: loading ? "#444" : "linear-gradient(135deg, #FFD700, #FF8C00)",
              color: "#000", border: "none", borderRadius: 12, padding: "16px",
              fontSize: 16, fontWeight: 900, cursor: loading ? "default" : "pointer", marginTop: 4,
            }}
          >
            {loading ? "AGUARDE..." : "CADASTRAR E JOGAR"}
          </button>

          <button
            onClick={() => { setMode("choice"); setError(""); }}
            style={{ background: "transparent", color: "#888", border: "none", fontSize: 13, cursor: "pointer", padding: 8 }}
          >
            ← Voltar
          </button>
        </div>
      )}

      {mode === "login" && (
        <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>SEU TELEFONE CADASTRADO</label>
            <input
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ color: "#ff6060", fontSize: 13, textAlign: "center", padding: "8px", background: "rgba(255,0,0,0.08)", borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              background: loading ? "#444" : "linear-gradient(135deg, #FFD700, #FF8C00)",
              color: "#000", border: "none", borderRadius: 12, padding: "16px",
              fontSize: 16, fontWeight: 900, cursor: loading ? "default" : "pointer", marginTop: 4,
            }}
          >
            {loading ? "AGUARDE..." : "ENTRAR"}
          </button>

          <button
            onClick={() => { setMode("choice"); setError(""); }}
            style={{ background: "transparent", color: "#888", border: "none", fontSize: 13, cursor: "pointer", padding: 8 }}
          >
            ← Voltar
          </button>
        </div>
      )}
    </div>
  );
}
