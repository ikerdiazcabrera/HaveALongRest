import "server-only";
import { and, asc, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import type { ChatMessage, UnreadSummary } from "@/lib/chat-types";
import { campaignMembers, db, messages, users } from "@/lib/db";

/** "group" o el id del otro usuario de una conversación privada. */
export type Channel = "group" | { with: string };

/** Condición SQL de los mensajes de un canal, vistos por `userId`. */
function channelWhere(campaignId: string, userId: string, channel: Channel) {
  if (channel === "group") return and(eq(messages.campaignId, campaignId), isNull(messages.recipientId));
  // Privado: solo los mensajes entre estas dos personas, en cualquier sentido.
  return and(
    eq(messages.campaignId, campaignId),
    or(
      and(eq(messages.userId, userId), eq(messages.recipientId, channel.with)),
      and(eq(messages.userId, channel.with), eq(messages.recipientId, userId)),
    ),
  );
}

export async function fetchChannel(campaignId: string, userId: string, channel: Channel, after: number): Promise<ChatMessage[]> {
  const columns = {
    id: messages.id,
    body: messages.body,
    createdAt: messages.createdAt,
    userId: messages.userId,
    recipientId: messages.recipientId,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  };
  const base = db.select(columns).from(messages).leftJoin(users, eq(users.id, messages.userId));
  const where = channelWhere(campaignId, userId, channel);
  const rows =
    after > 0
      ? await base.where(and(where, gt(messages.id, after))).orderBy(asc(messages.id)).limit(200)
      : (await base.where(where).orderBy(desc(messages.id)).limit(50)).reverse();
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** No leídos: grupo (por cursor de la membresía) y privados (por read_at), por remitente. */
export async function unreadSummary(campaignId: string, userId: string): Promise<UnreadSummary> {
  const [group, direct] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(
        campaignMembers,
        and(eq(campaignMembers.campaignId, messages.campaignId), eq(campaignMembers.userId, userId)),
      )
      .where(
        and(
          eq(messages.campaignId, campaignId),
          isNull(messages.recipientId),
          gt(messages.id, campaignMembers.lastReadMessageId),
          or(ne(messages.userId, userId), isNull(messages.userId)),
        ),
      ),
    db
      .select({ from: messages.userId, n: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.campaignId, campaignId), eq(messages.recipientId, userId), isNull(messages.readAt)))
      .groupBy(messages.userId),
  ]);
  return {
    group: group[0]?.n ?? 0,
    direct: Object.fromEntries(direct.filter((d) => d.from).map((d) => [d.from!, d.n])),
  };
}

export async function isActiveMember(campaignId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: campaignMembers.status })
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)))
    .limit(1);
  return row?.status === "active";
}

export function parseChannel(value: string | null): Channel | "none" | null {
  if (!value || value === "none") return "none";
  if (value === "group") return "group";
  return /^[0-9a-f-]{36}$/i.test(value) ? { with: value } : null;
}
