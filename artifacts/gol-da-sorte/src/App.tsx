import { useState, useEffect, useCallback, useRef } from "react";
import golDaSorteImg from "@assets/IMG_7715_1780523556282.jpeg";
import RegisterScreen from "./components/RegisterScreen";
import PurchaseModal from "./components/PurchaseModal";
import InviteScreen from "./components/InviteScreen";
import InstallPrompt from "./components/InstallPrompt";
import AdminPanel from "./components/AdminPanel";

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
  { label: "R0", y: [0.771, 0.855], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R1", y: [0.661, 0.745], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R2", y: [0.551, 0.635], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R3", y: [0.434, 0.518], x: [[0.183, 0.330], [0.327, 0.434], [0.435, 0.544]] },
  { label: "R4", y: [0.324, 0.408], x: [[0.183, 0.330], [0.327, 0.434], [0.435, 0.544]] },
  { label: "R5", y: [0.220, 0.304], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
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

function playFanfareSound(big: boolean) {
  const ctx = getAudioCtx();
  const notes = big
    ? [392, 523, 659, 784, 1047]
    : [392, 523, 659, 784];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc2.connect(g2); g2.connect(ctx.destination);
    osc.type = "sawtooth"; osc2.type = "square";
    const t = ctx.currentTime + i * 0.18;
    osc.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 0.5, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t); osc.stop(t + 0.3);
    osc2.start(t); osc2.stop(t + 0.28);
  });
  if (big) {
    const sr = ctx.sampleRate; const dur = 0.25;
    const buf = ctx.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const snareG = ctx.createGain();
    snareG.gain.setValueAtTime(0.8, ctx.currentTime + notes.length * 0.18);
    noise.connect(snareG); snareG.connect(ctx.destination);
    noise.start(ctx.currentTime + notes.length * 0.18);
  }
}

function playMegaFanfare() {
  const ctx = getAudioCtx();
  // Epic trumpet fanfare: two rising phrases + final chord
  const phrase = [
    { freq: 523, t: 0.00, dur: 0.18 },
    { freq: 659, t: 0.20, dur: 0.18 },
    { freq: 784, t: 0.40, dur: 0.18 },
    { freq: 1047, t: 0.60, dur: 0.35 },
    { freq: 784, t: 1.05, dur: 0.12 },
    { freq: 880, t: 1.20, dur: 0.12 },
    { freq: 988, t: 1.35, dur: 0.12 },
    { freq: 1175, t: 1.50, dur: 0.55 },
  ];
  phrase.forEach(({ freq, t, dur }) => {
    ["sawtooth", "square"].forEach((type, j) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = type as OscillatorType;
      osc.frequency.setValueAtTime(freq * (j === 1 ? 0.5 : 1), ctx.currentTime + t);
      const vol = j === 0 ? 0.45 : 0.15;
      g.gain.setValueAtTime(0, ctx.currentTime + t);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur + 0.05);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + dur + 0.1);
    });
  });
  // Final chord at 2.2s
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + 2.2);
    g.gain.setValueAtTime(0.3 - i * 0.05, ctx.currentTime + 2.2);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.2);
    osc.start(ctx.currentTime + 2.2);
    osc.stop(ctx.currentTime + 3.3);
  });
  // Snare rolls
  [0.0, 0.6, 1.5, 2.2].forEach(t => {
    const sr = ctx.sampleRate; const dur = 0.18;
    const buf = ctx.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const n = ctx.createBufferSource(); n.buffer = buf;
    const g = ctx.createGain(); g.gain.setValueAtTime(1.2, ctx.currentTime + t);
    n.connect(g); g.connect(ctx.destination);
    n.start(ctx.currentTime + t); n.stop(ctx.currentTime + t + dur);
  });
}

function speakMessage(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  utter.rate = 0.88;
  utter.pitch = 1.1;
  utter.volume = 1.0;
  // Delay a bit so fanfare starts first
  setTimeout(() => window.speechSynthesis.speak(utter), 1400);
}

