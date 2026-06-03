import { useState, useRef, useEffect, useCallback } from "react";
import golDaSorteImg from "@assets/IMG_7715_1780523556282.jpeg";

const DEBUG = false;

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

// Each row: yStart, yEnd (fraction of image height), plus per-row ball x ranges
// Index 0 = bottom row near JOGAR, game advances upward
type RowDef = { y: [number, number]; x: [number, number][]; label: string };

const ROWS: RowDef[] = [
  {
    label: "R0-BOTTOM",
    y: [0.760, 0.826],
    x: [[0.122, 0.287], [0.295, 0.460], [0.468, 0.630]],
  },
  {
    label: "R1-PLAIN",
    y: [0.676, 0.742],
    x: [[0.122, 0.287], [0.295, 0.460], [0.468, 0.630]],
  },
  {
    label: "R2-PLAIN",
    y: [0.593, 0.659],
    x: [[0.122, 0.287], [0.295, 0.460], [0.468, 0.630]],
  },
  {
    label: "R3-VAL+1",
    y: [0.509, 0.575],
    x: [[0.205, 0.368], [0.376, 0.538], [0.546, 0.675]],
  },
  {
    label: "R4-VAL+5",
    y: [0.368, 0.434],
    x: [[0.205, 0.368], [0.376, 0.538], [0.546, 0.675]],
  },
  {
    label: "R5-PRIZE",
    y: [0.188, 0.254],
    x: [[0.122, 0.287], [0.295, 0.460], [0.468, 0.630]],
  },
];

const ROW_COLORS = ["#ff0", "#0ff", "#0f0", "#f80", "#f0f", "#fff"];
const TOTAL_ROWS = ROWS.length;

function randomWrongBalls() {
  return Array.from({ length: TOTAL_ROWS }, () => Math.floor(Math.random() * 3));
}

export default function App() {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgBounds, setImgBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [gameActive, setGameActive] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  const [wrongBalls, setWrongBalls] = useState<number[]>(randomWrongBalls);
  const [errorBall, setErrorBall] = useState<{ row: number; ball: number } | null>(null);
  const [successBall, setSuccessBall] = useState<{ row: number; ball: number } | null>(null);
  const [jogarLit, setJogarLit] = useState(false);
  const [locked, setLocked] = useState(false);

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

  const rs = (xF: number, yF: number, wF: number, hF: number) => ({
    position: "fixed" as const,
    left: imgBounds.left + imgBounds.width * xF,
    top: imgBounds.top + imgBounds.height * yF,
    width: imgBounds.width * wF,
    height: imgBounds.height * hF,
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
    if (ballIdx === wrongBalls[rowIdx]) {
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
    <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0, overflow: "hidden", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img
        ref={imgRef}
        src={golDaSorteImg}
        alt="Gol da Sorte"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />

      {/* JOGAR */}
      <div
        onClick={handleJogar}
        style={{
          ...rs(0.030, 0.848, 0.562, 0.054),
          borderRadius: 8,
          cursor: "pointer",
          background: DEBUG ? "rgba(255,0,0,0.4)" : jogarLit ? "rgba(255,200,50,0.45)" : "transparent",
          boxShadow: !DEBUG && jogarLit ? "0 0 24px 8px rgba(255,180,0,0.7)" : "none",
          zIndex: 10,
          border: DEBUG ? "2px solid red" : "none",
        }}
      />

      {/* Ball overlays */}
      {ROWS.map((row, rowIdx) => {
        const [yStart, yEnd] = row.y;
        const rowH = yEnd - yStart;
        const color = ROW_COLORS[rowIdx];

        return row.x.map(([xStart, xEnd], ballIdx) => {
          const xW = xEnd - xStart;
          const isError = errorBall?.row === rowIdx && errorBall?.ball === ballIdx;
          const isSuccess = successBall?.row === rowIdx && successBall?.ball === ballIdx;
          const isActive = gameActive && rowIdx === currentRow;

          return (
            <div
              key={`${rowIdx}-${ballIdx}`}
              onClick={() => handleBallClick(rowIdx, ballIdx)}
              style={{
                ...rs(xStart, yStart, xW, rowH),
                cursor: isActive ? "pointer" : "default",
                borderRadius: "50%",
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: DEBUG
                  ? `${color}33`
                  : isSuccess
                  ? "rgba(100,255,100,0.30)"
                  : isActive
                  ? "rgba(255,220,50,0.08)"
                  : "transparent",
                outline: DEBUG ? `2px solid ${color}` : isActive ? "2px solid rgba(255,220,50,0.35)" : "none",
                boxShadow: !DEBUG && isSuccess ? "0 0 18px 6px rgba(80,255,80,0.6)" : "none",
                pointerEvents: isActive || DEBUG ? "auto" : "none",
              }}
            >
              {DEBUG && (
                <span style={{ fontSize: 7, color: "#fff", fontWeight: 900, userSelect: "none", textShadow: "0 0 3px #000" }}>
                  {row.label}<br />B{ballIdx}
                </span>
              )}
              {!DEBUG && isError && (
                <span style={{ fontSize: Math.max(imgBounds.width * xW * 0.65, 14), fontWeight: 900, color: "#ff2222", textShadow: "0 0 10px #ff0000", lineHeight: 1, userSelect: "none" }}>✕</span>
              )}
            </div>
          );
        });
      })}
    </div>
  );
}
