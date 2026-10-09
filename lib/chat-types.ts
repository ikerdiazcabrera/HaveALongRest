export type ChatMessage = {
  id: number;
  body: string;
  createdAt: string;
  userId: string | null;
  /** null en el chat de grupo; en privados, el destinatario. */
  recipientId: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type UnreadSummary = {
  group: number;
  /** No leídos por remitente (id de usuario). */
  direct: Record<string, number>;
};

export type ChatContact = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "owner" | "editor" | "player";
};