// ── Confetti canvas component ──
type ConfettiPiece = {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; color: string; rot: number; rotV: number;
};
const CONFETTI_COLORS = ["#FFD700","#FF6B35","#00FF88","#FF1493","#00BFFF","#FF4500","#ADFF2F","#FF69B4","#fff","#f0f"];

function ConfettiCanvas({ active, mega, onDone }: { active: boolean; mega?: boolean; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const count = mega ? 400 : 140;
    const pieces: ConfettiPiece[] = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height * (mega ? 1.2 : 0.5) - 20,
      vx: (Math.random() - 0.5) * (mega ? 12 : 7),
      vy: Math.random() * (mega ? 6 : 4) + 3,
      w: Math.random() * (mega ? 18 : 12) + 6,
      h: Math.random() * (mega ? 10 : 7) + 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.25,
    }));
    let frame = 0;
    const maxFrames = mega ? 420 : 220;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let allBelow = true;
      for (const p of pieces) {
        p.x += p.vx + Math.sin(frame * 0.03 + p.rotV) * 0.8;
        p.y += p.vy;
        p.vy += 0.08;
        p.rot += p.rotV;
        if (p.y < canvas.height + 30) allBelow = false;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frame++;
      if (frame < maxFrames && !allBelow) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, onDone]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 500, pointerEvents: "none" }}
    />
  );
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
  const [totalFriends, setTotalFriends] = useState<number>(0);
  const [valorAcumulado, setValorAcumulado] = useState<string>("0,00");
  const [showAdmin, setShowAdmin] = useState(() =>
    new URLSearchParams(window.location.search).get("admin") === "1" ||
    window.location.hash === "#admin"
  );
  const adminTapCount = useRef(0);
  const adminTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ultimoGanhador, setUltimoGanhador] = useState<{
    nome: string; cidadeEstado: string; valor: string; foto: string;
  } | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showInviteScreen, setShowInviteScreen] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [bonusCelebration, setBonusCelebration] = useState<{ amount: number; big: boolean } | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [broadcastModal, setBroadcastModal] = useState<string | null>(null);
  const [megaActive, setMegaActive] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoConfig, setPromoConfig] = useState({
    ativa: true,
    titulo: "GANHE 100 JOGADAS GRÁTIS",
    meta1Indicacoes: "20",
    meta1Jogadas: "50",
    meta2Indicacoes: "30",
    meta2Dias: "30",
    meta2Jogadas: "100",
    bonusPorIndicacao: "3",
  });

  const referralCodeFromUrl = getReferralCodeFromUrl();
  // Só mostra o botão Admin para quem acessou com ?admin=1 na URL
  const isAdminMode = useRef(
    new URLSearchParams(window.location.search).get("admin") === "1" ||
    window.location.hash === "#admin"
  ).current;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const triggerBonus = useCallback(async (amount: number) => {
    const big = amount >= 5;
    playFanfareSound(big);
    setConfettiActive(true);
    setBonusCelebration({ amount, big });
    // Update counter immediately (optimistic)
    setPlaysRemaining(prev => prev + amount);
    if (userId) {
      const data = await apiCall(`/users/${userId}/credit-plays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      // Confirm with server value
      if (data?.user) setPlaysRemaining(data.user.playsRemaining);
    }
    setTimeout(() => setBonusCelebration(null), 3500);
  }, [userId]);

  const triggerMegaBonus = useCallback(async () => {
    playMegaFanfare();
    speakMessage("Parabéns! Você acaba de ganhar 15 jogadas! E por muito pouco você não ganha o prêmio acumulado!");
    setConfettiActive(true);
    setMegaActive(true);
    // Update counter immediately (optimistic)
    setPlaysRemaining(prev => prev + 15);
    if (userId) {
      const data = await apiCall(`/users/${userId}/credit-plays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 15 }),
      });
      // Confirm with server value
      if (data?.user) setPlaysRemaining(data.user.playsRemaining);
    }
    setTimeout(() => setMegaActive(false), 7000);
  }, [userId]);

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
    Promise.all([
      apiCall("/settings/valor-acumulado"),
      apiCall("/settings/ultimo-ganhador"),
      apiCall("/settings/broadcast"),
      apiCall("/settings/promocao"),
    ]).then(([valorData, ugData, broadcastData, promoData]) => {
      if (valorData?.valor) {
        const num = parseFloat(valorData.valor.replace(",", "."));
        if (!isNaN(num)) {
          setValorAcumulado(num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      }
      if (ugData) {
        setUltimoGanhador({
          nome: ugData.nome ?? "",
          cidadeEstado: ugData.cidadeEstado ?? "",
          valor: ugData.valor ?? "",
          foto: ugData.foto ?? "",
        });
      }
      if (broadcastData?.broadcastId && broadcastData.message) {
        const seen = localStorage.getItem("seenBroadcastId");
        if (seen !== broadcastData.broadcastId) {
          setBroadcastModal(broadcastData.message);
        }
      }
      if (promoData) {
        setPromoConfig({
          ativa: promoData.ativa !== false,
          titulo: promoData.titulo || "GANHE 100 JOGADAS GRÁTIS",
          meta1Indicacoes: promoData.meta1Indicacoes || "20",
          meta1Jogadas: promoData.meta1Jogadas || "50",
          meta2Indicacoes: promoData.meta2Indicacoes || "30",
          meta2Dias: promoData.meta2Dias || "30",
          meta2Jogadas: promoData.meta2Jogadas || "100",
          bonusPorIndicacao: promoData.bonusPorIndicacao || "3",
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!userId) { setUserLoaded(true); return; }
    Promise.all([
      apiCall(`/users/${userId}`),
      apiCall(`/users/${userId}/referral-info`),
    ]).then(([userData, referralData]) => {
      if (userData?.user) {
        setPlaysRemaining(userData.user.playsRemaining);
        setReferralUnlocked(userData.user.referralUnlocked);
      } else {
        localStorage.removeItem("golUserId");
        setUserId(null);
      }
      if (referralData?.totalFriends !== undefined) {
        setTotalFriends(referralData.totalFriends);
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
        setGameActive(false);
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
        // ── Bônus por linha ──
        // Completar a 4ª linha (rowIdx=3) → +1 jogada
        // Completar a 5ª linha (rowIdx=4) → +5 jogadas
        // Completar a 6ª linha (rowIdx=5) → +15 jogadas MEGA
        if (rowIdx === 3) {
          triggerBonus(1);
        } else if (rowIdx === 4) {
          triggerBonus(5);
        } else if (rowIdx === 5) {
          triggerMegaBonus();
        }
        if (next >= TOTAL_ROWS) {
          setGameActive(false); setCurrentRow(0);
        } else {
          setCurrentRow(next); setLocked(false);
        }
      }, 700);
    }
  };

  const refreshReferralCount = useCallback(async (id: number) => {
    const data = await apiCall(`/users/${id}/referral-info`);
    if (data?.totalFriends !== undefined) setTotalFriends(data.totalFriends);
  }, []);

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

  if (showAdmin) return <AdminPanel onClose={() => { setShowAdmin(false); window.history.replaceState({}, "", window.location.pathname + window.location.search); }} skipAuth={isAdminMode} />;

  if (!userLoaded) return null;
  if (!userId) {
    return (
      <>
        <RegisterScreen referralCode={referralCodeFromUrl || undefined} onRegistered={handleRegistered} />
        {/* Gatilho secreto: 3 toques rápidos no canto inferior esquerdo */}
        <div
          onClick={() => {
            adminTapCount.current += 1;
            if (adminTapTimer.current) clearTimeout(adminTapTimer.current);
            if (adminTapCount.current >= 3) {
              adminTapCount.current = 0;
              setShowAdmin(true);
            } else {
              adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 1200);
            }
          }}
          style={{ position: "fixed", bottom: 0, left: 0, width: 60, height: 60, zIndex: 500, cursor: "default" }}
        />
        {/* Botão Admin — visível só para quem acessou com ?admin=1 */}
        {isAdminMode && (
          <button
            onClick={() => setShowAdmin(true)}
            style={{
              position: "fixed", bottom: 16, right: 16, zIndex: 2147483647,
              background: "#1a1a1a", border: "2px solid gold",
              borderRadius: 10, color: "gold", fontSize: 14, fontWeight: "bold",
              padding: "8px 14px", cursor: "pointer", boxShadow: "0 0 12px rgba(255,215,0,0.4)",
            }}
          >⚙️ ADMIN</button>
        )}
      </>
    );
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
          JOGADAS — botão contador + comprar mais
          Cobre jogadasNum + jogadasPlus (x: 0.675→0.875)
          ══════════════════════════════════════════════ */}
      <div
        onClick={() => setShowPurchaseModal(true)}
        onTouchEnd={(e) => { e.preventDefault(); setShowPurchaseModal(true); }}
        style={{
          ...ov(UI.jogadasNum.x, UI.jogadasNum.y, UI.jogadasNum.w + UI.jogadasPlus.w, UI.jogadasNum.h),
          left: `calc(${bounds.x + bounds.w * UI.jogadasNum.x}px - 1cm)`,
          width: `calc(${bounds.w * (UI.jogadasNum.w + UI.jogadasPlus.w)}px + 2cm)`,
          zIndex: 30,
          cursor: "pointer",
          background: playsRemaining <= 0
            ? "linear-gradient(135deg, #3a0000, #1a0000)"
            : "linear-gradient(135deg, #0a1a00, #0d2800)",
          border: playsRemaining <= 0
            ? "1.5px solid rgba(255,60,0,0.7)"
            : "1.5px solid rgba(100,220,0,0.6)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          boxShadow: playsRemaining <= 0
            ? "0 0 10px rgba(255,40,0,0.3)"
            : "0 0 10px rgba(80,200,0,0.25)",
        }}
      >
        <span style={{
          color: playsRemaining <= 0 ? "rgba(255,120,60,0.9)" : "rgba(120,220,80,0.9)",
          fontWeight: 800,
          fontSize: Math.max(bounds.w * 0.018, 7),
          lineHeight: 1,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}>
          JOGADAS
        </span>
        <span style={{
          color: playsRemaining <= 0 ? "#ff4422" : "#FFD700",
          fontWeight: 900,
          fontSize: numFontSize,
          lineHeight: 1.1,
          textShadow: playsRemaining <= 0
            ? "0 0 8px rgba(255,60,0,0.7)"
            : "0 0 8px rgba(255,200,0,0.6)",
          letterSpacing: 1,
        }}>
          {playsRemaining}
        </span>
      </div>

      {/* ══════════════════════════════════════════════
          VALOR ACUMULADO — overlay dinâmico sobre a imagem de fundo
          Posição: painel direito, xF≈0.555-0.970, yF≈0.218-0.258
          ══════════════════════════════════════════════ */}
      <div
        style={{
          ...ov(0.621, 0.273, 0.349, 0.042),
          zIndex: 30,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: bounds.w * 0.020,
          background: "#000",
          borderRadius: 3,
        }}
      >
        <span style={{
          color: "#FFD700",
          fontWeight: 900,
          fontSize: Math.max(bounds.w * 0.042, 14),
          lineHeight: 1,
          textShadow: "0 2px 8px rgba(0,0,0,0.9)",
          letterSpacing: 0.5,
        }}>
          R$ {valorAcumulado}
        </span>
      </div>

      {/* ══════════════════════════════════════════════
          ÚLTIMO GANHADOR — só renderiza quando há dados
          Cobre o conteúdo estático da imagem e exibe dados dinâmicos
          xF≈0.555-0.975, yF≈0.372-0.408
          ══════════════════════════════════════════════ */}
      {ultimoGanhador?.nome && (
        <div
          style={{
            ...ov(0.608, 0.378, 0.355, 0.124),
            zIndex: 30,
            pointerEvents: "none",
            background: "#0a0a0a",
            borderRadius: 5,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: bounds.w * 0.014,
            paddingLeft: bounds.w * 0.010,
            paddingRight: bounds.w * 0.010,
            overflow: "hidden",
          }}
        >
          {/* Avatar */}
          <div style={{
            flexShrink: 0,
            width: bounds.h * 0.068,
            height: bounds.h * 0.068,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#222",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid rgba(255,215,0,0.35)",
          }}>
            {ultimoGanhador.foto ? (
              <img
                src={ultimoGanhador.foto}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: Math.max(bounds.w * 0.038, 14) }}>👤</span>
            )}
          </div>

          {/* Texto */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 1,
            minWidth: 0,
          }}>
            <span style={{
              color: "#fff",
              fontWeight: 700,
              fontSize: Math.max(bounds.w * 0.030, 11),
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: bounds.w * 0.28,
            }}>
              {ultimoGanhador.nome}
            </span>
            <span style={{
              color: "#bbb",
              fontSize: Math.max(bounds.w * 0.024, 9),
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}>
              {ultimoGanhador.cidadeEstado}
            </span>
            <span style={{
              color: "#FFD700",
              fontWeight: 700,
              fontSize: Math.max(bounds.w * 0.028, 10),
              lineHeight: 1.2,
            }}>
              R$ {ultimoGanhador.valor}
            </span>
          </div>
        </div>
      )}

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
        <InviteScreen userId={userId} onClose={() => { setShowInviteScreen(false); refreshReferralCount(userId); }} />
      )}
      {/* ── BOTÃO PROMOÇÃO 100 JOGADAS ── */}
      {promoConfig.ativa && (
      <div
        onClick={() => setShowPromoModal(true)}
        onTouchEnd={(e) => { e.preventDefault(); setShowPromoModal(true); }}
        style={{
          position: "fixed",
          bottom: 178,
          left: "calc(50% + 44px)",
          zIndex: 90,
          cursor: "pointer",
          width: 108,
          height: 60,
          background: "linear-gradient(135deg, #ff6a00, #ee0979, #ff6a00)",
          border: "2.5px solid #FFD700",
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          boxShadow: "0 0 20px 6px rgba(255,80,0,0.55), 0 4px 16px rgba(0,0,0,0.5)",
          animation: "promoPulse 1.6s ease-in-out infinite",
          userSelect: "none",
          padding: 6,
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>🎁</span>
        <span style={{
          color: "#FFD700",
          fontWeight: 900,
          fontSize: 10,
          letterSpacing: 0.3,
          textShadow: "0 0 8px rgba(255,215,0,0.8), 0 1px 3px rgba(0,0,0,0.9)",
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1.25,
        }}>
          {promoConfig.titulo}
        </span>
      </div>
      )}

      {/* ── TARJA PRETA 1 — abaixo do botão promoção ── */}
      <div
        style={{
          position: "fixed",
          bottom: 114,
          left: "calc(50% + 44px)",
          zIndex: 89,
          width: 108,
          height: 60,
          background: "#000",
          borderRadius: 14,
          pointerEvents: "none",
        }}
      />

      {/* ── TARJA PRETA 2 — 1mm abaixo da tarja 1 ── */}
      <div
        style={{
          position: "fixed",
          bottom: 50,
          left: "calc(50% + 44px)",
          zIndex: 89,
          width: 108,
          height: 60,
          background: "#000",
          borderRadius: 14,
          pointerEvents: "none",
        }}
      />

      {/* ── MODAL PROMOÇÃO 100 JOGADAS ── */}
      {showPromoModal && (
        <div
          onClick={() => setShowPromoModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: "rgba(0,0,0,0.82)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(160deg, #0d0d0d, #1a0a00, #0d0d0d)",
              border: "3px solid #FFD700",
              borderRadius: 24,
              padding: "28px 24px 24px",
              maxWidth: 360,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 0 60px 15px rgba(255,140,0,0.35), 0 0 120px 30px rgba(255,0,80,0.15)",
              position: "relative",
            }}
          >
            {/* Fechar */}
            <button
              onClick={() => setShowPromoModal(false)}
              style={{
                position: "absolute", top: 12, right: 14,
                background: "none", border: "none", color: "#aaa",
                fontSize: 22, cursor: "pointer", lineHeight: 1,
              }}
            >✕</button>

            {/* Ícone */}
            <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>🎁🏆🎉</div>

            {/* Título */}
            <div style={{
              color: "#FFD700",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 1,
              textShadow: "0 0 20px rgba(255,200,0,0.6)",
              marginBottom: 18,
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}>
              {promoConfig.titulo}!
            </div>

            {/* Cards das etapas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>

              {/* Etapa 1 – 20 indicações */}
              <div style={{
                background: "linear-gradient(135deg, rgba(0,180,80,0.15), rgba(0,100,40,0.25))",
                border: "1.5px solid rgba(0,220,100,0.5)",
                borderRadius: 14,
                padding: "12px 16px",
                textAlign: "left",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>🥈</span>
                  <span style={{ color: "#7FFF00", fontWeight: 900, fontSize: 16 }}>{promoConfig.meta1Indicacoes} INDICAÇÕES</span>
                </div>
                <div style={{ color: "#d4f7d4", fontSize: 13, lineHeight: 1.5 }}>
                  Indique <strong style={{ color: "#7FFF00" }}>{promoConfig.meta1Indicacoes} pessoas válidas</strong> e ganhe<br />
                  <strong style={{ color: "#FFD700", fontSize: 15 }}>+{promoConfig.meta1Jogadas} JOGADAS GRÁTIS</strong> na hora!
                </div>
              </div>

              {/* Etapa 2 */}
              <div style={{
                background: "linear-gradient(135deg, rgba(255,140,0,0.15), rgba(180,60,0,0.25))",
                border: "1.5px solid rgba(255,180,0,0.6)",
                borderRadius: 14,
                padding: "12px 16px",
                textAlign: "left",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>🥇</span>
                  <span style={{ color: "#FFD700", fontWeight: 900, fontSize: 16 }}>{promoConfig.meta2Indicacoes} INDICAÇÕES EM {promoConfig.meta2Dias} DIAS</span>
                </div>
                <div style={{ color: "#fff0cc", fontSize: 13, lineHeight: 1.5 }}>
                  Indique <strong style={{ color: "#FFD700" }}>{promoConfig.meta2Indicacoes} pessoas válidas</strong> em até {promoConfig.meta2Dias} dias e ganhe<br />
                  <strong style={{ color: "#FFD700", fontSize: 15 }}>+{promoConfig.meta2Jogadas} JOGADAS GRÁTIS!</strong>
                </div>
              </div>

              {/* Bônus contínuo */}
              <div style={{
                background: "linear-gradient(135deg, rgba(100,0,200,0.15), rgba(60,0,120,0.25))",
                border: "1.5px solid rgba(180,80,255,0.5)",
                borderRadius: 14,
                padding: "12px 16px",
                textAlign: "left",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>⭐</span>
                  <span style={{ color: "#cc88ff", fontWeight: 900, fontSize: 15 }}>BÔNUS CONTÍNUO</span>
                </div>
                <div style={{ color: "#e8d4ff", fontSize: 13, lineHeight: 1.5 }}>
                  Além disso, você continua ganhando<br />
                  <strong style={{ color: "#cc88ff", fontSize: 15 }}>+{promoConfig.bonusPorIndicacao} JOGADAS</strong> por cada indicação válida!
                </div>
              </div>
            </div>

            {/* Botão compartilhar */}
            <button
              onClick={() => { setShowPromoModal(false); setShowInviteScreen(true); }}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #ff6a00, #ee0979)",
                border: "2px solid #FFD700",
                borderRadius: 50,
                color: "#FFD700",
                fontWeight: 900,
                fontSize: 15,
                padding: "13px 0",
                cursor: "pointer",
                letterSpacing: 1,
                textTransform: "uppercase",
                boxShadow: "0 0 20px rgba(255,80,0,0.4)",
              }}
            >
              🚀 QUERO PARTICIPAR AGORA!
            </button>
          </div>
        </div>
      )}

      {/* ── PWA INSTALL PROMPT ── */}
      <InstallPrompt />

      {/* ── ACESSO ADMIN — toque triplo no canto inferior esquerdo ── */}
      <div
        onClick={() => {
          adminTapCount.current += 1;
          if (adminTapTimer.current) clearTimeout(adminTapTimer.current);
          if (adminTapCount.current >= 3) {
            adminTapCount.current = 0;
            setShowAdmin(true);
          } else {
            adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 1200);
          }
        }}
        style={{ position: "fixed", bottom: 0, left: 0, width: 60, height: 60, zIndex: 500, cursor: "default" }}
      />

      {/* ── CONFETE ── */}
      <ConfettiCanvas active={confettiActive} mega={megaActive} onDone={() => setConfettiActive(false)} />

      {/* ── CELEBRAÇÃO DE BÔNUS ── */}
      {bonusCelebration && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 400,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            background: bonusCelebration.big
              ? "linear-gradient(135deg,#1a0033,#3d006b,#1a0033)"
              : "linear-gradient(135deg,#1a2a00,#2d5000,#1a2a00)",
            border: `3px solid ${bonusCelebration.big ? "#FFD700" : "#7FFF00"}`,
            borderRadius: 24,
            padding: "28px 40px",
            textAlign: "center",
            boxShadow: `0 0 60px 20px ${bonusCelebration.big ? "rgba(255,180,0,0.6)" : "rgba(80,255,0,0.4)"}`,
            animation: "bonusPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275)",
          }}>
            <div style={{ fontSize: bonusCelebration.big ? 52 : 44, lineHeight: 1, marginBottom: 6 }}>
              {bonusCelebration.big ? "🏆🎺🎉" : "⭐🎺"}
            </div>
            <div style={{
              color: bonusCelebration.big ? "#FFD700" : "#7FFF00",
              fontSize: bonusCelebration.big ? 48 : 40,
              fontWeight: 900,
              lineHeight: 1,
              textShadow: `0 0 20px ${bonusCelebration.big ? "#FFD700" : "#7FFF00"}`,
              letterSpacing: 2,
            }}>
              +{bonusCelebration.amount} JOGADA{bonusCelebration.amount > 1 ? "S" : ""}!
            </div>
            <div style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: 700,
              marginTop: 8,
              opacity: 0.9,
            }}>
              {bonusCelebration.big ? "INCRÍVEL! Você chegou à 5ª linha!" : "Muito bem! Você chegou à 4ª linha!"}
            </div>
          </div>
        </div>
      )}

      {/* ── MEGA CELEBRAÇÃO — última linha +15 jogadas ── */}
      {megaActive && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.75)",
          pointerEvents: "none",
        }}>
          <div style={{
            background: "linear-gradient(135deg,#0a0020,#2d006b,#4b0082,#2d006b,#0a0020)",
            border: "4px solid #FFD700",
            borderRadius: 28,
            padding: "36px 32px",
            textAlign: "center",
            maxWidth: 320,
            width: "88%",
            boxShadow: "0 0 80px 30px rgba(255,180,0,0.7), 0 0 200px 60px rgba(120,0,255,0.4)",
            animation: "megaPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)",
          }}>
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 10 }}>
              🏆🎺🎉🎊⭐
            </div>
            <div style={{
              color: "#FFD700",
              fontSize: 30,
              fontWeight: 900,
              lineHeight: 1.15,
              textShadow: "0 0 30px #FFD700, 0 0 60px rgba(255,200,0,0.5)",
              letterSpacing: 1,
              marginBottom: 12,
            }}>
              PARABÉNS!<br />
              VOCÊ ACABA DE<br />
              GANHAR 15 JOGADAS!
            </div>
            <div style={{
              background: "rgba(255,215,0,0.15)",
              border: "2px solid rgba(255,215,0,0.5)",
              borderRadius: 14,
              padding: "10px 14px",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.4,
            }}>
              🍀 E POR MUITO POUCO<br />
              VOCÊ NÃO GANHOU<br />
              O PRÊMIO ACUMULADO!
            </div>
          </div>
        </div>
      )}

      {/* ── PAINEL ADMIN ── */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} skipAuth={isAdminMode} />}

      {/* Modal de mensagem broadcast */}
      {broadcastModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2147483640,
          background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}>
          <div style={{
            background: "#1a1a2e", border: "2px solid #f97316",
            borderRadius: 18, maxWidth: 360, width: "100%",
            padding: "28px 24px", textAlign: "center",
            boxShadow: "0 0 40px rgba(249,115,22,0.35)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📢</div>
            <div style={{
              color: "#f97316", fontWeight: 800, fontSize: 16,
              marginBottom: 14, letterSpacing: 0.5,
            }}>
              Aviso do Organizador
            </div>
            <div style={{
              color: "#e5e5e5", fontSize: 14, lineHeight: 1.6,
              marginBottom: 24, whiteSpace: "pre-wrap",
            }}>
              {broadcastModal}
            </div>
            <button
              onClick={() => {
                const seen = localStorage.getItem("seenBroadcastId");
                apiCall("/settings/broadcast").then(data => {
                  if (data?.broadcastId) {
                    localStorage.setItem("seenBroadcastId", data.broadcastId);
                  }
                });
                setBroadcastModal(null);
              }}
              style={{
                background: "#f97316", color: "#fff", border: "none",
                borderRadius: 12, padding: "13px 36px", fontSize: 15,
                fontWeight: 700, cursor: "pointer", width: "100%",
                letterSpacing: 0.4,
              }}
            >
              Entendido ✓
            </button>
          </div>
        </div>
      )}

      {/* Botão Admin — visível só para quem acessou com ?admin=1 */}
      {isAdminMode && (
        <button
          onClick={() => setShowAdmin(true)}
          style={{
            position: "fixed", bottom: 16, right: 16, zIndex: 2147483647,
            background: "#1a1a1a", border: "2px solid gold",
            borderRadius: 10, color: "gold", fontSize: 14, fontWeight: "bold",
            padding: "8px 14px", cursor: "pointer",
            boxShadow: "0 0 12px rgba(255,215,0,0.4)",
          }}
        >⚙️ ADMIN</button>
      )}

      <style>{`
        @keyframes bonusPop {
          0%   { transform: scale(0.3) rotate(-8deg); opacity: 0; }
          70%  { transform: scale(1.08) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes megaPop {
          0%   { transform: scale(0.2) rotate(-6deg); opacity: 0; }
          60%  { transform: scale(1.06) rotate(2deg); opacity: 1; }
          80%  { transform: scale(0.97) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes promoPulse {
          0%   { box-shadow: 0 0 18px 5px rgba(255,80,0,0.55), 0 4px 16px rgba(0,0,0,0.5); transform: scale(1); }
          50%  { box-shadow: 0 0 32px 12px rgba(255,30,120,0.75), 0 4px 20px rgba(0,0,0,0.6); transform: scale(1.06); }
          100% { box-shadow: 0 0 18px 5px rgba(255,80,0,0.55), 0 4px 16px rgba(0,0,0,0.5); transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
