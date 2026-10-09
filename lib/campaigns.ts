import "server-only";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { cache } from "react";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { type Campaign, campaignMembers, campaigns, db, type Page, pages, users } from "@/lib/db";
import { ANONYMOUS, canViewCampaign, canViewPage, type Viewer } from "@/lib/permissions";

export type CampaignContext = {
  campaign: Campaign;
  viewer: Viewer;
  user: SessionUser | null;
};

/**
 * Campaña + rol del usuario actual. Devuelve null si no existe o si el usuario no
 * puede verla (una campaña privada es indistinguible de una inexistente).
 * Memoizado por petición: layout y página lo comparten sin repetir consultas.
 */
export const getCampaignContext = cache(async (slug: string): Promise<CampaignContext | null> => {
  const [[campaign], user] = await Promise.all([
    db.select().from(campaigns).where(eq(campaigns.slug, slug)).limit(1),
    getCurrentUser(),
  ]);
  if (!campaign) return null;

  let viewer: Viewer = ANONYMOUS;
  if (user) {
    const [membership] = await db
      .select({ role: campaignMembers.role, status: campaignMembers.status })
      .from(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, campaign.id), eq(campaignMembers.userId, user.id)))
      .limit(1);
    viewer = { userId: user.id, role: membership?.role ?? null, status: membership?.status ?? null };
  }
  if (!canViewCampaign(campaign, viewer)) return null;
  return { campaign, viewer, user };
});

export type PageSummary = Pick<
  Page,
  "id" | "parentId" | "slug" | "title" | "icon" | "coverImage" | "visibility" | "allowedUserIds" | "spoilers" | "position"
>;

/** Todas las páginas (sin contenido) que el usuario puede ver, ordenadas. */
export const getVisiblePages = cache(async (ctx: CampaignContext): Promise<PageSummary[]> => {
  const rows = await db
    .select({
      id: pages.id,
      parentId: pages.parentId,
      slug: pages.slug,
      title: pages.title,
      icon: pages.icon,
      coverImage: pages.coverImage,
      visibility: pages.visibility,
      allowedUserIds: pages.allowedUserIds,
      spoilers: pages.spoilers,
      position: pages.position,
    })
    .from(pages)
    .where(eq(pages.campaignId, ctx.campaign.id))
    .orderBy(asc(pages.position), asc(pages.title));
  return rows.filter((p) => canViewPage(p, ctx.campaign, ctx.viewer));
});

export type TreeNode = PageSummary & { children: TreeNode[] };

/**
 * Árbol de pestañas. Si el padre de una página no es visible, la página sube a la raíz
 * (detrás de las pestañas reales).
 */
export function buildTree(list: PageSummary[]): TreeNode[] {
  const nodes = new Map(list.map((p) => [p.id, { ...p, children: [] as TreeNode[] }]));
  const roots: TreeNode[] = [];
  const orphans: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else (node.parentId ? orphans : roots).push(node);
  }
  return [...roots, ...orphans];
}

export function ancestorsOf(list: PageSummary[], pageId: string): PageSummary[] {
  const byId = new Map(list.map((p) => [p.id, p]));
  const chain: PageSummary[] = [];
  let current = byId.get(pageId)?.parentId;
  while (current && byId.has(current) && chain.length < 20) {
    const parent = byId.get(current)!;
    chain.unshift(parent);
    current = parent.parentId;
  }
  return chain;
}

/** Página completa, solo si el usuario puede verla. Memoizado (metadata y página la piden). */
export const getPage = cache(async (ctx: CampaignContext, slug: string): Promise<Page | null> => {
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.campaignId, ctx.campaign.id), eq(pages.slug, slug)))
    .limit(1);
  if (!page || !canViewPage(page, ctx.campaign, ctx.viewer)) return null;
  return page;
});

const activePlayerCount = sql<number>`(
  select count(*)::int from ${campaignMembers}
  where ${campaignMembers.campaignId} = ${campaigns.id} and ${campaignMembers.status} = 'active' and ${campaignMembers.role} = 'player'
)`;

export type CampaignCard = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  gameSystem: string;
  coverImage: string | null;
  theme: string;
  customTheme: Campaign["customTheme"];
  status: Campaign["status"];
  joinPolicy: Campaign["joinPolicy"];
  maxPlayers: number | null;
  /** Jugadores activos (sin contar al equipo de máster). */
  players: number;
  ownerName: string;
};

const cardColumns = {
  id: campaigns.id,
  slug: campaigns.slug,
  name: campaigns.name,
  tagline: campaigns.tagline,
  gameSystem: campaigns.gameSystem,
  coverImage: campaigns.coverImage,
  theme: campaigns.theme,
  customTheme: campaigns.customTheme,
  status: campaigns.status,
  joinPolicy: campaigns.joinPolicy,
  maxPlayers: campaigns.maxPlayers,
  players: activePlayerCount,
  ownerName: users.displayName,
};

/** Campañas públicas para la página Explorar. */
export async function listPublicCampaigns(query?: string): Promise<CampaignCard[]> {
  // Escapa los comodines de LIKE para buscar el texto literal.
  const q = query?.trim().replace(/[%_\\]/g, (c) => `\\${c}`);
  return db
    .select(cardColumns)
    .from(campaigns)
    .innerJoin(users, eq(users.id, campaigns.ownerId))
    .where(
      and(
        eq(campaigns.visibility, "public"),
        q
          ? or(ilike(campaigns.name, `%${q}%`), ilike(campaigns.tagline, `%${q}%`), ilike(campaigns.gameSystem, `%${q}%`))
          : undefined,
      ),
    )
    .orderBy(sql`${campaigns.status} = 'finished'`, desc(campaigns.updatedAt))
    .limit(60);
}

export async function listUserCampaigns(userId: string) {
  return db
    .select({ ...cardColumns, role: campaignMembers.role, memberStatus: campaignMembers.status })
    .from(campaignMembers)
    .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
    .innerJoin(users, eq(users.id, campaigns.ownerId))
    .where(eq(campaignMembers.userId, userId))
    .orderBy(desc(campaigns.updatedAt));
}

export type MemberRow = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "owner" | "editor" | "player";
  status: "active" | "pending";
  joinedAt: Date;
};

export const getMembers = cache(async (campaignId: string): Promise<MemberRow[]> => {
  return db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: campaignMembers.role,
      status: campaignMembers.status,
      joinedAt: campaignMembers.joinedAt,
    })
    .from(campaignMembers)
    .innerJoin(users, eq(users.id, campaignMembers.userId))
    .where(eq(campaignMembers.campaignId, campaignId))
    .orderBy(sql`case ${campaignMembers.role} when 'owner' then 0 when 'editor' then 1 else 2 end`, asc(campaignMembers.joinedAt));
});
