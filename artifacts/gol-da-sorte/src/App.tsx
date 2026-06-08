import { useState, useEffect, useCallback } from "react";
import golDaSorteImg from "@assets/IMG_7715_1780523556282.jpeg";
import RegisterScreen from "./components/RegisterScreen";
import PurchaseModal from "./components/PurchaseModal";
import InviteScreen from "./components/InviteScreen";

// ── Image natural dimensions (confirmed 1125 × 2175) ──
const NAT_W = 1125;
const NAT_H = 2175;
const NAT_RATIO = NAT_W / NAT_H;

const DEBUG = false;
const TOUCH_CALIB = false;

// ── Calibrated UI positions (pixel scan confirmed) ──
// JOGADAS number "12":   x=786-881 (xF=0.699-0.783), y=240-274 (yF=0.110-0.126)
// CONVIDAR AGORA button: x=764-1000 (xF=0.679-0.889), y=1286-1310 (yF=0.591-0.602)
const UI = {
  jogadasNum:   { x: 0.675, y: 0.188, w: 0.130, h: 0.048 },  // real counter overlay
  jogadasPlus:  { x: 0.795, y: 0.188, w: 0.080, h: 0.048 },  // "+" buy button
  convidar:     { x: 0.608, y: 0.569, w: 0.272, h: 0.052 },  // CONVIDAR AGORA button
};

type RowDef = { y: [number, number]; x: [number, number][]; label: string };

const ROWS: RowDef[] = [
  { label: "R0", y: [0.784, 0.868], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R1", y: [0.674, 0.758], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R2", y: [0.564, 0.648], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R3", y: [0.429, 0.513], x: [[0.183, 0.330], [0.327, 0.434], [0.435, 0.544]] },
  { label: "R4", y: [0.337, 0.421], x: [[0.183, 0.330], [0.327, 0.434], [0.435, 0.544]] },
  { label: "R5", y: [0.233, 0.317], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
];

const ROW_WRONG_COUNT = [1, 1, 2, 2, 2, 1];
const ROW_COLORS = ["#ff0", "#0ff", "#0f0", "#f80", "#f0f", "#fff"];
const TOTAL_ROWS = ROWS.length;

function randomWrongBalls(): number[][] {
  return ROW_WRONG_COUNT.map(wrongCount => {
    const pool = [0, 1, 2];
    const wrong: number[] = [];
    for (let i = 0; i < wrongCount; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      wrong.push(pool.splice(idx, 1)[0]);
    }
    return wrong;
  });
}

type Bounds = { x: number; y: number; w: number; h: number };

function calcBounds(): Bounds {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const conRatio = vw / vh;
  let w: number, h: number, x: number, y: number;
  if (conRatio > NAT_RATIO) {
    h = vh; w = h * NAT_RATIO; x = (vw - w) / 2; y = 0;
  } else {
    w = vw; h = w / NAT_RATIO; x = 0; y = (vh - h) / 2;
  }
  return { x, y, w, h };
}

function getAudioCtx() {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
}

function playClickSound() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.connect(g); g.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
  g.gain.setValueAtTime(0.5, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.start(); osc.stop(ctx.currentTime + 0.12);
}

function playCorrectSound() {
  const ctx = getAudioCtx();
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
    g.gain.setValueAtTime(1.0, ctx.currentTime + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.15);
    osc.start(ctx.currentTime + i * 0.09);
    osc.stop(ctx.currentTime + i * 0.09 + 0.15);
  });
}

