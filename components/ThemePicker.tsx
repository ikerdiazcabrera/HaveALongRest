"use client";

import { useState } from "react";
import { contrastRatio } from "@/lib/color";
import type { CustomTheme } from "@/lib/db/schema";
import { CUSTOM_THEME_ID, DEFAULT_CUSTOM_THEME, isValidCustomTheme, swatchOf, THEMES, themeProps } from "@/lib/themes";
import { ColorWheel } from "./ColorWheel";

type Slot = "accent" | 0 | 1 | 2;
const SLOTS: { slot: Slot; label: string }[] = [
  { slot: "accent", label: "Acento" },
  { slot: 0, label: "Fondo 1" },
  { slot: 1, label: "Fondo 2" },
  { slot: 2, label: "Fondo 3" },
];

/** Selector de tema: predefinidos o uno propio con rueda de color. Envía `theme` y `custom*`. */
export function ThemePicker({ initialTheme, initialCustom }: { initialTheme: string; initialCustom: unknown }) {
  const [theme, setTheme] = useState(initialTheme);
  const [custom, setCustom] = useState<CustomTheme>(isValidCustomTheme(initialCustom) ? initialCustom : DEFAULT_CUSTOM_THEME);
  const [slot, setSlot] = useState<Slot>("accent");

  const colorOf = (s: Slot) => (s === "accent" ? custom.accent : custom.background[s]);
  const setColor = (s: Slot, hex: string) =>
    setCustom((c) =>
      s === "accent" ? { ...c, accent: hex } : { ...c, background: c.background.map((b, i) => (i === s ? hex : b)) as CustomTheme["background"] },
    );
  const isCustom = theme === CUSTOM_THEME_ID;
  // Aviso si el acento apenas se distingue de los paneles oscuros.
  const lowContrast = contrastRatio(custom.accent, "#100c14") < 3;

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="label">Tema visual</legend>
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="customAccent" value={custom.accent} />
      {custom.background.map((c, i) => (
        <input key={i} type="hidden" name={`customBg${i + 1}`} value={c} />
      ))}

      <div className="flex flex-wrap gap-2">
        {[...THEMES, { id: CUSTOM_THEME_ID, name: "Personalizado", swatch: swatchOf(custom) }].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            aria-pressed={theme === t.id}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${
              theme === t.id ? "border-accent bg-card-hover text-ink" : "border-line text-ink-3 hover:bg-card"
            }`}
          >
            <span className="h-5 w-5 rounded" style={{ background: t.swatch }} />
            {t.id === CUSTOM_THEME_ID ? "🎨 " : ""}
            {t.name}
          </button>
        ))}
      </div>

      {isCustom && (
        <div className="card flex flex-col gap-5 p-4 md:flex-row">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color a editar">
              {SLOTS.map(({ slot: s, label }) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={slot === s}
                  onClick={() => setSlot(s)}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-xs ${
                    slot === s ? "border-accent text-ink" : "border-line text-ink-3"
                  }`}
                >
                  <span className="h-4 w-4 rounded" style={{ background: colorOf(s) }} />
                  {label}
                </button>
              ))}
            </div>
            <ColorWheel value={colorOf(slot)} onChange={(hex) => setColor(slot, hex)} />
          </div>

          {/* Vista previa en vivo con el tema aplicado */}
          <div {...themeProps(CUSTOM_THEME_ID, custom)} className="themed-bg flex min-h-64 flex-1 flex-col justify-center gap-3 rounded-xl p-5">
            <div className="panel p-4">
              <p className="font-display text-lg font-bold text-ink">Vista previa</p>
              <p className="mt-1 text-sm text-ink-3">Así se verán los paneles, los enlaces y los botones.</p>
              <div className="markdown mt-2 text-sm">
                <p>
                  Un <a href="#preview">enlace a otra página</a> y <strong>texto destacado</strong>.
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="btn btn-primary btn-sm">Botón principal</span>
                <span className="badge badge-accent">Etiqueta</span>
              </div>
            </div>
            {lowContrast && (
              <p className="rounded-md bg-black/50 px-3 py-2 text-xs text-amber-300">
                El acento es muy oscuro: costará leer los enlaces sobre los paneles.
              </p>
            )}
          </div>
        </div>
      )}
    </fieldset>
  );
}
