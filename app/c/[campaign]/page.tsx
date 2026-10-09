/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { POLICY_LABEL, STATUS_BADGE } from "@/components/CampaignCard";
import { PageCards } from "@/components/campaign/PageCards";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MarkdownView } from "@/components/MarkdownView";
import { joinCampaign, leaveCampaign } from "@/lib/actions/campaigns";
import { buildTree, type CampaignContext, getCampaignContext, getMembers, getVisiblePages } from "@/lib/campaigns";
import { resolveWikilinks } from "@/lib/markdown";
import { isGameMaster, joinOption, ROLE_LABELS } from "@/lib/permissions";

export default async function CampaignHome({ params }: { params: Promise<{ campaign: string }> }) {
  const ctx = await getCampaignContext((await params).campaign);
  if (!ctx) notFound();
  const { campaign } = ctx;
  const [pages, members] = await Promise.all([getVisiblePages(ctx), getMembers(campaign.id)]);
  const active = members.filter((m) => m.status === "active");
  const players = active.filter((m) => m.role === "player").length;
  const status = STATUS_BADGE[campaign.status];
  const topLevel = buildTree(pages);

  return (
    <div className="flex flex-col gap-6">
      <section className="panel overflow-hidden">
        <div className="relative h-48 sm:h-64">
          {campaign.coverImage ? (
            <img src={campaign.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="themed-bg h-full w-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            <h1 className="font-display text-3xl font-bold text-white drop-shadow sm:text-4xl">{campaign.name}</h1>
            {campaign.tagline && <p className="mt-1 max-w-2xl text-white/80">{campaign.tagline}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-7">
          <div className="flex flex-wrap gap-1.5">
            {campaign.gameSystem && <span className="badge badge-accent">{campaign.gameSystem}</span>}
            <span className={`badge ${status.cls}`}>{status.label}</span>
            <span className="badge badge-neutral">
              🎲 {players}
              {campaign.maxPlayers ? `/${campaign.maxPlayers}` : ""} jugadores
            </span>
            <span className="badge badge-neutral">{POLICY_LABEL[campaign.joinPolicy]}</span>
            {campaign.visibility === "private" && <span className="badge badge-red">Privada</span>}
          </div>
          <div className="ml-auto">
            <MembershipControls ctx={ctx} players={players} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="panel p-5 sm:p-7">
            {campaign.description.trim() ? (
              <MarkdownView
                content={resolveWikilinks(campaign.description, pages, campaign.slug)}
                showDm={isGameMaster(ctx.viewer)}
              />
            ) : (
              <p className="text-ink-3 italic">
                {isGameMaster(ctx.viewer) ? (
                  <>
                    Aún no hay descripción.{" "}
                    <Link href={`/c/${campaign.slug}/ajustes`} className="text-accent-2 underline">
                      Añade una en los ajustes
                    </Link>
                    .
                  </>
                ) : (
                  "El máster todavía no ha escrito una descripción."
                )}
              </p>
            )}
          </section>

          {topLevel.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold">Pestañas</h2>
              <PageCards pages={topLevel} campaignSlug={campaign.slug} />
            </section>
          )}
          {topLevel.length === 0 && ctx.viewer.status === null && (
            <p className="card p-5 text-sm text-ink-3">
              El contenido de esta campaña es solo para sus miembros. Únete para ver la historia, los personajes y el chat.
            </p>
          )}
        </div>

        <aside className="panel h-fit p-5" id="miembros">
          <h2 className="mb-3 font-display text-lg font-bold">Miembros · {active.length}</h2>
          <ul className="flex flex-col gap-2.5">
            {active.map((m) => (
              <li key={m.userId}>
                <Link href={`/u/${m.username}`} className="-mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-card">
                <Avatar name={m.displayName} src={m.avatarUrl} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{m.displayName}</span>
                  <span className="block text-xs text-ink-4">@{m.username}</span>
                </span>
                {m.role !== "player" && <span className="badge badge-accent">{ROLE_LABELS[m.role]}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function MembershipControls({ ctx, players }: { ctx: CampaignContext; players: number }) {
  const { campaign, viewer, user } = ctx;
  const hidden = <input type="hidden" name="campaignId" value={campaign.id} />;

  if (!user) {
    return (
      <Link href={`/login?next=/c/${campaign.slug}`} className="btn btn-primary">
        Entra para unirte
      </Link>
    );
  }
  if (viewer.role === "owner" && viewer.status === "active") {
    return (
      <Link href={`/c/${campaign.slug}/ajustes`} className="btn btn-secondary">
        ⚙ Gestionar campaña
      </Link>
    );
  }
  if (viewer.status === "pending") {
    return (
      <ActionForm action={leaveCampaign} className="flex items-center gap-3">
        {hidden}
        <span className="text-sm text-amber-300">Solicitud pendiente</span>
        <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">
          Cancelar solicitud
        </SubmitButton>
      </ActionForm>
    );
  }
  if (viewer.status === "active") {
    return (
      <ActionForm
        action={leaveCampaign}
        confirmMessage={`¿Seguro que quieres salir de “${campaign.name}”? Perderás el acceso a sus páginas y al chat.`}
        className="flex items-center gap-3"
      >
        {hidden}
        <SubmitButton className="btn btn-danger btn-sm" pendingText="Saliendo…">
          Salir de la campaña
        </SubmitButton>
      </ActionForm>
    );
  }

  const option = joinOption(campaign, viewer, players);
  if (option === "closed") return <span className="text-sm text-ink-3">No admite jugadores nuevos</span>;
  if (option === "full") return <span className="text-sm text-ink-3">Campaña completa</span>;
  return (
    <ActionForm action={joinCampaign} className="flex items-center gap-3">
      {hidden}
      <SubmitButton pendingText="Enviando…">{option === "join" ? "Unirme a la campaña" : "Solicitar unirme"}</SubmitButton>
    </ActionForm>
  );
}