function playBombSound() {
  const ctx = getAudioCtx();
  const sr = ctx.sampleRate; const dur = 0.7;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.5);
  }
  const noise = ctx.createBufferSource(); noise.buffer = buf;
  const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass";
  lpf.frequency.setValueAtTime(600, ctx.currentTime);
  lpf.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + dur);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(3.5, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  noise.connect(lpf); lpf.connect(noiseGain); noiseGain.connect(ctx.destination);
  noise.start(); noise.stop(ctx.currentTime + dur);
  const sub = ctx.createOscillator(); const subGain = ctx.createGain();
  sub.connect(subGain); subGain.connect(ctx.destination); sub.type = "sine";
  sub.frequency.setValueAtTime(120, ctx.currentTime);
  sub.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.5);
  subGain.gain.setValueAtTime(3.0, ctx.currentTime);
  subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
  sub.start(); sub.stop(ctx.currentTime + 0.55);
  const crack = ctx.createOscillator(); const crackGain = ctx.createGain();
  crack.connect(crackGain); crackGain.connect(ctx.destination); crack.type = "sawtooth";
  crack.frequency.setValueAtTime(300, ctx.currentTime);
  crack.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.06);
  crackGain.gain.setValueAtTime(2.5, ctx.currentTime);
  crackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
  crack.start(); crack.stop(ctx.currentTime + 0.06);
}

