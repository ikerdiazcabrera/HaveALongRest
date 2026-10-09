import { z } from "zod";

/** Nombres que no puede usar nadie (rutas, roles o suplantaciones obvias). */
const RESERVED = new Set([
  "admin", "administrador", "root", "soporte", "support", "moderador", "sistema", "api", "perfil", "login", "registro",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]{3,24}$/, "El usuario debe tener 3-24 caracteres: letras, números, _ o -")
  .refine((u) => !RESERVED.has(u), "Ese nombre de usuario está reservado");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Indica cómo quieres que te llamen")
  .max(40, "Nombre demasiado largo");

/** Color #rrggbb. Validación estricta: estos valores acaban dentro de CSS. */
export const hexColorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Color no válido");

export const MAX_FAVORITE_GAMES = 12;
