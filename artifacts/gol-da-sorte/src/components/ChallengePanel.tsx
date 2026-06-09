import { useEffect, useState } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\//, "")
  ? `/${import.meta.env.BASE_URL.replace(/^\/|\/$/g, "")}/api`
  : "/api";

function getApiUrl(path: string) {
  return `${window.location.origin}${API_BASE}${path}`;
}

interface ChallengeInfo {
  payingFriendsCount: number;
  payingFriendsGoal: number;
  rewardPlays: number;
  daysRemaining: number;
  daysTotal: number;
  startDate: string;
  endDate: string;
  challengeActive: boolean;
  challengeCompleted: boolean;
  challengeExpired: boolean;
}

interface Props {
  userId: number;
  onClose: () => void;
}

export default function ChallengePanel({ userId, onClose }: Props) {
  const [info, setInfo] = useState<ChallengeInfo | null>(null);

  useEffect(() => {
    fetch(getApiUrl(`/users/${userId}/challenge-info`))
      .then(r => r.json())
      .then(d => setInfo(d));
  }, [userId]);

  const progress = info ? Math.min(info.payingFriendsCount / info.payingFriendsGoal, 1) : 0;
  const pct = Math.round(progress * 100);

  const statusColor = info?.challengeCompleted
    ? "#00E676"
    : info?.challengeExpired
    ? "#666"
    : "#FFD700";

  const statusLabel = info?.challengeCompleted
    ? "✅ CONCLUÍDO!"
    : info?.challengeExpired
    ? "⏰ EXPIRADO"
    : "🔥 EM ANDAMENTO";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.93)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "linear-gradient(160deg, #0a0020 0%, #1a0035 50%, #0f0a00 100%)",
        border: `2px solid ${statusColor}44`,
        borderRadius: 22,
        padding: 28,
        width: "100%",
        maxWidth: 360,
        position: "relative",
        boxShadow: `0 0 40px ${statusColor}22`,
      }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", background: "transparent", border: "none",
            color: "#666", fontSize: 22, cursor: "pointer", right: 18, top: 16,
            lineHeight: 1,
          }}
        >✕</button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 44, marginBottom: 4 }}>🏆</div>
          <div style={{ color: "#FFD700", fontSize: 18, fontWeight: 900, letterSpacing: 1, lineHeight: 1.2 }}>
            DESAFIO DA TEMPORADA
          </div>
          <div style={{ color: "#888", fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
            Indique <span style={{ color: "#FFD700", fontWeight: 700 }}>30 amigos pagantes</span> em{" "}
            <span style={{ color: "#FFD700", fontWeight: 700 }}>30 dias</span> e ganhe
          </div>
          <div style={{
            color: "#00E676", fontSize: 28, fontWeight: 900,
            textShadow: "0 0 20px #00E67688",
            marginTop: 2,
          }}>
            +100 JOGADAS GRÁTIS!
          </div>
        </div>

        {!info ? (
          <div style={{ textAlign: "center", color: "#666", padding: 24 }}>Carregando...</div>
        ) : (
          <>
            {/* Status badge */}
            <div style={{
              display: "flex", justifyContent: "center", marginBottom: 20,
            }}>
              <div style={{
                background: `${statusColor}18`,
                border: `1.5px solid ${statusColor}55`,
                borderRadius: 20,
                padding: "5px 16px",
                color: statusColor,
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: 1,
              }}>
                {statusLabel}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 18 }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", marginBottom: 8,
              }}>
                <span style={{ color: "#aaa", fontSize: 12 }}>Amigos pagantes</span>
                <span style={{ color: "#FFD700", fontWeight: 900, fontSize: 18 }}>
                  {info.payingFriendsCount}
                  <span style={{ color: "#555", fontSize: 14, fontWeight: 400 }}>/{info.payingFriendsGoal}</span>
                </span>
              </div>

              {/* Bar background */}
              <div style={{
                background: "rgba(255,255,255,0.07)",
                borderRadius: 99,
                height: 18,
                overflow: "hidden",
                position: "relative",
              }}>
                {/* Fill */}
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: 99,
                  background: info.challengeCompleted
                    ? "linear-gradient(90deg, #00C853, #00E676)"
                    : info.challengeExpired
                    ? "linear-gradient(90deg, #444, #666)"
                    : "linear-gradient(90deg, #FF6B00, #FFD700)",
                  transition: "width 0.6s ease",
                  boxShadow: info.challengeCompleted
                    ? "0 0 10px #00E67688"
                    : info.challengeExpired ? "none"
                    : "0 0 10px #FFD70088",
                }} />
                {/* Percentage label */}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 11, fontWeight: 900,
                  textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                }}>
                  {pct}%
                </div>
              </div>

              <div style={{
                display: "flex", justifyContent: "space-between",
                marginTop: 6, fontSize: 11, color: "#666",
              }}>
                <span>0</span>
                <span style={{ color: "#FFD700" }}>META: 30</span>
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "12px 10px", textAlign: "center",
              }}>
                <div style={{ color: "#FFD700", fontSize: 22, fontWeight: 900 }}>
                  {info.payingFriendsCount}
                </div>
                <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>já indicados</div>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "12px 10px", textAlign: "center",
              }}>
                <div style={{
                  color: info.challengeExpired ? "#555" : info.daysRemaining <= 5 ? "#FF6B35" : "#00BFFF",
                  fontSize: 22, fontWeight: 900,
                }}>
                  {info.challengeCompleted ? "✓" : info.daysRemaining}
                </div>
                <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>
                  {info.challengeCompleted ? "missão cumprida" : "dias restantes"}
                </div>
              </div>
            </div>

            {/* Faltam message */}
            {info.challengeActive && info.payingFriendsCount < info.payingFriendsGoal && (
              <div style={{
                background: "rgba(255,200,0,0.07)",
                border: "1px solid rgba(255,200,0,0.2)",
                borderRadius: 12, padding: "12px 14px",
                textAlign: "center",
              }}>
                <div style={{ color: "#FFD700", fontWeight: 700, fontSize: 14 }}>
                  Faltam <span style={{ fontSize: 20 }}>{info.payingFriendsGoal - info.payingFriendsCount}</span> amigos pagantes
                </div>
                <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
                  para você ganhar 100 jogadas grátis!
                </div>
              </div>
            )}

            {/* Completed message */}
            {info.challengeCompleted && (
              <div style={{
                background: "rgba(0,230,118,0.08)",
                border: "2px solid rgba(0,230,118,0.35)",
                borderRadius: 14, padding: "16px 14px",
                textAlign: "center",
                boxShadow: "0 0 20px rgba(0,230,118,0.15)",
              }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>🎉🏆🎊</div>
                <div style={{ color: "#00E676", fontWeight: 900, fontSize: 16 }}>
                  DESAFIO CONCLUÍDO!
                </div>
                <div style={{ color: "#aaa", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                  Você indicou 30 amigos pagantes e<br />
                  ganhou <span style={{ color: "#00E676", fontWeight: 700 }}>+100 jogadas</span> no seu contador!
                </div>
              </div>
            )}

            {/* Expired message */}
            {info.challengeExpired && (
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, padding: "12px 14px",
                textAlign: "center",
              }}>
                <div style={{ color: "#666", fontWeight: 700, fontSize: 14 }}>
                  O prazo de 30 dias encerrou
                </div>
                <div style={{ color: "#555", fontSize: 12, marginTop: 4 }}>
                  Você chegou a {info.payingFriendsCount} de 30 amigos pagantes.
                </div>
              </div>
            )}

            {/* Days progress mini bar */}
            {info.challengeActive && (
              <div style={{ marginTop: 14 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 11, color: "#555", marginBottom: 5,
                }}>
                  <span>Tempo do desafio</span>
                  <span style={{ color: info.daysRemaining <= 5 ? "#FF6B35" : "#666" }}>
                    {info.daysRemaining} dias restantes
                  </span>
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.05)", borderRadius: 99, height: 5,
                }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.round(((info.daysTotal - info.daysRemaining) / info.daysTotal) * 100)}%`,
                    borderRadius: 99,
                    background: info.daysRemaining <= 5
                      ? "linear-gradient(90deg,#FF4444,#FF8C00)"
                      : "linear-gradient(90deg,#0080FF,#00BFFF)",
                  }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
