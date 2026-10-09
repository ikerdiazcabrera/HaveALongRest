import "server-only";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { db, sessions, users } from "@/lib/db";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";

// El prefijo __Host- obliga al navegador a exigir HTTPS, path=/ y ningún dominio:
// la cookie no puede fijarse desde un subdominio. En local (http) no se puede usar.
const SECURE = process.env.NODE_ENV === "production";
const COOKIE = SECURE ? "__Host-hlr_session" : "hlr_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? hashToken(token) : null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  // Limpieza oportunista de filas caducadas (sin necesidad de un cron).
  if (Math.random() < 0.05) {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    await purgeExpiredRateLimits();
  }
}

export async function destroySession() {
  const id = await currentSessionId();
  if (id) await db.delete(sessions).where(eq(sessions.id, id));
  (await cookies()).delete(COOKIE);
}

/** Cierra la sesión en el resto de dispositivos (tras cambiar la contraseña, por ejemplo). */
export async function destroyOtherSessions(userId: string) {
  const id = await currentSessionId();
  await db
    .delete(sessions)
    .where(id ? and(eq(sessions.userId, userId), ne(sessions.id, id)) : eq(sessions.userId, userId));
}

/** Usuario de la petición actual (memoizado por petición). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const id = await currentSessionId();
  if (!id) return null;
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
});

/** Para páginas: redirige al login si no hay sesión. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  return user;
}
