import { useEffect, useRef, useState } from "react";

const FRAME = 260;
const OUTPUT = 512;

/**
 * Simple square crop + preview for the photo layouts. JPG/PNG only, the image
 * never leaves the browser: it is read as a data URL, cropped on a canvas, and
 * handed straight to the résumé the buyer just paid for.
 */
export function PhotoCropper({
  round,
  value,
  onConfirm,
}: {
  /** Draw the crop frame as a circle (sidebar layout) instead of a square. */
  round: boolean;
  value: string | null;
  onConfirm: (dataUrl: string | null) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!src) return;
    const image = new Image();
    image.onload = () => setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    image.src = src;
  }, [src]);

  function pick(file: File | null) {
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      setError("JPG or PNG only.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("That image is over 8MB. Try a smaller one.");
      return;
    }
    setError(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    const reader = new FileReader();
    reader.onload = () => setSrc(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  /** Scale that makes the image cover the crop frame at zoom 1. */
  const base =
    natural.w && natural.h ? Math.max(FRAME / natural.w, FRAME / natural.h) : 1;
  const drawW = natural.w * base * zoom;
  const drawH = natural.h * base * zoom;
  const maxX = Math.max(0, (drawW - FRAME) / 2);
  const maxY = Math.max(0, (drawH - FRAME) / 2);
  const clamped = {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };

  function crop() {
    if (!src || !natural.w) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const k = OUTPUT / FRAME;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(
        image,
        (OUTPUT - drawW * k) / 2 + clamped.x * k,
        (OUTPUT - drawH * k) / 2 + clamped.y * k,
        drawW * k,
        drawH * k,
      );
      onConfirm(canvas.toDataURL("image/jpeg", 0.9));
    };
    image.src = src;
  }

  return (
    <div className="bg-card p-6 shadow-paper sm:p-8">
      <label
        htmlFor="photo"
        className="font-typewriter text-sm tracking-widest text-ink uppercase"
      >
        Upload your photo (JPG or PNG)
      </label>
      <input
        id="photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png"
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
        className="mt-3 block w-full font-typewriter text-sm text-muted-foreground file:mr-4 file:border file:border-ink file:bg-transparent file:px-4 file:py-2 file:font-stamp file:text-xs file:tracking-widest file:text-ink file:uppercase hover:file:border-ink-soft hover:file:text-ink"
      />

      {error && (
        <p className="mt-4 font-hand text-2xl leading-tight text-redpen">{error}</p>
      )}

      {src && (
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div>
            <div
              onPointerDown={(event) => {
                dragging.current = {
                  x: event.clientX - clamped.x,
                  y: event.clientY - clamped.y,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!dragging.current) return;
                setOffset({
                  x: event.clientX - dragging.current.x,
                  y: event.clientY - dragging.current.y,
                });
              }}
              onPointerUp={() => {
                dragging.current = null;
              }}
              style={{ width: FRAME, height: FRAME }}
              className={`relative touch-none overflow-hidden border-2 border-redpen bg-[#e6e4df] ${
                round ? "rounded-full" : ""
              }`}
            >
              <img
                src={src}
                alt="Crop preview"
                draggable={false}
                style={{
                  width: drawW,
                  height: drawH,
                  transform: `translate(${clamped.x}px, ${clamped.y}px)`,
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
              />
            </div>
            <label
              htmlFor="zoom"
              className="mt-4 block font-typewriter text-xs tracking-widest text-muted-foreground uppercase"
            >
              Zoom
            </label>
            <input
              id="zoom"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-2 w-[260px] accent-[#d62828]"
            />
          </div>

          <div className="flex-1">
            <p className="font-sans text-[0.85rem] leading-relaxed text-muted-foreground">
              Drag the photo to reposition it, zoom until your head and shoulders fill
              the frame, then confirm placement. This photo is used only on your résumé
              and never leaves this browser session.
            </p>
            <button
              type="button"
              onClick={crop}
              className="mt-5 border-2 border-redpen bg-redpen px-5 py-2 font-stamp text-xs tracking-[0.2em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
            >
              Confirm placement
            </button>
            {value && (
              <div className="mt-5 flex items-center gap-3">
                <div
                  className={`size-14 overflow-hidden border-2 border-ink ${
                    round ? "rounded-full" : ""
                  }`}
                >
                  <img src={value} alt="Confirmed photo" className="h-full w-full object-cover" />
                </div>
                <p className="font-hand text-2xl leading-tight text-redpen">
                  Placement locked in.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
