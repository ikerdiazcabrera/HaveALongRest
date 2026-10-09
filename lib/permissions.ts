// Reglas de acceso centralizadas. Funciones puras: las usan tanto las páginas (para
// decidir qué mostrar) como las server actions (para decidir qué permitir).
import type { MemberRole, PageVisibility } from "./db/schema";

export type Viewer = {
  userId: string | null;
  role: MemberRole | null;
  status: "active" | "pending" | null;
};

export const ANONYMOUS: Viewer = { userId: null, role: null, status: null };

export function isActiveMember(v: Viewer): boolean {
  return v.userId !== null && v.status === "active";
}

/** Owner o editor activo: edita contenido y ve los bloques de máster. */
export function isGameMaster(v: Viewer): boolean {
  return isActiveMember(v) && (v.role === "owner" || v.role === "editor");
}

export function isOwner(v: Viewer): boolean {
  return isActiveMember(v) && v.role === "owner";
}

export function canViewCampaign(campaign: { visibility: "public" | "private" }, v: Viewer): boolean {
  return campaign.visibility === "public" || isActiveMember(v);
}

export function canViewPage(
  page: { visibility: PageVisibility; allowedUserIds: string[] },
  campaign: { visibility: "public" | "private" },
  v: Viewer,
): boolean {
  if (!canViewCampaign(campaign, v)) return false;
  if (isGameMaster(v)) return true;
  switch (page.visibility) {
    case "public":
      return true;
    case "members":
      return isActiveMember(v);
    case "restricted":
      return isActiveMember(v) && page.allowedUserIds.includes(v.userId!);
    case "dm":
      return false;
  }
}

export const canEditPages = isGameMaster;
export const canSeeDmContent = isGameMaster;
export const canManageCampaign = isOwner;
export const canChat = isActiveMember;
/** Aprobar o rechazar solicitudes de entrada. */
export const canReviewRequests = isGameMaster;

export type JoinOption = "join" | "request" | "full" | "closed" | null;

/** Qué puede hacer un usuario logueado que aún no es miembro. null = ya es miembro o pendiente. */
export function joinOption(
  campaign: { joinPolicy: "open" | "request" | "closed"; maxPlayers: number | null },
  v: Viewer,
  activePlayers: number,
): JoinOption {
  if (v.status !== null) return null;
  if (campaign.joinPolicy === "closed") return "closed";
  if (campaign.maxPlayers !== null && activePlayers >= campaign.maxPlayers) return "full";
  return campaign.joinPolicy === "open" ? "join" : "request";
}

export const VISIBILITY_LABELS: Record<PageVisibility, string> = {
  public: "Pública",
  members: "Solo miembros",
  restricted: "Jugadores concretos",
  dm: "Solo máster",
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Máster",
  editor: "Co-máster",
  player: "Jugador",
};
