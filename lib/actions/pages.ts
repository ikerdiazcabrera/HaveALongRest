"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { campaignMembers, db, pages } from "@/lib/db";
import { canEditPages } from "@/lib/permissions";
import { slugify, uniqueSlug } from "@/lib/slug";
import { ActionError, assert, firstIssue, type FormState, getActor, safePath, withFormErrors } from "./shared";

const visibility = z.enum(["public", "members", "restricted", "dm"]);
const optionalId = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable());

async function editorActor(campaignId: unknown) {
  const actor = await getActor(campaignId);
  assert(canEditPages(actor.viewer), "Solo el equipo de máster puede editar páginas");
  return actor;
}

async function takenSlugs(campaignId: string) {
  const rows = await db.select({ slug: pages.slug }).from(pages).where(eq(pages.campaignId, campaignId));
  return new Set(rows.map((r) => r.slug));
}

async function assertPageInCampaign(pageId: string, campaignId: string) {
  const [row] = await db
    .select({ id: pages.id, parentId: pages.parentId })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.campaignId, campaignId)))
    .limit(1);
  if (!row) throw new ActionError("La página no existe");
  return row;
}

const createSchema = z.object({
  title: z.string().trim().min(1, "Ponle un título").max(120),
  parentId: optionalId,
  visibility,
});

export async function createPage(_prev: FormState, formData: FormData): Promise<FormState> {
  let target = "";
  const result = await withFormErrors(async () => {
    const { user, campaign } = await editorActor(formData.get("campaignId"));
    const { title, parentId, visibility } = createSchema.parse(Object.fromEntries(formData));
    if (parentId) await assertPageInCampaign(parentId, campaign.id);

    const slug = uniqueSlug(slugify(title), await takenSlugs(campaign.id));
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${pages.position}) + 1, 0)::int` })
      .from(pages)
      .where(and(eq(pages.campaignId, campaign.id), parentId ? eq(pages.parentId, parentId) : sql`${pages.parentId} is null`));
    await db.insert(pages).values({
      campaignId: campaign.id,
      parentId,
      slug,
      title,
      visibility,
      position: next,
      updatedBy: user.id,
    });
    revalidatePath(`/c/${campaign.slug}`, "layout");
    target = `/c/${campaign.slug}/p/${slug}/editar`;
    return undefined;
  });
  if (target) redirect(target);
  return result;
}

const updateSchema = z.object({
  pageId: z.uuid(),
  title: z.string().trim().min(1, "Ponle un título").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "La URL solo admite minúsculas, números y guiones")
    .max(80),
  icon: z.string().trim().max(8, "El icono debe ser un emoji o un par de caracteres").default(""),
  parentId: optionalId,
  visibility,
  spoilers: z.preprocess((v) => v === "on", z.boolean()),
  coverImage: z.string().trim().max(500).default(""),
  content: z.string().max(200_000, "La página es demasiado larga"),
});

export type SavePageState = (FormState & { slug?: string; savedAt?: number }) | undefined;

export async function updatePage(_prev: SavePageState, formData: FormData): Promise<SavePageState> {
  return withFormErrors(async () => {
    const { user, campaign } = await editorActor(formData.get("campaignId"));
    const parsed = updateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const data = parsed.data;
    const page = await assertPageInCampaign(data.pageId, campaign.id);

    // El nuevo padre no puede ser la propia página ni una de sus descendientes.
    if (data.parentId) {
      await assertPageInCampaign(data.parentId, campaign.id);
      const all = await db.select({ id: pages.id, parentId: pages.parentId }).from(pages).where(eq(pages.campaignId, campaign.id));
      const parentOf = new Map(all.map((p) => [p.id, p.parentId]));
      for (let cur: string | null = data.parentId, i = 0; cur && i < 100; cur = parentOf.get(cur) ?? null, i++) {
        if (cur === page.id) return { error: "Una página no puede estar dentro de sí misma" };
      }
    }

    // Solo jugadores activos de la campaña pueden estar en la lista de acceso.
    const requested = formData.getAll("allowedUserIds").map(String);
    const allowedUserIds = requested.length
      ? (
          await db
            .select({ id: campaignMembers.userId })
            .from(campaignMembers)
            .where(
              and(
                eq(campaignMembers.campaignId, campaign.id),
                eq(campaignMembers.status, "active"),
                inArray(campaignMembers.userId, requested.filter((id) => z.uuid().safeParse(id).success)),
              ),
            )
        ).map((r) => r.id)
      : [];

    await db
      .update(pages)
      .set({
        title: data.title,
        slug: data.slug,
        icon: data.icon,
        parentId: data.parentId,
        visibility: data.visibility,
        allowedUserIds,
        spoilers: data.spoilers,
        coverImage: data.coverImage || null,
        content: data.content,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, page.id));
    revalidatePath(`/c/${campaign.slug}`, "layout");
    return { ok: "Guardado", slug: data.slug, savedAt: Date.now() };
  });
}

/** Borra una página; sus subpáginas suben un nivel en vez de perderse. */
export async function deletePage(_prev: FormState, formData: FormData): Promise<FormState> {
  let target = "";
  const result = await withFormErrors(async () => {
    const { campaign } = await editorActor(formData.get("campaignId"));
    const pageId = z.uuid().parse(formData.get("pageId"));
    const page = await assertPageInCampaign(pageId, campaign.id);
    await db.transaction(async (tx) => {
      await tx.update(pages).set({ parentId: page.parentId }).where(eq(pages.parentId, page.id));
      await tx.delete(pages).where(eq(pages.id, page.id));
    });
    revalidatePath(`/c/${campaign.slug}`, "layout");
    target = safePath(formData.get("returnTo"), `/c/${campaign.slug}`);
    return undefined;
  });
  if (target) redirect(target);
  return result;
}

/** Sube o baja una página entre sus hermanas. */
export async function movePage(formData: FormData): Promise<void> {
  const { campaign } = await editorActor(formData.get("campaignId"));
  const pageId = z.uuid().parse(formData.get("pageId"));
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const page = await assertPageInCampaign(pageId, campaign.id);

  const siblings = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.campaignId, campaign.id), page.parentId ? eq(pages.parentId, page.parentId) : sql`${pages.parentId} is null`))
    .orderBy(asc(pages.position), asc(pages.title));
  const index = siblings.findIndex((s) => s.id === pageId);
  const swap = index + direction;
  if (swap < 0 || swap >= siblings.length) return;
  [siblings[index], siblings[swap]] = [siblings[swap], siblings[index]];

  await db.transaction(async (tx) => {
    for (const [position, sibling] of siblings.entries()) {
      await tx.update(pages).set({ position }).where(eq(pages.id, sibling.id));
    }
  });
  revalidatePath(`/c/${campaign.slug}`, "layout");
}
