import { useState, useRef, useEffect, useCallback } from "react";
import golDaSorteImg from "@assets/IMG_7715_1780523556282.jpeg";

// ── Image natural dimensions (confirmed 1125 × 2175) ──
const NAT_W = 1125;
const NAT_H = 2175;
const NAT_RATIO = NAT_W / NAT_H;

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

// Y positions derived from pixel scan of original image (1125×2175)
// Ball centers: R0=0.806, R1=0.697, R2=0.587, R3=0.466, R4=0.359, R5=0.255
// Each row: center ± 0.042 for click area
const ROWS: RowDef[] = [
  { label: "R0", y: [0.764, 0.848], x: [[0.048, 0.210], [0.218, 0.382], [0.390, 0.553]] },
  { label: "R1", y: [0.655, 0.739], x: [[0.048, 0.210], [0.218, 0.382], [0.390, 0.553]] },
  { label: "R2", y: [0.545, 0.629], x: [[0.048, 0.210], [0.218, 0.382], [0.390, 0.553]] },
  { label: "R3", y: [0.424, 0.508], x: [[0.198, 0.360], [0.368, 0.530], [0.538, 0.670]] },
  { label: "R4", y: [0.317, 0.401], x: [[0.198, 0.360], [0.368, 0.530], [0.538, 0.670]] },
  { label: "R5", y: [0.213, 0.297], x: [[0.048, 0.210], [0.218, 0.382], [0.390, 0.553]] },
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
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
  g.gain.setValueAtTime(0.4, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.start(); osc.stop(ctx.currentTime + 0.12);
}
function playErrorSound() {
  const ctx = getAudioCtx();
  [200, 170, 140].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
    g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.11);
    osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.11);
  });
}
function playSuccessSound() {
  const ctx = getAudioCtx();
  [600, 800, 1000].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
    g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.09);
    osc.start(ctx.currentTime + i * 0.1); osc.stop(ctx.currentTime + i * 0.1 + 0.09);
  });
}

// ── Pixel scanner: runs once after image loads, logs ball row positions ──
function scanImageRows(imgEl: HTMLImageElement) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(imgEl, 0, 0);
    const W = imgEl.naturalWidth;
    const H = imgEl.naturalHeight;
    const gameW = Math.floor(W * 0.60); // left game panel only
    
    // For each row, compute average luminance in game area
    const lum: number[] = [];
    for (let y = 0; y < H; y++) {
      const data = ctx.getImageData(30, y, gameW, 1).data;
      let total = 0, cnt = 0;
      for (let i = 0; i < data.length; i += 16) {
        total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        cnt++;
      }
      lum.push(total / cnt);
    }
    
    // Find bright bands (lum > 50) = ball rows; dark = shelves/background
    const THRESHOLD = 50;
    let inBand = false, bandStart = 0;
    const bands: { y1: number; y2: number; yF1: string; yF2: string; yCtr: string }[] = [];
    for (let y = 0; y < H; y++) {
      if (lum[y] > THRESHOLD && !inBand) { inBand = true; bandStart = y; }
      else if (lum[y] <= THRESHOLD && inBand) {
        inBand = false;
        const ctr = (bandStart + y) / 2;
        if (y - bandStart > 20) { // ignore tiny bands
          bands.push({
            y1: bandStart, y2: y,
            yF1: (bandStart / H).toFixed(3),
            yF2: (y / H).toFixed(3),
            yCtr: (ctr / H).toFixed(3),
          });
        }
      }
    }
    console.log("=== BALL ROW SCAN ===");
    console.log("Image:", W, "x", H);
    bands.forEach((b, i) => {
      console.log(`Band ${i}: y=${b.y1}-${b.y2} → yFrac=[${b.yF1}, ${b.yF2}] center=${b.yCtr}`);
    });
    console.log("=== END SCAN ===");
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
  const [successBall, setSuccessBall] = useState<{ row: number; ball: number } | null>(null);
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
    const clientX = "touches" in e
      ? e.touches[0]?.clientX ?? (e as any).clientX
      : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e
      ? e.touches[0]?.clientY ?? (e as any).clientY
      : (e as React.MouseEvent).clientY;
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
    setSuccessBall(null);
    setLocked(false);
    setGameActive(true);
  };

  const handleBallClick = (rowIdx: number, ballIdx: number) => {
    if (!gameActive || rowIdx !== currentRow || locked) return;
    setLocked(true);
    if (wrongBalls[rowIdx].includes(ballIdx)) {
      playErrorSound();
      setErrorBall({ row: rowIdx, ball: ballIdx });
      setTimeout(() => {
        setErrorBall(null);
        setCurrentRow(0);
        setWrongBalls(randomWrongBalls());
        setLocked(false);
      }, 1400);
    } else {
      playSuccessSound();
      setSuccessBall({ row: rowIdx, ball: ballIdx });
      setTimeout(() => {
        setSuccessBall(null);
        const next = rowIdx + 1;
        if (next >= TOTAL_ROWS) {
          setGameActive(false);
          setCurrentRow(0);
        } else {
          setCurrentRow(next);
          setLocked(false);
        }
      }, 600);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden" }}
      onClick={TOUCH_CALIB ? handleCalibTap : undefined}
      onTouchStart={TOUCH_CALIB ? handleCalibTap : undefined}
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
          const isErr = errorBall?.row === rowIdx && errorBall?.ball === ballIdx;
          const isOk = successBall?.row === rowIdx && successBall?.ball === ballIdx;

          return (
            <div
              key={`${rowIdx}-${ballIdx}`}
              onClick={() => handleBallClick(rowIdx, ballIdx)}
              style={{
                ...ov(xS, yS, xW, rowH),
                position: "absolute",
                borderRadius: "50%",
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isActive ? "pointer" : "default",
                background: DEBUG ? `${col}44`
                  : isOk ? "rgba(100,255,100,0.28)"
                  : isActive ? "rgba(255,220,50,0.06)"
                  : "transparent",
                outline: DEBUG ? `2px solid ${col}`
                  : isActive ? "2px solid rgba(255,220,50,0.30)" : "none",
                boxShadow: !DEBUG && isOk ? "0 0 18px 6px rgba(80,255,80,0.55)" : "none",
                pointerEvents: (isActive && !TOUCH_CALIB) ? "auto" : "none",
              }}
            >
              {DEBUG && (
                <span style={{ fontSize: 8, color: "#fff", fontWeight: 900, textShadow: "0 0 3px #000" }}>
                  {row.label}B{ballIdx}
                </span>
              )}
              {!DEBUG && isErr && (
                <span style={{
                  fontSize: Math.max(bounds.w * xW * 0.60, 14),
                  fontWeight: 900, color: "#ff2222",
                  textShadow: "0 0 10px #ff0000",
                  lineHeight: 1, userSelect: "none",
                }}>✕</span>
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
