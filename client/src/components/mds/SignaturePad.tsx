import { useRef, useEffect, useState, useCallback } from "react";
import { Pen, RotateCcw, Check } from "lucide-react";
import { ActionButton, ErrorNotice } from "./private-common";

interface SignaturePadProps {
  onSign: (dataUrl: string) => void | Promise<unknown>;
  disabled?: boolean;
  error?: unknown;
}

export function SignaturePad({ onSign, disabled, error }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a1a";
    return ctx;
  }, []);

  const point = (e: MouseEvent | Touch) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY,
    };
  };

  const start = (e: MouseEvent | Touch) => {
    const ctx = getCtx();
    if (!ctx) return;
    drawingRef.current = true;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: MouseEvent | Touch) => {
    if (!drawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const end = () => {
    drawingRef.current = false;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMouseDown = (e: MouseEvent) => start(e);
    const onMouseMove = (e: MouseEvent) => move(e);
    const onMouseUp = () => end();
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches[0]) start(e.touches[0]);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches[0]) move(e.touches[0]);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      end();
    };
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [getCtx]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const submit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    setSubmitting(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await onSign(dataUrl);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <Pen size={16} aria-hidden="true" color="#bc4c23" />
          Signature du client
        </span>
        <button
          type="button"
          onClick={clear}
          className="small-text text-link"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={13} aria-hidden="true" />
          Effacer
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={520}
        height={190}
        style={{
          width: "100%",
          maxWidth: 520,
          height: 190,
          background: "#fff",
          border: "2px dashed #bc4c23",
          borderRadius: 8,
          touchAction: "none",
          display: "block",
        }}
        aria-label="Zone de signature : dessinez votre signature ici"
      />
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          fontSize: 13,
          color: "#5e625b",
        }}
      >
        <span>👆 Signez avec votre doigt dans le cadre ci-dessus</span>
        <span className="muted">Signature chiffrée · preuve conservée</span>
      </div>
      <ErrorNotice error={error} />
      <ActionButton
        className="primary"
        onClick={submit}
        disabled={!hasDrawn || submitting || disabled}
        style={{ minHeight: 48 }}
      >
        <Check size={18} aria-hidden="true" />
        {submitting ? "Enregistrement…" : "Valider et signer"}
      </ActionButton>
    </div>
  );
}
