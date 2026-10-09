/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { CampaignCard as Card } from "@/lib/campaigns";
import { themeProps } from "@/lib/themes";

export const STATUS_BADGE: Record<Card["status"], { label: string; cls: string }> = {
  active: { label: "Activa", cls: "badge-green" },
  paused: { label: "En pausa", cls: "badge-amber" },
  finished: { label: "Terminada", cls: "badge-neutral" },
};

export const POLICY_LABEL: Record<Card["joinPolicy"], string> = {
  open: "Entrada libre",
  request: "Con solicitud",
  closed: "Cerrada",
};

export function CampaignCard({ campaign, extra }: { campaign: Card; extra?: React.ReactNode }) {
  const status = STATUS_BADGE[campaign.status];
  return (
    <Link
      href={`/c/${campaign.slug}`}
      {...themeProps(campaign.theme, campaign.customTheme)}
      className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-accent/60"
    >
      <div className="themed-bg relative h-36 overflow-hidden">
        {campaign.coverImage && (
          <img
            src={campaign.coverImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.03] group-hover:opacity-100"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        <span className={`badge absolute top-2 right-2 ${status.cls}`}>{status.label}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-display text-lg leading-tight font-bold text-ink">{campaign.name}</h3>
        {campaign.tagline && <p className="line-clamp-2 text-sm text-ink-3">{campaign.tagline}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-xs text-ink-3">
          {campaign.gameSystem && <span className="badge badge-accent">{campaign.gameSystem}</span>}
          <span className="badge badge-neutral" title="Jugadores">
            🎲 {campaign.players}
            {campaign.maxPlayers ? `/${campaign.maxPlayers}` : ""} jugadores
          </span>
          <span className="badge badge-neutral">{POLICY_LABEL[campaign.joinPolicy]}</span>
          {extra}
        </div>
        <p className="text-xs text-ink-4">Máster: {campaign.ownerName}</p>
      </div>
    </Link>
  );
}
