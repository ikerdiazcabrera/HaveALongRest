import { describe, expect, it } from "vitest";
import { passwordSchema } from "../lib/auth/password";
import { sniffImageType } from "../lib/image-type";
import { hexColorSchema, usernameSchema } from "../lib/validation";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("detección del tipo de imagen", () => {
  it("reconoce los formatos admitidos por su firma", () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("image/gif");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("rechaza SVG, HTML y ficheros disfrazados", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffImageType(bytes(0x4d, 0x5a))).toBeNull(); // ejecutable de Windows
  });
});

describe("validaciones", () => {
  it("contraseñas: longitud mínima, máximo de bcrypt y no repetitivas", () => {
    expect(passwordSchema.safeParse("corta").success).toBe(false);
    expect(passwordSchema.safeParse("aaaaaaaaaaaa").success).toBe(false);
    expect(passwordSchema.safeParse("ñ".repeat(37)).success).toBe(false); // 74 bytes
    expect(passwordSchema.safeParse("dragón-azul-42").success).toBe(true);
  });

  it("usuarios: formato y nombres reservados", () => {
    expect(usernameSchema.parse("  Iker_42 ")).toBe("iker_42");
    expect(usernameSchema.safeParse("admin").success).toBe(false);
    expect(usernameSchema.safeParse("a b").success).toBe(false);
  });

  it("colores: solo #rrggbb (acaban dentro de CSS)", () => {
    expect(hexColorSchema.parse("#A1B2C3")).toBe("#a1b2c3");
    for (const bad of ["red", "#fff", "#12345g", "#123456;background:url(x)", "url(javascript:1)"]) {
      expect(hexColorSchema.safeParse(bad).success).toBe(false);
    }
  });
});
