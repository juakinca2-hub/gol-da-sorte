import { useState, useRef, useEffect, useCallback } from "react";
import golDaSorteImg from "@assets/IMG_7715_1780523556282.jpeg";

// ── Image natural dimensions (confirmed 1125 × 2175) ──
const NAT_W = 1125;
const NAT_H = 2175;
const NAT_RATIO = NAT_W / NAT_H;

//teste kingame

// ── Modes ──
// Set TOUCH_CALIB = true to enter calibration mode:
//   Touch the CENTER of each ball → write down the yFrac shown → send to developer
const TOUCH_CALIB = false;
const DEBUG = false;

// ─────────────────────────────────────────────────────────────────
// ROWS — positions as fractions of rendered image (0 = top, 1 = bottom)
// y: [top, bottom]   x: [[left,right], [left,right], [left,right]]
// Row 0 = bottom (nearest JOGAR), Row 5 = top (prize)
// ─────────────────────────────────────────────────────────────────
type RowDef = { y: [number, number]; x: [number, number][]; label: string };

// Positions confirmed by Canvas pixel scan of original image (1125×2175)
// Plain ball X centers: 0.138 / 0.251 / 0.364  (ball width ≈ 0.095, gap ≈ 0.018)
// VALENDO ball X centers: 0.257 / 0.381 / 0.490
// Y centers (device calibration + pixel scan): R0=0.806 R1=0.696 R2=0.586 R3=0.451 R4=0.359 R5=0.255
const ROWS: RowDef[] = [
  { label: "R0", y: [0.764, 0.848], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R1", y: [0.654, 0.738], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R2", y: [0.544, 0.628], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R3", y: [0.409, 0.493], x: [[0.183, 0.330], [0.327, 0.434], [0.435, 0.544]] },
  { label: "R4", y: [0.317, 0.401], x: [[0.183, 0.330], [0.327, 0.434], [0.435, 0.544]] },
  { label: "R5", y: [0.213, 0.297], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
];

// Rows 0,1,5 → 1 wrong ball (2 correct); Rows 2,3,4 → 2 wrong (1 correct)
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

// ── Sound helpers ──
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

// 5 notas crescentes bem altas — toque correto
function playCorrectSound() {
  const ctx = getAudioCtx();
  // Dó-Mi-Sol-Dó-Mi uma oitava acima (acorde de vitória)
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
    g.gain.setValueAtTime(1.0, ctx.currentTime + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.15);
    osc.start(ctx.currentTime + i * 0.09);
    osc.stop(ctx.currentTime + i * 0.09 + 0.15);
  });
}

// Explosão de bomba bem alta — toque errado
function playBombSound() {
  const ctx = getAudioCtx();

  // 1) Ruído branco (estalo da explosão)
  const sr = ctx.sampleRate;
  const dur = 0.7;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.5);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.setValueAtTime(600, ctx.currentTime);
  lpf.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + dur);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(3.5, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

  noise.connect(lpf); lpf.connect(noiseGain); noiseGain.connect(ctx.destination);
  noise.start(); noise.stop(ctx.currentTime + dur);

  // 2) Sub-grave (thump da explosão)
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.connect(subGain); subGain.connect(ctx.destination);
  sub.type = "sine";
  sub.frequency.setValueAtTime(120, ctx.currentTime);
  sub.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.5);
  subGain.gain.setValueAtTime(3.0, ctx.currentTime);
  subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
  sub.start(); sub.stop(ctx.currentTime + 0.55);

  // 3) Crack inicial (clique seco)
  const crack = ctx.createOscillator();
  const crackGain = ctx.createGain();
  crack.connect(crackGain); crackGain.connect(ctx.destination);
  crack.type = "sawtooth";
  crack.frequency.setValueAtTime(300, ctx.currentTime);
  crack.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.06);
  crackGain.gain.setValueAtTime(2.5, ctx.currentTime);
  crackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
  crack.start(); crack.stop(ctx.currentTime + 0.06);
}

// ── Pixel scanner: runs once after image loads, logs ball row positions ──
function scanImageRows(imgEl: HTMLImageElement) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(imgEl, 0, 0);
    const W = imgEl.naturalWidth;
    const H = imgEl.naturalHeight;

    // ── Scan X positions at each ball row center ──
    // Known y-centers from previous scan
    const yCenters: Record<string, number> = {
      R5: Math.round(0.255 * H),
      R4: Math.round(0.359 * H),
      R3: Math.round(0.451 * H),
      R2: Math.round(0.587 * H),
      R1: Math.round(0.697 * H),
      R0: Math.round(0.806 * H),
    };

    console.log("=== X POSITION SCAN ===");
    console.log("Image:", W, "x", H);

    for (const [name, yPx] of Object.entries(yCenters)) {
      const rowData = ctx.getImageData(0, yPx, W, 1).data;
      const THRESH = 40;
      let inSeg = false, segStart = 0;
      const segs: { x1: number; x2: number; xF1: string; xF2: string; ctr: string }[] = [];
      for (let x = 0; x < W; x++) {
        const i = x * 4;
        const lum = 0.299 * rowData[i] + 0.587 * rowData[i + 1] + 0.114 * rowData[i + 2];
        if (lum > THRESH && !inSeg) { inSeg = true; segStart = x; }
        else if (lum <= THRESH && inSeg) {
          inSeg = false;
          if (x - segStart > 10) { // ignore tiny segments
            const ctr = (segStart + x) / 2;
            segs.push({ x1: segStart, x2: x, xF1: (segStart/W).toFixed(3), xF2: (x/W).toFixed(3), ctr: (ctr/W).toFixed(3) });
          }
        }
      }
      console.log(`${name} (y=${yPx}): ${segs.map(s => `[${s.xF1}-${s.xF2}]ctr=${s.ctr}`).join("  ")}`);
    }
    console.log("=== END X SCAN ===");
  } catch (e) {
    console.log("Scan error:", e);
  }
}

