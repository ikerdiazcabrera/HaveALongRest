"use server";

import { and, eq, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { campaignMembers, campaigns, type CustomTheme, db, pages } from "@/lib/db";
import { canManageCampaign, canReviewRequests, canViewCampaign, isActiveMember, joinOption } from "@/lib/permissions";
import { LIMITS, rateLimit, retryMessage } from "@/lib/rate-limit";
import { slugify, uniqueSlug } from "@/lib/slug";
import { CUSTOM_THEME_ID, THEME_IDS } from "@/lib/themes";
import { hexColorSchema } from "@/lib/validation";
import { ActionError, assert, firstIssue, type FormState, getActor, withFormErrors } from "./shared";

const optionalInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().int().min(1, "Mínimo 1 jugador").max(100, "Máximo 100 jugadores").nullable(),
);

const campaignFields = {
  name: z.string().trim().min(3, "El nombre necesita al menos 3 caracteres").max(80, "Nombre demasiado largo"),
  tagline: z.string().trim().max(140, "El lema no puede pasar de 140 caracteres").default(""),
  gameSystem: z.string().trim().max(60).default(""),
  description: z.string().max(20000, "Descripción demasiado larga").default(""),
  visibility: z.enum(["public", "private"]),
  joinPolicy: z.enum(["open", "request", "closed"]),
  theme: z.enum(THEME_IDS),
  maxPlayers: optionalInt,
  customAccent: hexColorSchema.optional(),
  customBg1: hexColorSchema.optional(),
  customBg2: hexColorSchema.optional(),
  customBg3: hexColorSchema.optional(),
};

/** Separa los campos del tema personalizado y los convierte en el JSON que se guarda. */
function withCustomTheme<T extends { theme: string; customAccent?: string; customBg1?: string; customBg2?: string; customBg3?: string }>(
  data: T,
) {
  const { customAccent, customBg1, customBg2, customBg3, ...rest } = data;
  if (rest.theme !== CUSTOM_THEME_ID) return { ...rest, customTheme: null };
  if (!customAccent || !customBg1 || !customBg2 || !customBg3) throw new ActionError("Faltan colores del tema personalizado");
  const customTheme: CustomTheme = { accent: customAccent, background: [customBg1, customBg2, customBg3] };
  return { ...rest, customTheme };
}

const createSchema = z.object(campaignFields);
const updateSchema = z.object({
  ...campaignFields,
  status: z.enum(["active", "paused", "finished"]),
  coverImage: z.string().trim().max(500).default(""),
});

const STARTER_PAGES = [
  { title: "Historia", icon: "📜", visibility: "members" as const, content: "## Sesión 1\n\nResumen de lo ocurrido…" },
  { title: "Personajes", icon: "👥", visibility: "members" as const, content: "" },
  { title: "Mundo", icon: "🗺️", visibility: "public" as const, content: "Describe el mundo de la campaña." },
  { title: "Notas del máster", icon: "🔒", visibility: "dm" as const, content: "Solo el equipo de máster ve esta página." },
];

export async function createCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/campanas/nueva");
  const limited = await rateLimit(`campaign:create:${user.id}`, ...LIMITS.createCampaignPerUser);
  if (!limited.ok) return { error: retryMessage(limited.retryAfterSeconds) };
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  let data;
  try {
    data = withCustomTheme(parsed.data);
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    throw e;
  }

  const base = slugify(data.name, "campana");
  const taken = await db.select({ slug: campaigns.slug }).from(campaigns).where(like(campaigns.slug, `${base}%`));
  const slug = uniqueSlug(base, new Set(taken.map((t) => t.slug)));

  await db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(campaigns)
      .values({ ...data, slug, ownerId: user.id })
      .returning({ id: campaigns.id });
    await tx.insert(campaignMembers).values({ campaignId: campaign.id, userId: user.id, role: "owner" });
    if (formData.get("starterPages") === "on") {
      await tx.insert(pages).values(
        STARTER_PAGES.map((p, position) => ({ ...p, campaignId: campaign.id, slug: slugify(p.title), position, updatedBy: user.id })),
      );
    }
  });
  redirect(`/c/${slug}`);
}

export async function updateCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  return withFormErrors(async () => {
    const { campaign, viewer } = await getActor(formData.get("campaignId"));
    assert(canManageCampaign(viewer));
    const parsed = updateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const { coverImage, ...data } = withCustomTheme(parsed.data);
    await db
      .update(campaigns)
      .set({ ...data, coverImage: coverImage || null, updatedAt: new Date() })
      .where(eq(campaigns.id, campaign.id));
    revalidatePath(`/c/${campaign.slug}`, "layout");
    revalidatePath("/");
    return { ok: "Cambios guardados" };
  });
}

export async function deleteCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await withFormErrors(async () => {
    const { campaign, viewer } = await getActor(formData.get("campaignId"));
    assert(canManageCampaign(viewer));
    if (String(formData.get("confirm") ?? "").trim() !== campaign.name) {
      return { error: "Escribe el nombre exacto de la campaña para confirmar" };
    }
    await db.delete(campaigns).where(eq(campaigns.id, campaign.id));
    return { ok: "deleted" };
  });
  if (result?.ok === "deleted") {
    revalidatePath("/");
    redirect("/");
  }
  return result;
}

