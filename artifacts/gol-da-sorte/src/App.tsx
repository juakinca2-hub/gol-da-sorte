import { useState, useRef, useEffect } from "react";
import golDaSorteImg from "@assets/IMG_7715_1780523556282.jpeg";

function playClickSound() {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(800, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);

  gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.12);
}

function App() {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgBounds, setImgBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [jogarLit, setJogarLit] = useState(false);

  const updateBounds = () => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const naturalRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = rect.width / rect.height;

    let renderedWidth: number;
    let renderedHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (containerRatio > naturalRatio) {
      renderedHeight = rect.height;
      renderedWidth = renderedHeight * naturalRatio;
      offsetX = rect.left + (rect.width - renderedWidth) / 2;
      offsetY = rect.top;
    } else {
      renderedWidth = rect.width;
      renderedHeight = renderedWidth / naturalRatio;
      offsetX = rect.left;
      offsetY = rect.top + (rect.height - renderedHeight) / 2;
    }

    setImgBounds({ left: offsetX, top: offsetY, width: renderedWidth, height: renderedHeight });
  };

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
  }, []);

  const handleJogar = () => {
    playClickSound();
    setJogarLit(true);
    setTimeout(() => setJogarLit(false), 400);
  };

  const pct = (x: number, y: number, w: number, h: number) => ({
    left: imgBounds.left + imgBounds.width * x,
    top: imgBounds.top + imgBounds.height * y,
    width: imgBounds.width * w,
    height: imgBounds.height * h,
    position: "fixed" as const,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        ref={imgRef}
        src={golDaSorteImg}
        alt="Gol da Sorte"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />

      {/* BOTÃO JOGAR */}
      <div
        onClick={handleJogar}
        style={{
          ...pct(0.045, 0.872, 0.535, 0.048),
          borderRadius: "8px",
          background: jogarLit
            ? "rgba(255, 200, 50, 0.45)"
            : "transparent",
          boxShadow: jogarLit
            ? "0 0 24px 8px rgba(255, 180, 0, 0.7)"
            : "none",
          transition: "background 0.1s, box-shadow 0.1s",
          zIndex: 10,
        }}
      />
    </div>
  );
}

export default App;
