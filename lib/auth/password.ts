import bcrypt from "bcryptjs";
import { z } from "zod";

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/** bcrypt ignora todo lo que pase de 72 bytes: mejor rechazarlo que truncarlo en silencio. */
export const MAX_PASSWORD_BYTES = 72;

export const passwordSchema = z
  .string()
  .min(8, "La contraseña necesita al menos 8 caracteres")
  .refine((p) => new TextEncoder().encode(p).length <= MAX_PASSWORD_BYTES, "La contraseña es demasiado larga (máx. 72 bytes)")
  .refine((p) => new Set(p).size >= 4, "La contraseña es demasiado repetitiva");