// ─── Entrar / salir ──────────────────────────────────────────────────────────

export async function joinCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  return withFormErrors(async () => {
    const { user, campaign, viewer } = await getActor(formData.get("campaignId"));
    assert(canViewCampaign(campaign, viewer), "La campaña no existe");
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(campaignMembers)
      .where(
        and(
          eq(campaignMembers.campaignId, campaign.id),
          eq(campaignMembers.status, "active"),
          eq(campaignMembers.role, "player"),
        ),
      );
    const option = joinOption(campaign, viewer, n);
    if (option === "closed") return { error: "Esta campaña no admite jugadores nuevos" };
    if (option === "full") return { error: "La campaña está completa" };
    if (option === null) return { error: "Ya formas parte de esta campaña" };

    await db.insert(campaignMembers).values({
      campaignId: campaign.id,
      userId: user.id,
      role: "player",
      status: option === "join" ? "active" : "pending",
    });
    revalidatePath(`/c/${campaign.slug}`, "layout");
    return { ok: option === "join" ? "¡Bienvenido a la campaña!" : "Solicitud enviada al máster" };
  });
}

/** Salir de la campaña (o cancelar una solicitud pendiente). El máster no puede salir sin transferirla. */
export async function leaveCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  return withFormErrors(async () => {
    const { user, campaign, viewer } = await getActor(formData.get("campaignId"));
    if (viewer.status === null) return { error: "No formas parte de esta campaña" };
    if (viewer.role === "owner") return { error: "Transfiere la campaña a otro miembro antes de salir" };
    await db
      .delete(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, campaign.id), eq(campaignMembers.userId, user.id)));
    revalidatePath(`/c/${campaign.slug}`, "layout");
    return { ok: viewer.status === "pending" ? "Solicitud cancelada" : "Has salido de la campaña" };
  });
}

// ─── Gestión de miembros ─────────────────────────────────────────────────────

const memberSchema = z.object({ campaignId: z.string(), userId: z.uuid() });

async function loadTarget(formData: FormData) {
  const { campaignId, userId } = memberSchema.parse(Object.fromEntries(formData));
  const actor = await getActor(campaignId);
  const [target] = await db
    .select()
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, actor.campaign.id), eq(campaignMembers.userId, userId)))
    .limit(1);
  assert(target, "Ese usuario no está en la campaña");
  const where = and(eq(campaignMembers.campaignId, actor.campaign.id), eq(campaignMembers.userId, userId));
  return { ...actor, target, where };
}

export async function reviewRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  return withFormErrors(async () => {
    const { campaign, viewer, target, where } = await loadTarget(formData);
    assert(canReviewRequests(viewer));
    assert(target.status === "pending", "No hay ninguna solicitud pendiente");
    if (formData.get("decision") === "approve") {
      await db.update(campaignMembers).set({ status: "active", joinedAt: new Date() }).where(where);
    } else {
      await db.delete(campaignMembers).where(where);
    }
    revalidatePath(`/c/${campaign.slug}`, "layout");
    return { ok: "Hecho" };
  });
}

export async function setMemberRole(_prev: FormState, formData: FormData): Promise<FormState> {
  return withFormErrors(async () => {
    const { campaign, viewer, target, where } = await loadTarget(formData);
    assert(canManageCampaign(viewer));
    assert(target.role !== "owner" && target.status === "active", "No se puede cambiar el rol de este miembro");
    const role = z.enum(["editor", "player"]).parse(formData.get("role"));
    await db.update(campaignMembers).set({ role }).where(where);
    revalidatePath(`/c/${campaign.slug}`, "layout");
    return { ok: "Rol actualizado" };
  });
}

export async function removeMember(_prev: FormState, formData: FormData): Promise<FormState> {
  return withFormErrors(async () => {
    const { campaign, viewer, target, where } = await loadTarget(formData);
    assert(canManageCampaign(viewer));
    assert(target.role !== "owner", "No puedes expulsar al máster");
    await db.delete(campaignMembers).where(where);
    revalidatePath(`/c/${campaign.slug}`, "layout");
    return { ok: "Miembro expulsado" };
  });
}

export async function transferOwnership(_prev: FormState, formData: FormData): Promise<FormState> {
  return withFormErrors(async () => {
    const { user, campaign, viewer, target, where } = await loadTarget(formData);
    assert(canManageCampaign(viewer));
    assert(isActiveMember({ userId: target.userId, role: target.role, status: target.status }), "Debe ser un miembro activo");
    assert(target.userId !== user.id, "Ya eres el máster");
    await db.transaction(async (tx) => {
      await tx.update(campaignMembers).set({ role: "owner" }).where(where);
      await tx
        .update(campaignMembers)
        .set({ role: "editor" })
        .where(and(eq(campaignMembers.campaignId, campaign.id), eq(campaignMembers.userId, user.id)));
      await tx.update(campaigns).set({ ownerId: target.userId, updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));
    });
    revalidatePath(`/c/${campaign.slug}`, "layout");
    return { ok: "Campaña transferida. Ahora eres co-máster." };
  });
}
