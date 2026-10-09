// Temas visuales por campaña. Los predefinidos viven en app/globals.css bajo [data-theme="…"];
// el personalizado se aplica con variables CSS en línea calculadas a partir de 4 colores.
import type { CSSProperties } from "react";
import { mix, readableOn } from "./color";
import type { CustomTheme } from "./db/schema";

export const THEMES = [
  { id: "taberna", name: "Taberna", swatch: "linear-gradient(135deg, #2a1a12, #5b3a1e, #1c1830)" },
  { id: "caminapiedras", name: "Caminapiedras", swatch: "linear-gradient(135deg, #1e3a8a, #065f46, #581c87)" },
  { id: "odium", name: "Odium", swatch: "linear-gradient(135deg, #951c0f, #550790, #d8c41a)" },
  { id: "honor", name: "Honor", swatch: "linear-gradient(135deg, #2a9bbd, #c6e3e7, #d8c41a)" },
  { id: "cultivacion", name: "Cultivación", swatch: "linear-gradient(135deg, #495d3a, #287f79, #865743)" },
  { id: "sangre-espectral", name: "Sangre Espectral", swatch: "linear-gradient(135deg, #91040a, #909090)" },
  { id: "ojos-de-palah", name: "Ojos de Palah", swatch: "linear-gradient(135deg, #659b69, #d0b774)" },
] as const;

export const CUSTOM_THEME_ID = "custom";
export type ThemeId = (typeof THEMES)[number]["id"] | typeof CUSTOM_THEME_ID;
export const THEME_IDS: [ThemeId, ...ThemeId[]] = [CUSTOM_THEME_ID, ...THEMES.map((t) => t.id)];

export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  accent: "#e0a64b",
  background: ["#3b1d4a", "#1d2b4f", "#0f3d3a"],
};

const HEX = /^#[0-9a-f]{6}$/i;
export const isValidCustomTheme = (t: unknown): t is CustomTheme =>
  !!t &&
  typeof t === "object" &&
  HEX.test((t as CustomTheme).accent) &&
  Array.isArray((t as CustomTheme).background) &&
  (t as CustomTheme).background.length === 3 &&
  (t as CustomTheme).background.every((c) => HEX.test(c));

/** Variables CSS de un tema personalizado (tonos claros/oscuros y texto legible derivados). */
export function customThemeVars(theme: CustomTheme): Record<string, string> {
  const [a, b, c] = theme.background;
  return {
    "--bg-gradient": `linear-gradient(135deg, ${a} 0%, ${b} 50%, ${c} 100%)`,
    "--accent": theme.accent,
    "--accent-2": mix(theme.accent, "#ffffff", 0.35),
    "--accent-dim": mix(theme.accent, "#000000", 0.35),
    "--on-accent": readableOn(theme.accent),
  };
}

export const swatchOf = (theme: CustomTheme) =>
  `linear-gradient(135deg, ${theme.background[0]}, ${theme.background[1]}, ${theme.background[2]})`;

/**
 * Atributos para el contenedor que aplica el tema de una campaña. Los colores se vuelven a
 * validar aquí aunque ya se validaron al guardar: acaban dentro de CSS.
 */
export function themeProps(theme: string, custom: unknown): { "data-theme": string; style?: CSSProperties } {
  if (theme === CUSTOM_THEME_ID) {
    return {
      "data-theme": CUSTOM_THEME_ID,
      style: customThemeVars(isValidCustomTheme(custom) ? custom : DEFAULT_CUSTOM_THEME) as CSSProperties,
    };
  }
  return { "data-theme": theme };
}
