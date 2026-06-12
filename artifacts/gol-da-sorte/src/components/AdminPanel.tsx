import React, { useState, useEffect, useCallback } from "react";

const BASE = "/api";

async function adminApi(path: string, opts?: RequestInit, token?: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
        ...(opts?.headers || {}),
      },
    });
    return await res.json();
  } catch {
    return null;
  }
}

const C = {
  bg: "#0a0a0f",
  card: "#13131a",
  border: "#2a2a3a",
  gold: "#FFD700",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#a855f7",
  text: "#e2e2e2",
  muted: "#666",
};

type Tab = "dashboard" | "users" | "config";

interface Stats {
  usuariosOnline: number;
  totalCadastrados: number;
  novosCadastrosHoje: number;
  totalJogadasGeral: number;
  valorArrecadadoHoje: string;
  valorArrecadadoMes: string;
  valorPagoPremios: string;
  valorAcumulado: string;
}

interface UserRow {
  id: number;
  name: string;
  phone: string;
  cidade: string;
  estado: string;
  fotoBase64?: string;
  ipAddress?: string;
  playsRemaining: number;
  freePlaysTotalUsed: number;
  paidPlaysUsed: number;
  hasPaid: boolean;
  referralUnlocked: boolean;
  bloqueado: boolean;
  ultimoLogin?: string;
  saldo: number;
  createdAt: string;
}

interface GameSettings {
  broadcast_message: string;
  broadcast_id: string;
  premiacao_ativa: string;
  bonus_row3: string;
  bonus_row4: string;
  bonus_row5: string;
  whatsapp_atendimento: string;
  valor_acumulado: string;
  valor_pago_premios: string;
  ug_nome: string;
  ug_cidade: string;
  ug_estado: string;
  ug_cidade_estado: string;
  ug_valor: string;
  ug_foto: string;
  promo_ativa: string;
  promo_titulo: string;
  promo_meta1_indicacoes: string;
  promo_meta1_jogadas: string;
  promo_meta2_indicacoes: string;
  promo_meta2_dias: string;
  promo_meta2_jogadas: string;
  promo_bonus_por_indicacao: string;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 14, ...style,
    }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <Card style={{ textAlign: "center" }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ color, fontWeight: 900, fontSize: 20, lineHeight: 1 }}>{value}</div>
      <div style={{ color: C.muted, fontSize: 10, marginTop: 4, lineHeight: 1.3 }}>{label}</div>
    </Card>
  );
}

function Btn({ label, color, onClick, small }: { label: string; color?: string; onClick: () => void; small?: boolean }) {
  return (
    <button onClick={onClick} style={{
      background: color || C.blue, border: "none", borderRadius: 8,
      color: "#fff", fontWeight: 700, fontSize: small ? 11 : 13,
      padding: small ? "6px 10px" : "10px 14px", cursor: "pointer", width: "100%",
    }}>{label}</button>
  );
}

function Input({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{label}</div>
      <input
        type={type || "text"}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", background: "#1a1a25",
          border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
          padding: "10px 12px", fontSize: 14, outline: "none",
        }}
      />
    </div>
  );
}

