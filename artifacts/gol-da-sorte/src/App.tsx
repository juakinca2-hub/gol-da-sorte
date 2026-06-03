import { useState, useRef, useEffect, useCallback } from "react";
import golDaSorteImg from "@assets/IMG_7715_1780523556282.jpeg";

// ── Audio helpers ──────────────────────────────────────────────────────────────
function getAudioCtx() {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
}

function playClickSound() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
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
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.11);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.11);
  });
}

function playSuccessSound() {
  const ctx = getAudioCtx();
  [600, 800, 1000].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
    gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.09);
    osc.start(ctx.currentTime + i * 0.1);
    osc.stop(ctx.currentTime + i * 0.1 + 0.09);
  });
}

// ── Game constants ─────────────────────────────────────────────────────────────
// Rows ordered bottom→top (index 0 = start row, near JOGAR)
// Each entry: [yStart, yEnd] as fraction of image height
const ROWS = [
  [0.799, 0.866], // Row 0 — bottom (near JOGAR)
  [0.718, 0.784], // Row 1
  [0.637, 0.703], // Row 2 — Valendo +1
  [0.476, 0.543], // Row 3 — Valendo +5
  [0.178, 0.245], // Row 4 — top prize row
];

// Ball x ranges [left, right] as fraction of image width (left panel, 3 balls)
const BALLS_X = [
  [0.048, 0.183],
  [0.191, 0.326],
  [0.332, 0.466],
];

const TOTAL_ROWS = ROWS.length;

function randomWrongBalls() {
  return Array.from({ length: TOTAL_ROWS }, () => Math.floor(Math.random() * 3));
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function App() {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgBounds, setImgBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });

  // Game state
  const [gameActive, setGameActive] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  const [wrongBalls, setWrongBalls] = useState<number[]>(randomWrongBalls);
  const [errorBall, setErrorBall] = useState<{ row: number; ball: number } | null>(null);
  const [successBall, setSuccessBall] = useState<{ row: number; ball: number } | null>(null);
  const [jogarLit, setJogarLit] = useState(false);
  const [locked, setLocked] = useState(false); // prevent double-click during animation

  // ── Image layout ─────────────────────────────────────────────────────────────
  const updateBounds = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const naturalRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = rect.width / rect.height;
    let rW: number, rH: number, oX: number, oY: number;
    if (containerRatio > naturalRatio) {
      rH = rect.height; rW = rH * naturalRatio;
      oX = rect.left + (rect.width - rW) / 2; oY = rect.top;
    } else {
      rW = rect.width; rH = rW / naturalRatio;
      oX = rect.left; oY = rect.top + (rect.height - rH) / 2;
    }
    setImgBounds({ left: oX, top: oY, width: rW, height: rH });
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete) updateBounds();
    img.addEventListener("load", updateBounds);
    window.addEventListener("resize", updateBounds);
    return () => {
      img.removeEventListener("load", updateBounds);
      window.removeEventListener("resize", updateBounds);
    };
  }, [updateBounds]);

  // ── Helpers to position overlays ─────────────────────────────────────────────
  const rect = (xFrac: number, yFrac: number, wFrac: number, hFrac: number) => ({
    position: "fixed" as const,
    left: imgBounds.left + imgBounds.width * xFrac,
    top: imgBounds.top + imgBounds.height * yFrac,
    width: imgBounds.width * wFrac,
    height: imgBounds.height * hFrac,
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleJogar = () => {
    playClickSound();
    setJogarLit(true);
    setTimeout(() => setJogarLit(false), 400);

    // Start / restart game
    setWrongBalls(randomWrongBalls());
    setCurrentRow(0);
    setErrorBall(null);
    setSuccessBall(null);
    setLocked(false);
    setGameActive(true);
  };

  const handleBallClick = (rowIndex: number, ballIndex: number) => {
    if (!gameActive) return;
    if (rowIndex !== currentRow) return;
    if (locked) return;

    setLocked(true);

    if (ballIndex === wrongBalls[rowIndex]) {
      // ── WRONG ──
      playErrorSound();
      setErrorBall({ row: rowIndex, ball: ballIndex });

      setTimeout(() => {
        setErrorBall(null);
        setCurrentRow(0);
        setWrongBalls(randomWrongBalls());
        setLocked(false);
        // game stays active, restarts at row 0
      }, 1400);
    } else {
      // ── CORRECT ──
      playSuccessSound();
      setSuccessBall({ row: rowIndex, ball: ballIndex });

      setTimeout(() => {
        setSuccessBall(null);
        const next = rowIndex + 1;
        if (next >= TOTAL_ROWS) {
          // won!
          setGameActive(false);
          setCurrentRow(0);
        } else {
          setCurrentRow(next);
          setLocked(false);
        }
      }, 600);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0, overflow: "hidden", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img
        ref={imgRef}
        src={golDaSorteImg}
        alt="Gol da Sorte"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />

      {/* ── JOGAR button ── */}
      <div
        onClick={handleJogar}
        style={{
          ...rect(0.045, 0.872, 0.535, 0.048),
          borderRadius: 8,
          cursor: "pointer",
          background: jogarLit ? "rgba(255,200,50,0.45)" : "transparent",
          boxShadow: jogarLit ? "0 0 24px 8px rgba(255,180,0,0.7)" : "none",
          transition: "background 0.1s, box-shadow 0.1s",
          zIndex: 10,
        }}
      />

      {/* ── Ball overlays for each row ── */}
      {ROWS.map(([yStart, yEnd], rowIdx) => {
        const isActive = gameActive && rowIdx === currentRow;
        const rowH = yEnd - yStart;

        return BALLS_X.map(([xStart, xEnd], ballIdx) => {
          const isError = errorBall?.row === rowIdx && errorBall?.ball === ballIdx;
          const isSuccess = successBall?.row === rowIdx && successBall?.ball === ballIdx;
          const xW = xEnd - xStart;

          return (
            <div
              key={`${rowIdx}-${ballIdx}`}
              onClick={() => handleBallClick(rowIdx, ballIdx)}
              style={{
                ...rect(xStart, yStart, xW, rowH),
                cursor: isActive ? "pointer" : "default",
                borderRadius: "50%",
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isSuccess
                  ? "rgba(100,255,100,0.30)"
                  : isActive
                  ? "rgba(255,220,50,0.08)"
                  : "transparent",
                boxShadow: isSuccess
                  ? "0 0 18px 6px rgba(80,255,80,0.6)"
                  : isActive
                  ? "0 0 10px 2px rgba(255,220,50,0.25)"
                  : "none",
                transition: "background 0.15s, box-shadow 0.15s",
                outline: isActive ? "2px solid rgba(255,220,50,0.35)" : "none",
                pointerEvents: isActive ? "auto" : "none",
              }}
            >
              {isError && (
                <span style={{
                  fontSize: Math.max(imgBounds.width * xW * 0.7, 14),
                  fontWeight: 900,
                  color: "#ff2222",
                  textShadow: "0 0 10px #ff0000, 0 0 20px #ff0000",
                  lineHeight: 1,
                  userSelect: "none",
                  pointerEvents: "none",
                }}>✕</span>
              )}
            </div>
          );
        });
      })}
    </div>
  );
}
