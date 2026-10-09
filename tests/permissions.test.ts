import { describe, expect, it } from "vitest";
import { ANONYMOUS, canViewPage, joinOption, type Viewer } from "../lib/permissions";

const publicCampaign = { visibility: "public" as const };
const privateCampaign = { visibility: "private" as const };

const owner: Viewer = { userId: "o", role: "owner", status: "active" };
const editor: Viewer = { userId: "e", role: "editor", status: "active" };
const player: Viewer = { userId: "p", role: "player", status: "active" };
const pending: Viewer = { userId: "q", role: "player", status: "pending" };
const outsider: Viewer = { userId: "x", role: null, status: null };

const page = (visibility: "public" | "members" | "restricted" | "dm", allowedUserIds: string[] = []) => ({
  visibility,
  allowedUserIds,
});

describe("canViewPage", () => {
  it("pública: la ve cualquiera si la campaña es pública", () => {
    for (const v of [ANONYMOUS, outsider, pending, player]) {
      expect(canViewPage(page("public"), publicCampaign, v)).toBe(true);
    }
  });

  it("campaña privada: nada para quien no es miembro", () => {
    expect(canViewPage(page("public"), privateCampaign, outsider)).toBe(false);
    expect(canViewPage(page("public"), privateCampaign, pending)).toBe(false);
    expect(canViewPage(page("public"), privateCampaign, player)).toBe(true);
  });

  it("solo miembros: excluye pendientes y anónimos", () => {
    expect(canViewPage(page("members"), publicCampaign, player)).toBe(true);
    expect(canViewPage(page("members"), publicCampaign, pending)).toBe(false);
    expect(canViewPage(page("members"), publicCampaign, ANONYMOUS)).toBe(false);
  });

  it("restringida: solo los jugadores indicados y el equipo de máster", () => {
    const p = page("restricted", ["p"]);
    expect(canViewPage(p, publicCampaign, player)).toBe(true);
    expect(canViewPage(p, publicCampaign, { ...player, userId: "otro" })).toBe(false);
    expect(canViewPage(p, publicCampaign, { ...pending, userId: "p" })).toBe(false);
    expect(canViewPage(p, publicCampaign, editor)).toBe(true);
  });

  it("máster: solo owner y editores", () => {
    expect(canViewPage(page("dm"), publicCampaign, owner)).toBe(true);
    expect(canViewPage(page("dm"), publicCampaign, editor)).toBe(true);
    expect(canViewPage(page("dm"), publicCampaign, player)).toBe(false);
  });
});

describe("joinOption", () => {
  const open = { joinPolicy: "open" as const, maxPlayers: null };
  it("según la política de entrada", () => {
    expect(joinOption(open, outsider, 3)).toBe("join");
    expect(joinOption({ ...open, joinPolicy: "request" }, outsider, 3)).toBe("request");
    expect(joinOption({ ...open, joinPolicy: "closed" }, outsider, 3)).toBe("closed");
  });
  it("respeta el máximo de jugadores", () => {
    expect(joinOption({ ...open, maxPlayers: 3 }, outsider, 3)).toBe("full");
  });
  it("null si ya es miembro o está pendiente", () => {
    expect(joinOption(open, player, 0)).toBeNull();
    expect(joinOption(open, pending, 0)).toBeNull();
  });
});
