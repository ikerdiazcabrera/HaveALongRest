import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { campaignMembers, campaigns, db, users } from "@/lib/db";

export async function getOwnProfile(userId: string) {
  const [user] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      favoriteGames: users.favoriteGames,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}

/**
 * Perfil público. Solo lista las campañas que quien mira también podría ver: las
 * públicas y las privadas de las que él mismo es miembro.
 */
export async function getPublicProfile(username: string, viewerId: string | null) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      favoriteGames: users.favoriteGames,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  if (!user) return null;

  const viewerCampaigns = viewerId
    ? db
        .select({ id: campaignMembers.campaignId })
        .from(campaignMembers)
        .where(and(eq(campaignMembers.userId, viewerId), eq(campaignMembers.status, "active")))
    : null;

  const memberships = await db
    .select({
      slug: campaigns.slug,
      name: campaigns.name,
      gameSystem: campaigns.gameSystem,
      status: campaigns.status,
      role: campaignMembers.role,
    })
    .from(campaignMembers)
    .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
    .where(
      and(
        eq(campaignMembers.userId, user.id),
        eq(campaignMembers.status, "active"),
        viewerCampaigns
          ? or(eq(campaigns.visibility, "public"), inArray(campaigns.id, viewerCampaigns))
          : eq(campaigns.visibility, "public"),
      ),
    )
    .orderBy(desc(campaigns.updatedAt));

  return { ...user, campaigns: memberships };
}
