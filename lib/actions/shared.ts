import "server-only";
import { and, eq } from "drizzle-orm";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { type Campaign, campaignMembers, campaigns, db } from "@/lib/db";
import type { Viewer } from "@/lib/permissions";
import { ZodError } from "zod";

/** Estado que devuelven las acciones usadas con useActionState. */
export type FormState =
  | {
      error?: string;
      ok?: string;
      /** Valores enviados (nunca contraseñas) para reponerlos: React vacía el formulario tras enviarlo. */
      values?: Record<string, string>;
    }
  | undefined;

export class ActionError extends Error {}

/** Usuario + campaña + rol de quien ejecuta la acción. Lanza ActionError si algo falla. */
export async function getActor(campaignId: unknown): Promise<{ user: SessionUser; campaign: Campaign; viewer: Viewer }> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("Tienes que iniciar sesión");
  if (typeof campaignId !== "string" || !/^[0-9a-f-]{36}$/i.test(campaignId)) {
    throw new ActionError("Campaña no válida");
  }
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!campaign) throw new ActionError("La campaña no existe");
  const [membership] = await db
    .select({ role: campaignMembers.role, status: campaignMembers.status })
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, campaign.id), eq(campaignMembers.userId, user.id)))
    .limit(1);
  return {
    user,
    campaign,
    viewer: { userId: user.id, role: membership?.role ?? null, status: membership?.status ?? null },
  };
}

export function assert(condition: unknown, message = "No tienes permiso para hacer esto"): asserts condition {
  if (!condition) throw new ActionError(message);
}

/** Ejecuta una acción con estado y convierte los ActionError en `{ error }`. */
export async function withFormErrors(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    if (e instanceof ZodError) return { error: firstIssue(e) };
    if (isUniqueViolation(e)) return { error: "Ese valor ya está en uso" };
    throw e; // incluye los redirect() de Next, que se propagan como excepciones
  }
}

export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/** Primer mensaje de error legible de un resultado de zod. */
export function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Datos no válidos";
}

/** Evita redirecciones abiertas: solo rutas internas. */
export function safePath(value: unknown, fallback = "/"): string {
  // "//evil.com" y "/\evil.com" los navegadores los tratan como otro dominio.
  return typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : fallback;
}
