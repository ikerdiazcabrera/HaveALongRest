"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { destroyOtherSessions, destroySession, getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { campaigns, db, messages, users } from "@/lib/db";
import { logSecurityEvent } from "@/lib/log";
import { LIMITS, rateLimit, retryMessage } from "@/lib/rate-limit";
import { saveImage, UploadError } from "@/lib/storage";
import { displayNameSchema, MAX_FAVORITE_GAMES } from "@/lib/validation";
import { ActionError, firstIssue, type FormState, withFormErrors } from "./shared";

async function actor(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("Tu sesión ha caducado. Vuelve a entrar.");
  return user;
}

const profileSchema = z.object({
  displayName: displayNameSchema,
  bio: z.string().trim().max(1000, "La descripción no puede pasar de 1000 caracteres"),
  favoriteGames: z
    .array(z.string().trim().max(40, "Cada juego puede tener como mucho 40 caracteres"))
    .transform((games) => {
      const seen = new Set<string>();
      return games.filter((g) => g && !seen.has(g.toLowerCase()) && seen.add(g.toLowerCase()));
    })
    .pipe(z.array(z.string()).max(MAX_FAVORITE_GAMES, `Como mucho ${MAX_FAVORITE_GAMES} juegos favoritos`)),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  return withFormErrors(async () => {
    const user = await actor();
    const parsed = profileSchema.safeParse({
      displayName: formData.get("displayName"),
      bio: formData.get("bio") ?? "",
      favoriteGames: formData.getAll("favoriteGames").map(String),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    await db.update(users).set(parsed.data).where(eq(users.id, user.id));
    revalidatePath("/", "layout");
    return { ok: "Perfil actualizado" };
  });
}

export async function uploadAvatar(formData: FormData): Promise<{ url: string } | { error: string }> {
  try {
    const user = await actor();
    const limited = await rateLimit(`upload:${user.id}`, ...LIMITS.uploadPerUser);
    if (!limited.ok) return { error: retryMessage(limited.retryAfterSeconds) };
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "No se ha recibido ninguna imagen" };
    const url = await saveImage(file, `avatars/${user.id}`);
    await db.update(users).set({ avatarUrl: url }).where(eq(users.id, user.id));
    revalidatePath("/", "layout");
    return { url };
  } catch (e) {
    if (e instanceof ActionError || e instanceof UploadError) return { error: e.message };
    throw e;
  }
}

export async function removeAvatar(): Promise<void> {
  const user = await actor();
  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
}

/** Comprueba la contraseña actual con límite de intentos (protege también el borrado de cuenta). */
async function checkPassword(user: SessionUser, password: string) {
  const limited = await rateLimit(`password:${user.id}`, ...LIMITS.passwordPerUser);
  if (!limited.ok) throw new ActionError(retryMessage(limited.retryAfterSeconds));
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(password.slice(0, 200), row.hash))) {
    logSecurityEvent("password_check_failed", { userId: user.id });
    throw new ActionError("La contraseña actual no es correcta");
  }
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  return withFormErrors(async () => {
    const user = await actor();
    const next = passwordSchema.safeParse(formData.get("newPassword"));
    if (!next.success) return { error: firstIssue(next.error) };
    if (next.data !== formData.get("confirmPassword")) return { error: "Las contraseñas nuevas no coinciden" };
    await checkPassword(user, String(formData.get("currentPassword") ?? ""));

    await db.update(users).set({ passwordHash: await hashPassword(next.data) }).where(eq(users.id, user.id));
    // Si alguien conocía la contraseña antigua, pierde las sesiones que tuviera abiertas.
    await destroyOtherSessions(user.id);
    logSecurityEvent("password_changed", { userId: user.id });
    return { ok: "Contraseña cambiada. Se ha cerrado la sesión en tus otros dispositivos." };
  });
}

export async function logoutOtherSessions(): Promise<FormState> {
  return withFormErrors(async () => {
    const user = await actor();
    await destroyOtherSessions(user.id);
    return { ok: "Sesión cerrada en el resto de dispositivos" };
  });
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await withFormErrors(async () => {
    const user = await actor();
    if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== user.username) {
      return { error: "Escribe tu nombre de usuario exacto para confirmar" };
    }
    await checkPassword(user, String(formData.get("password") ?? ""));

    // Las campañas que dirige se quedarían sin máster: hay que cederlas o borrarlas antes.
    const owned = await db.select({ name: campaigns.name }).from(campaigns).where(eq(campaigns.ownerId, user.id));
    if (owned.length) {
      return {
        error: `Antes de borrar tu cuenta, cede o borra tus campañas: ${owned.map((c) => c.name).join(", ")}.`,
      };
    }

    await db.transaction(async (tx) => {
      // Los privados enviados se borran (los recibidos caen en cascada con el usuario).
      // En el chat de grupo sus mensajes quedan como "Usuario eliminado".
      await tx.delete(messages).where(and(eq(messages.userId, user.id), isNotNull(messages.recipientId)));
      await tx.delete(users).where(eq(users.id, user.id));
    });
    logSecurityEvent("account_deleted", { userId: user.id });
    return { ok: "deleted" };
  });
  if (result?.ok === "deleted") {
    await destroySession();
    redirect("/?cuenta=borrada");
  }
  return result;
}
