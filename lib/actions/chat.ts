"use server";

import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { isActiveMember } from "@/lib/chat";
import type { ChatMessage } from "@/lib/chat-types";
import { campaignMembers, db, messages } from "@/lib/db";
import { canChat } from "@/lib/permissions";
import { LIMITS, rateLimit, retryMessage } from "@/lib/rate-limit";
import { ActionError, getActor } from "./shared";

const UUID = /^[0-9a-f-]{36}$/i;

/** Envía un mensaje al chat de grupo (`recipientId` null) o en privado a otro miembro. */
export async function sendMessage(
  campaignId: string,
  body: string,
  recipientId: string | null = null,
): Promise<{ message: ChatMessage } | { error: string }> {
  try {
    const { user, campaign, viewer } = await getActor(campaignId);
    if (!canChat(viewer)) return { error: "Solo los miembros pueden escribir en el chat" };
    const text = typeof body === "string" ? body.trim() : "";
    if (!text) return { error: "El mensaje está vacío" };
    if (text.length > 2000) return { error: "Máximo 2000 caracteres" };
    if (recipientId !== null) {
      if (typeof recipientId !== "string" || !UUID.test(recipientId) || recipientId === user.id) {
        return { error: "Destinatario no válido" };
      }
      if (!(await isActiveMember(campaign.id, recipientId))) return { error: "Esa persona ya no está en la campaña" };
    }
    const limited = await rateLimit(`chat:${user.id}`, ...LIMITS.chatPerUser);
    if (!limited.ok) return { error: retryMessage(limited.retryAfterSeconds) };

    const [row] = await db
      .insert(messages)
      .values({ campaignId: campaign.id, userId: user.id, recipientId, body: text })
      .returning();
    if (recipientId === null) await markGroupRead(campaign.id, user.id, row.id);
    return {
      message: {
        id: row.id,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        userId: user.id,
        recipientId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    };
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    throw e;
  }
}

/** Marca como leído un canal hasta `messageId` ("group" o el id del otro usuario). */
export async function markChatRead(campaignId: string, channel: string, messageId: number): Promise<void> {
  const { user, campaign, viewer } = await getActor(campaignId);
  if (!canChat(viewer) || !Number.isSafeInteger(messageId)) return;
  if (channel === "group") {
    await markGroupRead(campaign.id, user.id, messageId);
  } else if (typeof channel === "string" && UUID.test(channel)) {
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messages.campaignId, campaign.id),
          eq(messages.recipientId, user.id),
          eq(messages.userId, channel),
          isNull(messages.readAt),
          lte(messages.id, messageId),
        ),
      );
  }
}

async function markGroupRead(campaignId: string, userId: string, messageId: number) {
  await db
    .update(campaignMembers)
    .set({ lastReadMessageId: sql`greatest(${campaignMembers.lastReadMessageId}, ${messageId})` })
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)));
}
