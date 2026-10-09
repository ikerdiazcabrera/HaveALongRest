import { describe, expect, it } from "vitest";
import { contrastRatio, hexToHsv, hsvToHex, mix, readableOn } from "../lib/color";
import { customThemeVars, DEFAULT_CUSTOM_THEME, themeProps } from "../lib/themes";

describe("color", () => {
  it("convierte HSV ↔ hex sin perder el color", () => {
    for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#e0a64b", "#123456", "#000000", "#ffffff"]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe("#00ff00");
  });

  it("mezcla y contraste", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(readableOn("#ffff00")).toBe("#111111");
    expect(readableOn("#1e3a8a")).toBe("#ffffff");
  });
});

describe("tema personalizado", () => {
  it("deriva tonos y texto legible del acento", () => {
    const vars = customThemeVars({ accent: "#ffcc00", background: ["#111111", "#222222", "#333333"] });
    expect(vars["--accent"]).toBe("#ffcc00");
    expect(vars["--on-accent"]).toBe("#111111");
    expect(vars["--bg-gradient"]).toContain("#222222");
  });

  it("ignora colores no válidos guardados en la BD (no inyecta CSS)", () => {
    const evil = { accent: "red;}body{display:none", background: ["#000000", "#000000", "#000000"] };
    const props = themeProps("custom", evil);
    expect(props.style).toEqual(customThemeVars(DEFAULT_CUSTOM_THEME));
    expect(themeProps("odium", null)).toEqual({ "data-theme": "odium" });
  });
});
