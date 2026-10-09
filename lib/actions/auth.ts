"use server";

import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { db, users } from "@/lib/db";
import { logSecurityEvent } from "@/lib/log";
import { LIMITS, rateLimit, resetRateLimit, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { displayNameSchema, usernameSchema } from "@/lib/validation";
import { firstIssue, type FormState, isUniqueViolation, safePath } from "./shared";

const registerSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Email no válido")),
  password: passwordSchema,
});

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    username: String(formData.get("username") ?? "").slice(0, 100),
    displayName: String(formData.get("displayName") ?? "").slice(0, 100),
    email: String(formData.get("email") ?? "").slice(0, 254),
  };
  const result = await registerUser(formData);
  return result && { ...result, values };
}

async function registerUser(formData: FormData): Promise<FormState> {
  const limited = await rateLimit(`register:ip:${await clientIp()}`, ...LIMITS.registerPerIp);
  if (!limited.ok) return { error: retryMessage(limited.retryAfterSeconds) };

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { username, displayName, email, password } = parsed.data;

  const [existing] = await db
    .select({ username: users.username })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email)))
    .limit(1);
  if (existing) {
    return { error: existing.username === username ? "Ese nombre de usuario ya existe" : "Ya hay una cuenta con ese email" };
  }

  let userId: string;
  try {
    const [user] = await db
      .insert(users)
      .values({ username, displayName, email, passwordHash: await hashPassword(password) })
      .returning({ id: users.id });
    userId = user.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Ese usuario o email ya está registrado" };
    throw e;
  }
  await createSession(userId);
  redirect(safePath(formData.get("next")));
}

// Hash con el que comparar cuando el usuario no existe, para que la respuesta tarde
// lo mismo y no revele qué cuentas existen.
const DUMMY_HASH = "$2b$10$0nLnGC.5VcDzf/oqq8GF3eK2G8tbpo05ANYHPy23JgHzXrcj2wYXO";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await loginUser(formData);
  return result && { ...result, values: { identifier: String(formData.get("identifier") ?? "").slice(0, 254) } };
}

async function loginUser(formData: FormData): Promise<FormState> {
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!identifier || !password) return { error: "Introduce usuario y contraseña" };

  // Dos límites: por IP (ataques a muchas cuentas) y por cuenta (fuerza bruta a una).
  const ip = await clientIp();
  const accountKey = `login:account:${identifier}`;
  for (const limited of [
    await rateLimit(`login:ip:${ip}`, ...LIMITS.loginPerIp),
    await rateLimit(accountKey, ...LIMITS.loginPerAccount),
  ]) {
    if (!limited.ok) return { error: retryMessage(limited.retryAfterSeconds) };
  }

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(or(eq(users.username, identifier), eq(users.email, identifier)))
    .limit(1);
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    logSecurityEvent("login_failed", { identifier, ip });
    return { error: "Usuario o contraseña incorrectos" };
  }

  await resetRateLimit(accountKey);
  await createSession(user.id);
  redirect(safePath(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