export default function App() {
  const [bounds, setBounds] = useState<Bounds>(calcBounds);
  const [gameActive, setGameActive] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  const [wrongBalls, setWrongBalls] = useState<number[][]>(randomWrongBalls);
  const [errorBall, setErrorBall] = useState<{ row: number; ball: number } | null>(null);
  const [justOkBall, setJustOkBall] = useState<{ row: number; ball: number } | null>(null);
  // All correct picks in this run — persists green trail until game over / reset
  const [correctPicks, setCorrectPicks] = useState<{ row: number; ball: number }[]>([]);
  const [jogarLit, setJogarLit] = useState(false);
  const [locked, setLocked] = useState(false);
  // Calibration state
  const [calibTaps, setCalibTaps] = useState<{ xF: string; yF: string }[]>([]);

  const reCalc = useCallback(() => setBounds(calcBounds()), []);

  useEffect(() => {
    window.addEventListener("resize", reCalc);
    window.visualViewport?.addEventListener("resize", reCalc);
    return () => {
      window.removeEventListener("resize", reCalc);
      window.visualViewport?.removeEventListener("resize", reCalc);
    };
  }, [reCalc]);

  // Overlay style helper (position: absolute within the fixed container)
  const ov = (xF: number, yF: number, wF: number, hF: number) => ({
    position: "absolute" as const,
    left: bounds.x + bounds.w * xF,
    top: bounds.y + bounds.h * yF,
    width: bounds.w * wF,
    height: bounds.h * hF,
  });

  // ── Calibration tap handler ──
  const handleCalibTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (!TOUCH_CALIB) return;
    let clientX: number, clientY: number;
    if ("changedTouches" in e && e.changedTouches.length > 0) {
      // touchend — most reliable on iOS
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else if ("touches" in e && e.touches.length > 0) {
      // touchstart fallback
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // mouse click (desktop)
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const xF = ((clientX - bounds.x) / bounds.w).toFixed(3);
    const yF = ((clientY - bounds.y) / bounds.h).toFixed(3);
    setCalibTaps(prev => [{ xF, yF }, ...prev].slice(0, 8));
  };

  // ── Game handlers ──
  const handleJogar = () => {
    if (TOUCH_CALIB) return;
    playClickSound();
    setJogarLit(true);
    setTimeout(() => setJogarLit(false), 400);
    setWrongBalls(randomWrongBalls());
    setCurrentRow(0);
    setErrorBall(null);
    setJustOkBall(null);
    setCorrectPicks([]);
    setLocked(false);
    setGameActive(true);
  };

  const handleBallClick = (rowIdx: number, ballIdx: number) => {
    if (!gameActive || rowIdx !== currentRow || locked) return;
    setLocked(true);
    if (wrongBalls[rowIdx].includes(ballIdx)) {
      // ── ERRO: bomba ──
      playBombSound();
      setErrorBall({ row: rowIdx, ball: ballIdx });
      setTimeout(() => {
        setErrorBall(null);
        setJustOkBall(null);
        setCorrectPicks([]);          // limpa trilha de acertos
        setCurrentRow(0);
        setWrongBalls(randomWrongBalls());
        setLocked(false);
      }, 1600);
    } else {
      // ── ACERTO: 5 notas crescentes ──
      playCorrectSound();
      const pick = { row: rowIdx, ball: ballIdx };
      setCorrectPicks(prev => [...prev, pick]); // mantém verde permanente
      setJustOkBall(pick);                       // flash de destaque
      setTimeout(() => {
        setJustOkBall(null);
        const next = rowIdx + 1;
        if (next >= TOTAL_ROWS) {
          setGameActive(false);
          setCurrentRow(0);
        } else {
          setCurrentRow(next);
          setLocked(false);
        }
      }, 700);
    }
  };

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
        onLoad={(e) => scanImageRows(e.currentTarget)}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />

      {/* ── JOGAR ── */}
      <div
        onClick={handleJogar}
        style={{
          ...ov(0.030, 0.860, 0.560, 0.052),
          position: "absolute",
          borderRadius: 8,
          cursor: "pointer",
          background: DEBUG ? "rgba(255,0,0,0.4)"
            : jogarLit ? "rgba(255,200,50,0.45)" : "transparent",
          boxShadow: !DEBUG && jogarLit ? "0 0 24px 8px rgba(255,180,0,0.7)" : "none",
          zIndex: 10,
          border: DEBUG ? "2px solid red" : "none",
        }}
      />

      {/* ── Ball overlays ── */}
      {ROWS.map((row, rowIdx) => {
        const [yS, yE] = row.y;
        const rowH = yE - yS;
        const isActive = gameActive && rowIdx === currentRow;
        const col = ROW_COLORS[rowIdx];

        return row.x.map(([xS, xE], ballIdx) => {
          const xW = xE - xS;
          const isErr  = errorBall?.row === rowIdx && errorBall?.ball === ballIdx;
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
                position: "absolute",
                borderRadius: "50%",
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isActive ? "pointer" : "default",
                background: DEBUG ? `${col}44` : "transparent",
                outline: DEBUG ? `2px solid ${col}` : "none",
                pointerEvents: (isActive && !TOUCH_CALIB) ? "auto" : "none",
              }}
            >
              {DEBUG && (
                <span style={{ fontSize: 8, color: "#fff", fontWeight: 900, textShadow: "0 0 3px #000" }}>
                  {row.label}B{ballIdx}
                </span>
              )}
              {/* Visual circle */}
              {!DEBUG && showCircle && (
                <div style={{
                  width: "62%",
                  height: "62%",
                  borderRadius: "50%",
                  // Erro = vermelho escuro; acerto trail = verde; acerto flash = verde brilhante; ativo = amarelo sutil
                  background: isErr
                    ? "rgba(180,20,20,0.25)"
                    : isCorrect
                    ? (isJustOk ? "rgba(60,255,80,0.45)" : "rgba(60,220,80,0.28)")
                    : "rgba(255,220,50,0.08)",
                  outline: isErr
                    ? "2px solid rgba(255,60,60,0.60)"
                    : isCorrect
                    ? "2.5px solid rgba(60,255,100,0.80)"
                    : "2px solid rgba(255,220,50,0.50)",
                  boxShadow: isErr
                    ? "0 0 18px 6px rgba(255,30,0,0.55)"
                    : isCorrect
                    ? (isJustOk
                        ? "0 0 22px 8px rgba(50,255,80,0.75)"
                        : "0 0 12px 4px rgba(50,220,80,0.50)")
                    : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  transition: "box-shadow 0.3s ease",
                }}>
                  {/* Erro: 💣 bomba */}
                  {isErr && (
                    <span style={{
                      fontSize: Math.max(bounds.w * xW * 0.50, 14),
                      lineHeight: 1, userSelect: "none",
                      filter: "drop-shadow(0 0 8px rgba(255,80,0,0.9))",
                    }}>💣</span>
                  )}
                  {/* Acerto trail: ✓ discreto */}
                  {isCorrect && !isErr && (
                    <span style={{
                      fontSize: Math.max(bounds.w * xW * 0.38, 10),
                      color: isJustOk ? "#afffb0" : "#70ff90",
                      fontWeight: 900,
                      lineHeight: 1, userSelect: "none",
                      textShadow: "0 0 6px rgba(80,255,100,0.7)",
                    }}>✓</span>
                  )}
                </div>
              )}
            </div>
          );
        });
      })}

      {/* ── CALIBRATION OVERLAY ── */}
      {TOUCH_CALIB && (
        <>
          {/* Instruction banner */}
          <div style={{
            position: "absolute", top: 8, left: 0, right: 0,
            textAlign: "center", zIndex: 200, pointerEvents: "none",
          }}>
            <span style={{
              background: "rgba(0,0,0,0.85)", color: "#FFD700",
              fontSize: 13, fontWeight: 900, padding: "4px 12px",
              borderRadius: 8, letterSpacing: 0.5,
            }}>
              MODO CALIBRAÇÃO — Toque no centro de cada bola
            </span>
          </div>

          {/* Tap log */}
          <div style={{
            position: "absolute", top: 40, left: 8,
            background: "rgba(0,0,0,0.88)", color: "#fff",
            fontSize: 11, padding: "6px 10px", borderRadius: 8,
            zIndex: 200, pointerEvents: "none", lineHeight: 1.8,
            minWidth: 160,
          }}>
            <div style={{ color: "#FFD700", fontWeight: 900, marginBottom: 2 }}>Últimos toques:</div>
            {calibTaps.length === 0 && <div style={{ color: "#aaa" }}>nenhum ainda</div>}
            {calibTaps.map((t, i) => (
              <div key={i} style={{ color: i === 0 ? "#0f0" : "#ccc" }}>
                x: {t.xF} &nbsp; <strong>y: {t.yF}</strong>
              </div>
            ))}
          </div>

          {/* Current bounds info */}
          <div style={{
            position: "absolute", bottom: 70, right: 6,
            background: "rgba(0,0,0,0.8)", color: "#aaa",
            fontSize: 9, padding: "3px 6px", borderRadius: 6,
            zIndex: 200, pointerEvents: "none", lineHeight: 1.5,
          }}>
            img {bounds.w.toFixed(0)}×{bounds.h.toFixed(0)}<br />
            vp {window.innerWidth}×{window.innerHeight}
          </div>
        </>
      )}
    </div>
  );
}
