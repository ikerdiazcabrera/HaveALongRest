import "server-only";
import { lt, sql } from "drizzle-orm";
import { db, rateLimits } from "@/lib/db";
import { logSecurityEvent } from "@/lib/log";

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Ventana fija: permite `limit` acciones por `key` cada `windowSeconds`.
 * Se guarda en Postgres (un upsert atómico) porque en serverless cada petición puede
 * ir a una instancia distinta y un contador en memoria no serviría.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const windowEnd = sql`now() + make_interval(secs => ${windowSeconds})`;
  const expired = sql`${rateLimits.resetAt} < now()`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: windowEnd })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${expired} then ${windowEnd} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

  if (row.count <= limit) return { ok: true };
  const retryAfterSeconds = Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000));
  if (row.count === limit + 1) logSecurityEvent("rate_limited", { key, retryAfterSeconds });
  return { ok: false, retryAfterSeconds };
}

export async function resetRateLimit(key: string) {
  await db.delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
}

export async function purgeExpiredRateLimits() {
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, new Date()));
}

export function retryMessage(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return seconds < 60
    ? `Demasiados intentos. Vuelve a probar en ${seconds} s.`
    : `Demasiados intentos. Vuelve a probar en ${minutes} min.`;
}

/** Límites de la aplicación, en un solo sitio para poder ajustarlos. */
export const LIMITS = {
  loginPerIp: [30, 15 * 60],
  loginPerAccount: [8, 15 * 60],
  registerPerIp: [5, 60 * 60],
  passwordPerUser: [5, 15 * 60],
  createCampaignPerUser: [10, 60 * 60],
  chatPerUser: [30, 60],
  uploadPerUser: [40, 10 * 60],
} as const satisfies Record<string, readonly [number, number]>;
