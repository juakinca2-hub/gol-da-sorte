import { useState, useRef, useEffect, useCallback } from "react";
import golDaSorteImg from "@assets/IMG_7715_1780523556282.jpeg";

// Image natural dimensions (confirmed: 1125 x 2175)
const NAT_W = 1125;
const NAT_H = 2175;
const NAT_RATIO = NAT_W / NAT_H; // 0.5172...

const DEBUG = false;
const CALIBRATE = false;

function getAudioCtx() {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
}
function playClickSound() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
}
function playErrorSound() {
  const ctx = getAudioCtx();
  [200, 170, 140].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.11);
    osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.11);
  });
}
function playSuccessSound() {
  const ctx = getAudioCtx();
  [600, 800, 1000].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
    gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.09);
    osc.start(ctx.currentTime + i * 0.1); osc.stop(ctx.currentTime + i * 0.1 + 0.09);
  });
}

// ── Row definitions (fractions of the rendered image height/width) ──
// y: [top, bottom] as fraction of image HEIGHT
// x: [[left,right], ...] as fraction of image WIDTH — 3 balls per row
// Index 0 = bottom row (nearest to JOGAR), advances upward
type RowDef = { y: [number, number]; x: [number, number][]; label: string };

const ROWS: RowDef[] = [
  // R0 — plain bottom row
  { label: "R0", y: [0.720, 0.800], x: [[0.048, 0.228], [0.238, 0.418], [0.428, 0.608]] },
  // R1 — plain row
  { label: "R1", y: [0.635, 0.715], x: [[0.048, 0.228], [0.238, 0.418], [0.428, 0.608]] },
  // R2 — plain row
  { label: "R2", y: [0.548, 0.628], x: [[0.048, 0.228], [0.238, 0.418], [0.428, 0.608]] },
  // R3 — Valendo +1 (label on left, balls shifted right)
  { label: "R3", y: [0.462, 0.542], x: [[0.175, 0.348], [0.358, 0.530], [0.540, 0.680]] },
  // R4 — Valendo +5 (label on left, balls shifted right)
  { label: "R4", y: [0.322, 0.402], x: [[0.175, 0.348], [0.358, 0.530], [0.540, 0.680]] },
  // R5 — Prize row (top)
  { label: "R5", y: [0.142, 0.222], x: [[0.048, 0.228], [0.238, 0.418], [0.428, 0.608]] },
];

// Rows 0,1 = 1 wrong (2 correct); Rows 2,3,4 = 2 wrong (1 correct); Row 5 = 1 wrong (2 correct)
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

type ImgBounds = { x: number; y: number; w: number; h: number };

function calcBounds(containerW: number, containerH: number): ImgBounds {
  const conRatio = containerW / containerH;
  let w: number, h: number, x: number, y: number;
  if (conRatio > NAT_RATIO) {
    // container is wider → constrained by height
    h = containerH; w = h * NAT_RATIO;
    x = (containerW - w) / 2; y = 0;
  } else {
    // container is taller → constrained by width
    w = containerW; h = w / NAT_RATIO;
    x = 0; y = (containerH - h) / 2;
  }
  return { x, y, w, h };
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<ImgBounds>({ x: 0, y: 0, w: 0, h: 0 });

  const [gameActive, setGameActive] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  const [wrongBalls, setWrongBalls] = useState<number[][]>(randomWrongBalls);
  const [errorBall, setErrorBall] = useState<{ row: number; ball: number } | null>(null);
  const [successBall, setSuccessBall] = useState<{ row: number; ball: number } | null>(null);
  const [jogarLit, setJogarLit] = useState(false);
  const [locked, setLocked] = useState(false);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // Use innerWidth/innerHeight for accurate visual viewport (handles mobile URL bar)
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    setBounds(calcBounds(cw, ch));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    // Also listen to visual viewport changes (mobile URL bar collapse)
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", measure);
    }
    return () => {
      window.removeEventListener("resize", measure);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", measure);
      }
    };
  }, [measure]);

  // Helper: style for an overlay rect, using absolute positioning inside the container
  // xF, yF = top-left corner as fraction of image; wF, hF = size as fraction of image
  const ov = (xF: number, yF: number, wF: number, hF: number) => ({
    position: "absolute" as const,
    left: bounds.x + bounds.w * xF,
    top: bounds.y + bounds.h * yF,
    width: bounds.w * wF,
    height: bounds.h * hF,
  });

  const handleJogar = () => {
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
    const isWrong = wrongBalls[rowIdx].includes(ballIdx);
    if (isWrong) {
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
    // Outer container: fixed to cover exactly the visual viewport
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      {/* The background image */}
      <img
        src={golDaSorteImg}
        alt="Gol da Sorte"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />

      {/* ── JOGAR button overlay ── */}
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
        const color = ROW_COLORS[rowIdx];
        const isActive = gameActive && rowIdx === currentRow;

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
                background: DEBUG
                  ? `${color}44`
                  : isOk ? "rgba(100,255,100,0.28)"
                  : isActive ? "rgba(255,220,50,0.06)"
                  : "transparent",
                outline: DEBUG
                  ? `2px solid ${color}`
                  : isActive ? "2px solid rgba(255,220,50,0.30)" : "none",
                boxShadow: !DEBUG && isOk ? "0 0 18px 6px rgba(80,255,80,0.55)" : "none",
                pointerEvents: (isActive || DEBUG) ? "auto" : "none",
              }}
            >
              {DEBUG && (
                <span style={{
                  fontSize: 8, color: "#fff", fontWeight: 900,
                  textShadow: "0 0 3px #000", textAlign: "center", lineHeight: 1.3,
                  pointerEvents: "none",
                }}>
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

      {/* ── Calibration lines (CALIBRATE mode) ── */}
      {CALIBRATE && ROWS.map((row, ri) => {
        const [yS, yE] = row.y;
        const yC = (yS + yE) / 2;
        const col = ROW_COLORS[ri];
        return [
          { yF: yS, lbl: `${row.label} top ${yS.toFixed(3)}` },
          { yF: yC, lbl: `${row.label} CTR ${yC.toFixed(3)}` },
          { yF: yE, lbl: `${row.label} bot ${yE.toFixed(3)}` },
        ].map(({ yF, lbl }, li) => (
          <div key={`cl-${ri}-${li}`} style={{
            position: "absolute",
            left: bounds.x,
            top: bounds.y + bounds.h * yF,
            width: bounds.w * 0.70,
            height: 1,
            background: col,
            zIndex: 50,
            pointerEvents: "none",
          }}>
            <span style={{
              position: "absolute", left: 2, top: -9,
              fontSize: 7, color: col, fontWeight: 900,
              textShadow: "0 0 3px #000", whiteSpace: "nowrap",
            }}>{lbl}</span>
          </div>
        ));
      })}

      {/* ── Debug info box ── */}
      {CALIBRATE && bounds.w > 0 && (
        <div style={{
          position: "absolute", bottom: 60, right: 4,
          background: "rgba(0,0,0,0.85)", color: "#fff",
          fontSize: 8, padding: "3px 5px", zIndex: 100,
          borderRadius: 3, pointerEvents: "none", lineHeight: 1.5,
        }}>
          img {bounds.w.toFixed(0)}×{bounds.h.toFixed(0)}<br />
          top:{bounds.y.toFixed(1)} left:{bounds.x.toFixed(1)}<br />
          vp:{window.innerWidth}×{window.innerHeight}
        </div>
      )}
    </div>
  );
}
