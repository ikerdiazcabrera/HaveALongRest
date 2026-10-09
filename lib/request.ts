import "server-only";
import { headers } from "next/headers";

/**
 * IP del cliente para limitar peticiones. En Vercel `x-forwarded-for` lo fija la propia
 * plataforma (el primer valor es el cliente real); en local suele ser ::1.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "local";
}
