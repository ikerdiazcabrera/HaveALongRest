"use client";

import { useRef, useState } from "react";
import { hexToHsv, type Hsv, hsvToHex } from "@/lib/color";

const SIZE = 200;
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Rueda de color clásica: el ángulo es el tono, la distancia al centro la saturación y la
 * barra inferior el brillo. Con teclado: flechas ←/→ tono, ↑/↓ saturación (Mayús = más rápido).
 */
export function ColorWheel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  // HSV propio para no perder el tono al llegar a gris o negro (el hex no lo conserva).
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [lastValue, setLastValue] = useState(value);
  const [text, setText] = useState(value);
  const wheel = useRef<HTMLDivElement>(null);

  // Si el valor cambia desde fuera (otra muestra seleccionada), se resincroniza durante el render.
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== hsvToHex(hsv)) setHsv(hexToHsv(value));
    setText(value);
  }

  function update(next: Hsv) {
    const hex = hsvToHex(next);
    setHsv(next);
    setLastValue(hex);
    setText(hex);
    onChange(hex);
  }

  function pick(clientX: number, clientY: number) {
    const rect = wheel.current!.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360; // 0° arriba, sentido horario
    const s = Math.min(1, Math.hypot(dx, dy) / (rect.width / 2));
    update({ ...hsv, h, s });
  }

  const angle = (hsv.h * Math.PI) / 180;
  const radius = (hsv.s * SIZE) / 2;
  const marker = { left: SIZE / 2 + Math.sin(angle) * radius, top: SIZE / 2 - Math.cos(angle) * radius };
  const fullColor = hsvToHex({ ...hsv, v: 1 });

  return (
    <div className="flex w-fit flex-col items-center gap-3">
      <div
        ref={wheel}
        role="slider"
        tabIndex={0}
        aria-label="Rueda de color: tono y saturación"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={`Tono ${Math.round(hsv.h)}°, saturación ${Math.round(hsv.s * 100)}%`}
        className="relative cursor-crosshair touch-none rounded-full shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{
          width: SIZE,
          height: SIZE,
          background:
            "radial-gradient(circle closest-side, #fff, transparent), conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e.clientX, e.clientY);
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 2;
          const moves: Record<string, Partial<Hsv>> = {
            ArrowLeft: { h: (hsv.h - step + 360) % 360 },
            ArrowRight: { h: (hsv.h + step) % 360 },
            ArrowUp: { s: Math.min(1, hsv.s + step / 100) },
            ArrowDown: { s: Math.max(0, hsv.s - step / 100) },
          };
          if (moves[e.key]) {
            e.preventDefault();
            update({ ...hsv, ...moves[e.key] });
          }
        }}
      >
        {/* Oscurecimiento según el brillo elegido */}
        <div className="pointer-events-none absolute inset-0 rounded-full bg-black" style={{ opacity: 1 - hsv.v }} />
        <span
          aria-hidden
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{ ...marker, background: value }}
        />
      </div>

      <label className="flex w-full flex-col gap-1 text-xs text-ink-3">
        Brillo
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(hsv.v * 100)}
          onChange={(e) => update({ ...hsv, v: Number(e.target.value) / 100 })}
          className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--accent)]"
          style={{ background: `linear-gradient(to right, #000, ${fullColor})` }}
        />
      </label>

      <div className="flex w-full items-center gap-2">
        <span className="h-8 w-8 shrink-0 rounded-md border border-line" style={{ background: value }} />
        <input
          value={text}
          onChange={(e) => {
            const next = e.target.value.trim();
            setText(next);
            if (HEX.test(next)) update(hexToHsv(next.toLowerCase()));
          }}
          aria-label="Color en hexadecimal"
          maxLength={7}
          spellCheck={false}
          className="input font-mono text-xs uppercase"
        />
      </div>
    </div>
  );
}