export default function AdminPanel({ onClose, skipAuth }: { onClose: () => void; skipAuth?: boolean }) {
  const [token, setToken] = useState(() => {
    if (skipAuth) return localStorage.getItem("adminToken") || "admin2025";
    return localStorage.getItem("adminToken") || "";
  });
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [settings, setSettings] = useState<Partial<GameSettings>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [playDelta, setPlayDelta] = useState("");
  const [saldoDelta, setSaldoDelta] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const isLoggedIn = !!token;

  // Salva token no localStorage quando acessa via ?admin=1
  useEffect(() => {
    if (skipAuth && token) localStorage.setItem("adminToken", token);
  }, [skipAuth, token]);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const login = async () => {
    const data = await adminApi("/admin/login", { method: "POST", body: JSON.stringify({ password }) });
    if (data?.token) {
      setToken(data.token);
      localStorage.setItem("adminToken", data.token);
      setLoginError("");
    } else {
      setLoginError("Senha incorreta!");
    }
  };

  const loadStats = useCallback(async () => {
    const data = await adminApi("/admin/stats", undefined, token);
    if (data && !data.error) setStats(data);
  }, [token]);

  const loadUsers = useCallback(async () => {
    const data = await adminApi(`/admin/users?search=${encodeURIComponent(search)}`, undefined, token);
    if (data?.users) setUsers(data.users);
  }, [token, search]);

  const loadSettings = useCallback(async () => {
    const data = await adminApi("/admin/settings", undefined, token);
    if (data?.settings) setSettings(data.settings);
  }, [token]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (tab === "dashboard") loadStats();
    if (tab === "users") loadUsers();
    if (tab === "config") loadSettings();
  }, [tab, isLoggedIn, loadStats, loadUsers, loadSettings]);

  useEffect(() => {
    if (tab === "users" && isLoggedIn) {
      const t = setTimeout(loadUsers, 300);
      return () => clearTimeout(t);
    }
  }, [search, tab, isLoggedIn, loadUsers]);

  const saveSettings = async (patch: Partial<GameSettings>) => {
    const merged = { ...patch };
    setLoading(true);
    const data = await adminApi("/admin/settings", { method: "POST", body: JSON.stringify(merged) }, token);
    setLoading(false);
    if (data?.ok) { showMsg("✅ Salvo!"); loadSettings(); } else showMsg("❌ Erro");
  };

  const doUserAction = async (action: string, body?: object) => {
    if (!selectedUser) return;
    setLoading(true);
    const data = await adminApi(`/admin/users/${selectedUser.id}/${action}`, {
      method: "POST", body: body ? JSON.stringify(body) : undefined,
    }, token);
    setLoading(false);
    if (data?.user || data?.ok) {
      showMsg("✅ Feito!");
      if (data.user) setSelectedUser(data.user);
      loadUsers();
    } else showMsg("❌ Erro");
  };

  if (!isLoggedIn) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: C.bg, zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 32,
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🛡️</div>
        <div style={{ color: C.gold, fontWeight: 900, fontSize: 22, marginBottom: 24 }}>PAINEL ADMIN</div>
        <div style={{ width: "100%", maxWidth: 340 }}>
          <Input label="Senha" value={password} onChange={setPassword} type="password" />
          {loginError && <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{loginError}</div>}
          <Btn label="ENTRAR" color={C.gold.replace("#", "#")} onClick={login} />
        </div>
        <button onClick={onClose} style={{
          marginTop: 20, background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer",
        }}>← Voltar ao jogo</button>
      </div>
    );
  }

  const logout = () => {
    setToken("");
    localStorage.removeItem("adminToken");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: C.bg, zIndex: 9999,
      display: "flex", flexDirection: "column", fontFamily: "'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>⚽</span>
          <span style={{ color: C.gold, fontWeight: 900, fontSize: 16 }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={logout} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 12, padding: "4px 10px", cursor: "pointer" }}>Sair</button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div style={{
          position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
          background: "#1a2a1a", border: `1px solid ${C.green}`, borderRadius: 8,
          padding: "8px 16px", color: C.green, fontWeight: 700, fontSize: 13, zIndex: 999,
        }}>{msg}</div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ color: C.gold, fontWeight: 700, marginBottom: 12, fontSize: 15 }}>📊 Dashboard</div>
            {stats ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <StatCard icon="🟢" label="Online Agora" value={stats.usuariosOnline} color={C.green} />
                <StatCard icon="👥" label="Total Cadastrados" value={stats.totalCadastrados} color={C.blue} />
                <StatCard icon="🆕" label="Novos Hoje" value={stats.novosCadastrosHoje} color={C.purple} />
                <StatCard icon="🎮" label="Jogadas Total" value={stats.totalJogadasGeral} color={C.gold} />
                <StatCard icon="💵" label="Arrecadado Hoje" value={`R$${stats.valorArrecadadoHoje}`} color={C.green} />
                <StatCard icon="📅" label="Arrecadado Mês" value={`R$${stats.valorArrecadadoMes}`} color={C.green} />
                <StatCard icon="🏆" label="Pago em Prêmios" value={`R$${stats.valorPagoPremios}`} color={C.red} />
                <StatCard icon="💰" label="Acumulado Atual" value={`R$${stats.valorAcumulado}`} color={C.gold} />
              </div>
            ) : (
              <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>Carregando...</div>
            )}
            <div style={{ marginTop: 14 }}>
              <Btn label="🔄 Atualizar" color="#1a2a3a" onClick={loadStats} />
            </div>
          </div>
        )}

        {/* ── USUÁRIOS ── */}
        {tab === "users" && !selectedUser && (
          <div>
            <div style={{ color: C.gold, fontWeight: 700, marginBottom: 12, fontSize: 15 }}>👥 Usuários</div>
            <input
              placeholder="🔍 Buscar por nome ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box", background: "#1a1a25",
                border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
                padding: "10px 12px", fontSize: 13, outline: "none", marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {users.map(u => (
                <Card key={u.id} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                  onClick={() => { setSelectedUser(u); setEditName(u.name); setEditPhone(u.phone); }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", background: "#1a1a30",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden", flexShrink: 0,
                  }}>
                    {u.fotoBase64
                      ? <img src={u.fotoBase64} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 18 }}>👤</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                      {u.name}
                      {u.bloqueado && <span style={{ fontSize: 10, color: C.red, background: "#2a0a0a", padding: "1px 5px", borderRadius: 4 }}>BLOQ</span>}
                    </div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{u.phone} · {u.cidade}-{u.estado}</div>
                    <div style={{ color: C.gold, fontSize: 11 }}>🎮 {u.playsRemaining} jogadas</div>
                  </div>
                  <span style={{ color: C.muted, fontSize: 18 }}>›</span>
                </Card>
              ))}
              {users.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 30 }}>Nenhum usuário encontrado</div>}
            </div>
          </div>
        )}

        {/* ── DETALHE DO USUÁRIO ── */}
        {tab === "users" && selectedUser && (
          <div>
            <button onClick={() => setSelectedUser(null)} style={{ background: "none", border: "none", color: C.gold, fontSize: 14, cursor: "pointer", marginBottom: 12, padding: 0 }}>
              ← Voltar
            </button>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#1a1a30", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selectedUser.fotoBase64
                    ? <img src={selectedUser.fotoBase64} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 28 }}>👤</span>}
                </div>
                <div>
                  <div style={{ color: C.text, fontWeight: 900, fontSize: 16 }}>{selectedUser.name}</div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{selectedUser.cidade}-{selectedUser.estado}</div>
                  {selectedUser.bloqueado && <span style={{ fontSize: 11, color: C.red }}>🔒 BLOQUEADO</span>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                {[
                  ["📱 Telefone", selectedUser.phone],
                  ["🌐 IP", selectedUser.ipAddress || "—"],
                  ["🎮 Jogadas", selectedUser.playsRemaining],
                  ["💰 Saldo", `R$ ${(selectedUser.saldo / 100).toFixed(2)}`],
                  ["💳 Total Jogadas", (selectedUser.paidPlaysUsed || 0) + (selectedUser.freePlaysTotalUsed || 0)],
                  ["🛒 Comprou?", selectedUser.hasPaid ? "Sim" : "Não"],
                  ["📅 Cadastro", new Date(selectedUser.createdAt).toLocaleDateString("pt-BR")],
                  ["🕐 Último Login", selectedUser.ultimoLogin ? new Date(selectedUser.ultimoLogin).toLocaleString("pt-BR") : "—"],
                ].map(([label, val]) => (
                  <div key={String(label)}>
                    <div style={{ color: C.muted, marginBottom: 2 }}>{label}</div>
                    <div style={{ color: C.text, fontWeight: 600 }}>{val}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Ferramentas */}
            <div style={{ color: C.gold, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>🔧 Ferramentas</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <Btn small label="✅ Desbloquear" color={C.green} onClick={() => doUserAction("unblock")} />
              <Btn small label="🔒 Bloquear" color={C.red} onClick={() => doUserAction("block")} />
            </div>

            <Card style={{ marginBottom: 10 }}>
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>Jogadas (número positivo = adicionar, negativo = remover)</div>
              <input value={playDelta} onChange={e => setPlayDelta(e.target.value)} type="number"
                placeholder="Ex: 10 ou -5"
                style={{ width: "100%", boxSizing: "border-box", background: "#1a1a25", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 14, outline: "none", marginBottom: 8 }} />
              <Btn label="Aplicar Jogadas" onClick={() => { doUserAction("plays", { delta: parseInt(playDelta) || 0 }); setPlayDelta(""); }} />
            </Card>

            <Card style={{ marginBottom: 10 }}>
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>Saldo em centavos (Ex: 1000 = R$10,00)</div>
              <input value={saldoDelta} onChange={e => setSaldoDelta(e.target.value)} type="number"
                placeholder="Ex: 1000 ou -500"
                style={{ width: "100%", boxSizing: "border-box", background: "#1a1a25", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 14, outline: "none", marginBottom: 8 }} />
              <Btn label="Aplicar Saldo" onClick={() => { doUserAction("saldo", { delta: parseInt(saldoDelta) || 0 }); setSaldoDelta(""); }} />
            </Card>

            <Card style={{ marginBottom: 10 }}>
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>Alterar dados</div>
              <Input label="Nome" value={editName} onChange={setEditName} />
              <Input label="Telefone" value={editPhone} onChange={setEditPhone} />
              <Btn label="Salvar Alterações" onClick={() => doUserAction("update", { name: editName, phone: editPhone })} />
            </Card>

            <Card>
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>WhatsApp</div>
              <Btn label="💬 Enviar Mensagem" color="#25D366" onClick={() => {
                const num = selectedUser.phone.replace(/\D/g, "");
                window.open(`https://wa.me/55${num}`, "_blank");
              }} />
            </Card>
          </div>
        )}

        {/* ── CONFIGURAÇÕES ── */}
        {tab === "config" && (
          <div>
            <div style={{ color: C.gold, fontWeight: 700, marginBottom: 12, fontSize: 15 }}>⚙️ Configurações</div>

            {/* Valor acumulado */}
            <Card style={{ marginBottom: 12 }}>
              <div style={{ color: C.gold, fontWeight: 700, marginBottom: 10, fontSize: 13 }}>💰 Valor Acumulado</div>
              <Input label="Valor (Ex: 3632.00)" value={settings.valor_acumulado || ""} onChange={v => setSettings(s => ({ ...s, valor_acumulado: v }))} />
              <Btn label="Salvar" onClick={() => saveSettings({ valor_acumulado: settings.valor_acumulado || "0" })} />
            </Card>

            {/* Valor pago em prêmios */}
            <Card style={{ marginBottom: 12 }}>
              <div style={{ color: C.red, fontWeight: 700, marginBottom: 10, fontSize: 13 }}>🏆 Valor Pago em Prêmios</div>
              <Input label="Total pago (Ex: 1250.00)" value={settings.valor_pago_premios || ""} onChange={v => setSettings(s => ({ ...s, valor_pago_premios: v }))} />
              <Btn label="Salvar" onClick={() => saveSettings({ valor_pago_premios: settings.valor_pago_premios || "0" })} />
            </Card>

            {/* Último Ganhador */}
            <Card style={{ marginBottom: 12 }}>
              <div style={{ color: C.purple, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>🥇 Último Ganhador</div>

              {/* Foto upload */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>FOTO DO GANHADOR</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%", background: "#1a1a30",
                    border: `2px solid ${C.border}`, overflow: "hidden", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {settings.ug_foto
                      ? <img src={settings.ug_foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 28 }}>👤</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{
                      display: "block", width: "100%", boxSizing: "border-box",
                      background: C.purple, border: "none", borderRadius: 8,
                      color: "#fff", fontWeight: 700, fontSize: 13,
                      padding: "10px 14px", cursor: "pointer", textAlign: "center",
                    }}>
                      📷 Escolher Foto
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement("canvas");
                              const MAX = 300;
                              const ratio = Math.min(MAX / img.width, MAX / img.height);
                              canvas.width = img.width * ratio;
                              canvas.height = img.height * ratio;
                              canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
                              setSettings(s => ({ ...s, ug_foto: canvas.toDataURL("image/jpeg", 0.8) }));
                            };
                            img.src = ev.target?.result as string;
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {settings.ug_foto && (
                      <button onClick={() => setSettings(s => ({ ...s, ug_foto: "" }))}
                        style={{ marginTop: 6, width: "100%", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 12, padding: "6px", cursor: "pointer" }}>
                        🗑️ Remover foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <Input label="Nome completo" value={settings.ug_nome || ""} onChange={v => setSettings(s => ({ ...s, ug_nome: v }))} />

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                <Input label="Cidade" value={settings.ug_cidade || (settings.ug_cidade_estado || "").split("-")[0] || ""} onChange={v => setSettings(s => ({ ...s, ug_cidade: v }))} />
                <Input label="Estado (sigla)" value={settings.ug_estado || (settings.ug_cidade_estado || "").split("-")[1] || ""} onChange={v => setSettings(s => ({ ...s, ug_estado: v.toUpperCase().slice(0, 2) }))} />
              </div>

              <Input label="Valor do prêmio (Ex: 1.250,00)" value={settings.ug_valor || ""} onChange={v => setSettings(s => ({ ...s, ug_valor: v }))} />

              <Btn label="💾 Salvar Último Ganhador" color={C.purple} onClick={() => {
                const cidade = settings.ug_cidade || (settings.ug_cidade_estado || "").split("-")[0] || "";
                const estado = settings.ug_estado || (settings.ug_cidade_estado || "").split("-")[1] || "";
                saveSettings({
                  ug_nome: settings.ug_nome || "",
                  ug_cidade_estado: `${cidade}-${estado}`,
                  ug_valor: settings.ug_valor || "",
                  ug_foto: settings.ug_foto || "",
                });
              }} />
            </Card>

            {/* Controle do jogo */}
            <Card style={{ marginBottom: 12 }}>
              <div style={{ color: C.green, fontWeight: 700, marginBottom: 10, fontSize: 13 }}>⚽ Controle do Jogo</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ color: C.text, fontSize: 13 }}>Premiação Ativa</span>
                <button
                  onClick={() => {
                    const novo = settings.premiacao_ativa === "true" ? "false" : "true";
                    setSettings(s => ({ ...s, premiacao_ativa: novo }));
                    saveSettings({ premiacao_ativa: novo });
                  }}
                  style={{
                    background: settings.premiacao_ativa === "true" ? C.green : C.red,
                    border: "none", borderRadius: 20, padding: "6px 16px",
                    color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
                  }}>
                  {settings.premiacao_ativa === "true" ? "ATIVO" : "INATIVO"}
                </button>
              </div>
              <Input label="Bônus linha 4 (jogadas)" value={settings.bonus_row3 || "1"} onChange={v => setSettings(s => ({ ...s, bonus_row3: v }))} />
              <Input label="Bônus linha 5 (jogadas)" value={settings.bonus_row4 || "5"} onChange={v => setSettings(s => ({ ...s, bonus_row4: v }))} />
              <Input label="Bônus linha 6 — MEGA (jogadas)" value={settings.bonus_row5 || "15"} onChange={v => setSettings(s => ({ ...s, bonus_row5: v }))} />
              <Btn label="Salvar Configurações do Jogo" color={C.green} onClick={() => saveSettings({
                bonus_row3: settings.bonus_row3 || "1",
                bonus_row4: settings.bonus_row4 || "5",
                bonus_row5: settings.bonus_row5 || "15",
              })} />
            </Card>

            {/* Mensagem para todos */}
            <Card style={{ marginBottom: 12 }}>
              <div style={{ color: "#f97316", fontWeight: 700, marginBottom: 10, fontSize: 13 }}>📢 Mensagem para Todos os Jogadores</div>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>
                Ao enviar, todos os jogadores verão esta mensagem na próxima vez que abrirem o app.
              </div>
              <textarea
                value={settings.broadcast_message || ""}
                onChange={e => setSettings(s => ({ ...s, broadcast_message: e.target.value }))}
                placeholder="Ex: 🎉 Novidade! Agora você pode ganhar bônus por indicar amigos. Convide já!"
                rows={4}
                style={{
                  width: "100%", boxSizing: "border-box", background: "#1a1a25",
                  border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
                  padding: "10px 12px", fontSize: 13, outline: "none",
                  resize: "vertical", marginBottom: 8, fontFamily: "inherit",
                }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Btn
                  label="📤 Enviar para Todos"
                  color="#f97316"
                  onClick={() => saveSettings({
                    broadcast_message: settings.broadcast_message || "",
                    broadcast_id: String(Date.now()),
                  })}
                />
                <Btn
                  label="🗑️ Apagar Mensagem"
                  color="#555"
                  onClick={() => {
                    setSettings(s => ({ ...s, broadcast_message: "" }));
                    saveSettings({ broadcast_message: "", broadcast_id: "" });
                  }}
                />
              </div>
            </Card>

            {/* WhatsApp atendimento */}
            <Card style={{ marginBottom: 12 }}>
              <div style={{ color: "#25D366", fontWeight: 700, marginBottom: 10, fontSize: 13 }}>💬 Canal de Atendimento</div>
              <Input label="WhatsApp (Ex: 5511999999999)" value={settings.whatsapp_atendimento || ""} onChange={v => setSettings(s => ({ ...s, whatsapp_atendimento: v }))} />
              <Btn label="Salvar" color="#25D366" onClick={() => saveSettings({ whatsapp_atendimento: settings.whatsapp_atendimento || "" })} />
            </Card>

            {/* Promoção */}
            <Card style={{ marginBottom: 12 }}>
              <div style={{ color: "#ff6a00", fontWeight: 700, marginBottom: 10, fontSize: 13 }}>🎁 Promoção — Botão no Jogo</div>

              {/* Ativar/Desativar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ color: C.text, fontSize: 13 }}>Botão Promoção Ativo</span>
                <button
                  onClick={() => {
                    const novo = settings.promo_ativa === "false" ? "true" : "false";
                    setSettings(s => ({ ...s, promo_ativa: novo }));
                    saveSettings({ promo_ativa: novo });
                  }}
                  style={{
                    background: settings.promo_ativa === "false" ? C.red : "#ff6a00",
                    border: "none", borderRadius: 20, padding: "6px 16px",
                    color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
                  }}>
                  {settings.promo_ativa === "false" ? "INATIVO" : "ATIVO"}
                </button>
              </div>

              <Input
                label="Título do botão (ex: GANHE 100 JOGADAS GRÁTIS)"
                value={settings.promo_titulo || "GANHE 100 JOGADAS GRÁTIS"}
                onChange={v => setSettings(s => ({ ...s, promo_titulo: v }))}
              />

              <div style={{ color: C.muted, fontSize: 11, margin: "8px 0 6px", fontWeight: 700 }}>🥈 META 1 — Recompensa intermediária</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Input label="Indicações necessárias" value={settings.promo_meta1_indicacoes || "20"} onChange={v => setSettings(s => ({ ...s, promo_meta1_indicacoes: v }))} />
                <Input label="Jogadas ganhas" value={settings.promo_meta1_jogadas || "50"} onChange={v => setSettings(s => ({ ...s, promo_meta1_jogadas: v }))} />
              </div>

              <div style={{ color: C.muted, fontSize: 11, margin: "8px 0 6px", fontWeight: 700 }}>🥇 META 2 — Recompensa principal</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Input label="Indicações" value={settings.promo_meta2_indicacoes || "30"} onChange={v => setSettings(s => ({ ...s, promo_meta2_indicacoes: v }))} />
                <Input label="Dias limite" value={settings.promo_meta2_dias || "30"} onChange={v => setSettings(s => ({ ...s, promo_meta2_dias: v }))} />
                <Input label="Jogadas ganhas" value={settings.promo_meta2_jogadas || "100"} onChange={v => setSettings(s => ({ ...s, promo_meta2_jogadas: v }))} />
              </div>

              <div style={{ color: C.muted, fontSize: 11, margin: "8px 0 6px", fontWeight: 700 }}>⭐ BÔNUS CONTÍNUO por indicação</div>
              <Input label="Jogadas por indicação válida" value={settings.promo_bonus_por_indicacao || "3"} onChange={v => setSettings(s => ({ ...s, promo_bonus_por_indicacao: v }))} />

              <Btn
                label="💾 Salvar Promoção"
                color="#ff6a00"
                onClick={() => saveSettings({
                  promo_ativa: settings.promo_ativa ?? "true",
                  promo_titulo: settings.promo_titulo || "GANHE 100 JOGADAS GRÁTIS",
                  promo_meta1_indicacoes: settings.promo_meta1_indicacoes || "20",
                  promo_meta1_jogadas: settings.promo_meta1_jogadas || "50",
                  promo_meta2_indicacoes: settings.promo_meta2_indicacoes || "30",
                  promo_meta2_dias: settings.promo_meta2_dias || "30",
                  promo_meta2_jogadas: settings.promo_meta2_jogadas || "100",
                  promo_bonus_por_indicacao: settings.promo_bonus_por_indicacao || "3",
                })}
              />
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div style={{
        background: C.card, borderTop: `1px solid ${C.border}`,
        display: "flex", paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {([
          ["dashboard", "📊", "Dashboard"],
          ["users", "👥", "Usuários"],
          ["config", "⚙️", "Config"],
        ] as [Tab, string, string][]).map(([t, icon, label]) => (
          <button key={t} onClick={() => { setTab(t); setSelectedUser(null); }} style={{
            flex: 1, background: "none", border: "none", padding: "10px 4px",
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 10, color: tab === t ? C.gold : C.muted, fontWeight: tab === t ? 700 : 400 }}>{label}</span>
            {tab === t && <div style={{ width: 20, height: 2, background: C.gold, borderRadius: 1 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