async function apiCall(path: string, opts?: RequestInit) {
  try {
    const res = await fetch(`/api${path}`, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function getReferralCodeFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("ref");
}

export default function App() {
  const [bounds, setBounds] = useState<Bounds>(calcBounds);
  const [gameActive, setGameActive] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  const [wrongBalls, setWrongBalls] = useState<number[][]>(randomWrongBalls);
  const [errorBall, setErrorBall] = useState<{ row: number; ball: number } | null>(null);
  const [justOkBall, setJustOkBall] = useState<{ row: number; ball: number } | null>(null);
  const [correctPicks, setCorrectPicks] = useState<{ row: number; ball: number }[]>([]);
  const [jogarLit, setJogarLit] = useState(false);
  const [locked, setLocked] = useState(false);
  const [calibTaps, setCalibTaps] = useState<{ xF: string; yF: string }[]>([]);

  const [userId, setUserId] = useState<number | null>(() => {
    const stored = localStorage.getItem("golUserId");
    return stored ? parseInt(stored) : null;
  });
  const [playsRemaining, setPlaysRemaining] = useState<number>(0);
  const [referralUnlocked, setReferralUnlocked] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showInviteScreen, setShowInviteScreen] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const referralCodeFromUrl = getReferralCodeFromUrl();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const reCalc = useCallback(() => setBounds(calcBounds()), []);
  useEffect(() => {
    window.addEventListener("resize", reCalc);
    window.visualViewport?.addEventListener("resize", reCalc);
    return () => {
      window.removeEventListener("resize", reCalc);
      window.visualViewport?.removeEventListener("resize", reCalc);
    };
  }, [reCalc]);

  useEffect(() => {
    if (!userId) { setUserLoaded(true); return; }
    apiCall(`/users/${userId}`).then(data => {
      if (data?.user) {
        setPlaysRemaining(data.user.playsRemaining);
        setReferralUnlocked(data.user.referralUnlocked);
      } else {
        localStorage.removeItem("golUserId");
        setUserId(null);
      }
      setUserLoaded(true);
    });
  }, [userId]);

  // ── Overlay helper: positions an element over a fraction of the rendered image ──
  const ov = (xF: number, yF: number, wF: number, hF: number): React.CSSProperties => ({
    position: "absolute",
    left: bounds.x + bounds.w * xF,
    top:  bounds.y + bounds.h * yF,
    width:  bounds.w * wF,
    height: bounds.h * hF,
  });

  const handleCalibTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (!TOUCH_CALIB) return;
    let clientX: number, clientY: number;
    if ("changedTouches" in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY;
    } else if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY;
    }
    const xF = ((clientX - bounds.x) / bounds.w).toFixed(3);
    const yF = ((clientY - bounds.y) / bounds.h).toFixed(3);
    setCalibTaps(prev => [{ xF, yF }, ...prev].slice(0, 8));
  };

  const handleJogar = async () => {
    if (TOUCH_CALIB || !userId) return;
    if (playsRemaining <= 0) { setShowPurchaseModal(true); return; }

    playClickSound();
    setJogarLit(true);
    setTimeout(() => setJogarLit(false), 400);

    setWrongBalls(randomWrongBalls());
    setCurrentRow(0); setErrorBall(null); setJustOkBall(null);
    setCorrectPicks([]); setLocked(false); setGameActive(true);
  };

  const handleBallClick = async (rowIdx: number, ballIdx: number) => {
    if (!gameActive || rowIdx !== currentRow || locked) return;
    setLocked(true);
    if (wrongBalls[rowIdx].includes(ballIdx)) {
      playBombSound();
      setErrorBall({ row: rowIdx, ball: ballIdx });

      // Desconta 1 jogada ao errar
      if (userId) {
        const data = await apiCall(`/users/${userId}/use-play`, { method: "POST" });
        if (data?.user) {
          setPlaysRemaining(data.user.playsRemaining);
          if (data.user.referralUnlocked && !referralUnlocked) {
            setReferralUnlocked(true);
            showToast("🎉 INDIQUE AMIGOS desbloqueado!");
          }
        }
      }

      setTimeout(() => {
        setErrorBall(null); setJustOkBall(null);
        setCorrectPicks([]); setCurrentRow(0);
        setWrongBalls(randomWrongBalls()); setLocked(false);
      }, 1600);
    } else {
      playCorrectSound();
      const pick = { row: rowIdx, ball: ballIdx };
      setCorrectPicks(prev => [...prev, pick]);
      setJustOkBall(pick);
      setTimeout(() => {
        setJustOkBall(null);
        const next = rowIdx + 1;
        if (next >= TOTAL_ROWS) {
          setGameActive(false); setCurrentRow(0);
          showToast("🏆 Parabéns! Você chegou ao fim!");
        } else {
          setCurrentRow(next); setLocked(false);
        }
      }, 700);
    }
  };

  const handleRegistered = (id: number) => {
    setUserId(id);
    localStorage.setItem("golUserId", String(id));
    apiCall(`/users/${id}`).then(data => {
      if (data?.user) {
        setPlaysRemaining(data.user.playsRemaining);
        setReferralUnlocked(data.user.referralUnlocked);
      }
      setUserLoaded(true);
    });
  };

  const handlePurchased = (newPlays: number) => {
    setPlaysRemaining(newPlays);
    setShowPurchaseModal(false);
    showToast(`✅ Compra realizada! ${newPlays} jogadas disponíveis.`);
  };

  if (!userLoaded) return null;
  if (!userId) {
    return <RegisterScreen referralCode={referralCodeFromUrl || undefined} onRegistered={handleRegistered} />;
  }

  // Derived font size based on image render width
  const numFontSize = Math.max(bounds.w * 0.040, 13);
  const smallFontSize = Math.max(bounds.w * 0.022, 9);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden" }}
      onClick={TOUCH_CALIB ? handleCalibTap : undefined}
      onTouchEnd={TOUCH_CALIB ? handleCalibTap : undefined}
    >
      {/* Background image */}
      <img
        src={golDaSorteImg}
        alt="Gol da Sorte"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />

      {/* ══════════════════════════════════════════════
          JOGADAS counter — real play count
          ══════════════════════════════════════════════ */}
      <div
        style={{
          ...ov(UI.jogadasNum.x, UI.jogadasNum.y, UI.jogadasNum.w, UI.jogadasNum.h),
          zIndex: 30,
          background: DEBUG ? "rgba(0,255,0,0.3)" : "rgba(10,8,4,0.82)",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: DEBUG ? "2px solid lime" : "none",
          pointerEvents: "none",
        }}
      >
        <span style={{
          color: "#FFD700",
          fontWeight: 900,
          fontSize: numFontSize,
          lineHeight: 1,
          textShadow: "0 0 8px rgba(255,200,0,0.6)",
          letterSpacing: 1,
        }}>
          {playsRemaining}
        </span>
      </div>

      {/* ══════════════════════════════════════════════
          "+" button area — buy more plays
          Positioned right of JOGADAS number
          ══════════════════════════════════════════════ */}
      <div
        onClick={() => setShowPurchaseModal(true)}
        onTouchEnd={(e) => { e.preventDefault(); setShowPurchaseModal(true); }}
        style={{
          ...ov(UI.jogadasPlus.x, UI.jogadasPlus.y, UI.jogadasPlus.w, UI.jogadasPlus.h),
          zIndex: 30,
          cursor: "pointer",
          background: DEBUG ? "rgba(255,165,0,0.4)" : "transparent",
          border: DEBUG ? "2px solid orange" : "none",
          borderRadius: 4,
        }}
      />

      {/* ══════════════════════════════════════════════
          CONVIDAR AGORA button overlay
          Pixel scan: x=764-1000 (xF≈0.679-0.889), y=1286-1310 (yF≈0.591-0.602)
          Expanded slightly for easier tapping
          ══════════════════════════════════════════════ */}
      <div
        onClick={() => setShowInviteScreen(true)}
        onTouchEnd={(e) => { e.preventDefault(); setShowInviteScreen(true); }}
        style={{
          ...ov(UI.convidar.x, UI.convidar.y, UI.convidar.w, UI.convidar.h),
          zIndex: 30,
          cursor: "pointer",
          background: DEBUG ? "rgba(128,0,255,0.4)" : "transparent",
          border: DEBUG ? "2px solid violet" : "none",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Show lock badge when not yet unlocked */}
        {!referralUnlocked && !DEBUG && (
          <div style={{
            background: "rgba(0,0,0,0.65)",
            borderRadius: 6,
            padding: "2px 8px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            pointerEvents: "none",
          }}>
            <span style={{ fontSize: smallFontSize * 1.1 }}>🔒</span>
            <span style={{ color: "#aaa", fontSize: smallFontSize, fontWeight: 700, lineHeight: 1 }}>
              Bloqueado
            </span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          JOGAR button overlay
          ══════════════════════════════════════════════ */}
      <div
        onClick={handleJogar}
        style={{
          ...ov(0.030, 0.860, 0.560, 0.052),
          zIndex: 10,
          cursor: "pointer",
          borderRadius: 8,
          background: DEBUG ? "rgba(255,0,0,0.4)"
            : playsRemaining <= 0 ? "rgba(255,40,0,0.18)"
            : jogarLit ? "rgba(255,200,50,0.45)" : "transparent",
          boxShadow: !DEBUG && jogarLit ? "0 0 24px 8px rgba(255,180,0,0.7)" : "none",
          border: DEBUG ? "2px solid red" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {playsRemaining <= 0 && !DEBUG && (
          <span style={{
            color: "#FF6B35", fontWeight: 900,
            fontSize: Math.max(bounds.w * 0.025, 9),
            textShadow: "0 0 4px rgba(0,0,0,0.9)",
            pointerEvents: "none",
          }}>
            SEM JOGADAS — TOQUE PARA COMPRAR
          </span>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          Ball overlays
          ══════════════════════════════════════════════ */}
      {ROWS.map((row, rowIdx) => {
        const [yS, yE] = row.y;
        const rowH = yE - yS;
        const isActive = gameActive && rowIdx === currentRow;
        const col = ROW_COLORS[rowIdx];

        return row.x.map(([xS, xE], ballIdx) => {
          const xW = xE - xS;
          const isErr = errorBall?.row === rowIdx && errorBall?.ball === ballIdx;
          const isJustOk = justOkBall?.row === rowIdx && justOkBall?.ball === ballIdx;
          const isCorrect = correctPicks.some(p => p.row === rowIdx && p.ball === ballIdx);
          const showCircle = isActive || isCorrect || isErr;

          return (
            <div
              key={`${rowIdx}-${ballIdx}`}
              onClick={() => handleBallClick(rowIdx, ballIdx)}
              onTouchEnd={(e) => { e.preventDefault(); handleBallClick(rowIdx, ballIdx); }}
              style={{
                ...ov(xS, yS, xW, rowH),
                borderRadius: "50%", zIndex: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: isActive ? "pointer" : "default",
                background: DEBUG ? `${col}44` : "transparent",
                outline: DEBUG ? `2px solid ${col}` : "none",
                pointerEvents: (isActive && !TOUCH_CALIB) ? "auto" : "none",
              }}
            >
              {DEBUG && <span style={{ fontSize: 8, color: "#fff", fontWeight: 900, textShadow: "0 0 3px #000" }}>{row.label}B{ballIdx}</span>}
              {!DEBUG && showCircle && (
                <div style={{
                  width: "62%", height: "62%", borderRadius: "50%",
                  background: isErr ? "rgba(180,20,20,0.25)" : isCorrect ? (isJustOk ? "rgba(60,255,80,0.45)" : "rgba(60,220,80,0.28)") : "rgba(255,220,50,0.08)",
                  outline: isErr ? "2px solid rgba(255,60,60,0.60)" : isCorrect ? "2.5px solid rgba(60,255,100,0.80)" : "2px solid rgba(255,220,50,0.50)",
                  boxShadow: isErr ? "0 0 18px 6px rgba(255,30,0,0.55)" : isCorrect ? (isJustOk ? "0 0 22px 8px rgba(50,255,80,0.75)" : "0 0 12px 4px rgba(50,220,80,0.50)") : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none", transition: "box-shadow 0.3s ease",
                }}>
                  {isErr && <span style={{ fontSize: Math.max(bounds.w * xW * 0.50, 14), lineHeight: 1, userSelect: "none", filter: "drop-shadow(0 0 8px rgba(255,80,0,0.9))" }}>💣</span>}
                  {isCorrect && !isErr && <span style={{ fontSize: Math.max(bounds.w * xW * 0.38, 10), color: isJustOk ? "#afffb0" : "#70ff90", fontWeight: 900, lineHeight: 1, userSelect: "none", textShadow: "0 0 6px rgba(80,255,100,0.7)" }}>✓</span>}
                </div>
              )}
            </div>
          );
        });
      })}

      {/* ── CALIBRATION OVERLAY ── */}
      {TOUCH_CALIB && (
        <>
          <div style={{ position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", zIndex: 200, pointerEvents: "none" }}>
            <span style={{ background: "rgba(0,0,0,0.85)", color: "#FFD700", fontSize: 13, fontWeight: 900, padding: "4px 12px", borderRadius: 8 }}>
              MODO CALIBRAÇÃO — Toque em qualquer elemento
            </span>
          </div>
          <div style={{ position: "absolute", top: 40, left: 8, background: "rgba(0,0,0,0.88)", color: "#fff", fontSize: 11, padding: "6px 10px", borderRadius: 8, zIndex: 200, pointerEvents: "none", lineHeight: 1.8, minWidth: 160 }}>
            <div style={{ color: "#FFD700", fontWeight: 900, marginBottom: 2 }}>Últimos toques:</div>
            {calibTaps.length === 0 && <div style={{ color: "#aaa" }}>nenhum ainda</div>}
            {calibTaps.map((t, i) => <div key={i} style={{ color: i === 0 ? "#0f0" : "#ccc" }}>x: {t.xF} &nbsp; <strong>y: {t.yF}</strong></div>)}
          </div>
        </>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.90)", border: "1px solid rgba(255,200,0,0.4)",
          color: "#FFD700", borderRadius: 12, padding: "10px 20px",
          fontSize: 14, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}>
          {toast}
        </div>
      )}

      {/* ── MODALS ── */}
      {showPurchaseModal && userId && (
        <PurchaseModal userId={userId} onPurchased={handlePurchased} onClose={() => setShowPurchaseModal(false)} />
      )}
      {showInviteScreen && userId && (
        <InviteScreen userId={userId} onClose={() => setShowInviteScreen(false)} />
      )}
    </div>
  );
}
