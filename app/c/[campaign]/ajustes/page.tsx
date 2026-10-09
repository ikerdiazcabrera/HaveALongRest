import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { CampaignForm } from "@/components/CampaignForm";
import { ActionForm, SubmitButton } from "@/components/forms";
import {
  deleteCampaign,
  removeMember,
  reviewRequest,
  setMemberRole,
  transferOwnership,
  updateCampaign,
} from "@/lib/actions/campaigns";
import { movePage } from "@/lib/actions/pages";
import { requireUser } from "@/lib/auth/session";
import { getCampaignContext, getMembers, getVisiblePages, type MemberRow } from "@/lib/campaigns";
import { canManageCampaign, isGameMaster, ROLE_LABELS, VISIBILITY_LABELS } from "@/lib/permissions";
import { flattenTree } from "@/lib/tree";

export const metadata: Metadata = { title: "Ajustes" };

function Section({ id, title, children, danger }: { id: string; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section id={id} className={`panel p-5 sm:p-7 ${danger ? "border-red-500/30" : ""}`}>
      <h2 className={`mb-5 font-display text-xl font-bold ${danger ? "text-red-300" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}

export default async function SettingsPage({ params }: { params: Promise<{ campaign: string }> }) {
  const { campaign: slug } = await params;
  await requireUser(`/c/${slug}/ajustes`);
  const ctx = await getCampaignContext(slug);
  if (!ctx || !isGameMaster(ctx.viewer)) notFound();
  const { campaign, viewer } = ctx;
  const owner = canManageCampaign(viewer);

  const [members, pages] = await Promise.all([getMembers(campaign.id), getVisiblePages(ctx)]);
  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status === "active");
  const ordered = flattenTree(pages);
  const hidden = <input type="hidden" name="campaignId" value={campaign.id} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Ajustes de la campaña</h1>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm">
          {owner && <a href="#general" className="btn btn-ghost btn-sm">General</a>}
          <a href="#solicitudes" className="btn btn-ghost btn-sm">Solicitudes{pending.length > 0 && ` (${pending.length})`}</a>
          <a href="#miembros" className="btn btn-ghost btn-sm">Miembros</a>
          <a href="#paginas" className="btn btn-ghost btn-sm">Páginas</a>
        </nav>
      </div>

      {owner && (
        <Section id="general" title="General">
          <CampaignForm action={updateCampaign} campaign={campaign} />
        </Section>
      )}

      <Section id="solicitudes" title="Solicitudes de entrada">
        {pending.length === 0 ? (
          <p className="text-sm text-ink-3">No hay solicitudes pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-3">
                <MemberLabel member={m} />
                <ActionForm action={reviewRequest} className="ml-auto flex items-center gap-2" showFeedback={false}>
                  {hidden}
                  <input type="hidden" name="userId" value={m.userId} />
                  <button name="decision" value="approve" className="btn btn-primary btn-sm">Aceptar</button>
                  <button name="decision" value="reject" className="btn btn-ghost btn-sm">Rechazar</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="miembros" title={`Miembros · ${active.length}`}>
        <ul className="flex flex-col divide-y divide-line">
          {active.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
              <MemberLabel member={m} />
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {m.role === "owner" || !owner ? (
                  <span className="badge badge-accent">{ROLE_LABELS[m.role]}</span>
                ) : (
                  <>
                    <ActionForm action={setMemberRole} className="flex items-center gap-2" showFeedback={false}>
                      {hidden}
                      <input type="hidden" name="userId" value={m.userId} />
                      <select name="role" defaultValue={m.role} className="input py-1 text-xs" aria-label="Rol">
                        <option value="player">Jugador</option>
                        <option value="editor">Co-máster (puede editar)</option>
                      </select>
                      <SubmitButton className="btn btn-secondary btn-sm" pendingText="…">Cambiar</SubmitButton>
                    </ActionForm>
                    <ActionForm
                      action={transferOwnership}
                      confirmMessage={`¿Hacer a ${m.displayName} máster de la campaña? Tú pasarás a co-máster.`}
                      showFeedback={false}
                    >
                      {hidden}
                      <input type="hidden" name="userId" value={m.userId} />
                      <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">Ceder máster</SubmitButton>
                    </ActionForm>
                    <ActionForm
                      action={removeMember}
                      confirmMessage={`¿Expulsar a ${m.displayName} de la campaña?`}
                      showFeedback={false}
                    >
                      {hidden}
                      <input type="hidden" name="userId" value={m.userId} />
                      <SubmitButton className="btn btn-danger btn-sm" pendingText="…">Expulsar</SubmitButton>
                    </ActionForm>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!owner && <p className="mt-3 text-xs text-ink-4">Solo el máster puede cambiar roles o expulsar miembros.</p>}
      </Section>

      <Section id="paginas" title="Páginas y pestañas">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href={`/c/${campaign.slug}/nueva`} className="btn btn-primary btn-sm">+ Nueva página</Link>
          <p className="text-xs text-ink-4">Las flechas cambian el orden dentro del mismo nivel.</p>
        </div>
        {ordered.length === 0 ? (
          <p className="text-sm text-ink-3">La campaña no tiene páginas todavía.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {ordered.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-1.5" style={{ paddingLeft: `${p.depth * 1.25}rem` }}>
                <form action={movePage} className="flex">
                  {hidden}
                  <input type="hidden" name="pageId" value={p.id} />
                  <button name="direction" value="up" className="btn btn-ghost btn-sm px-1.5" aria-label={`Subir ${p.title}`}>↑</button>
                  <button name="direction" value="down" className="btn btn-ghost btn-sm px-1.5" aria-label={`Bajar ${p.title}`}>↓</button>
                </form>
                <span aria-hidden className="w-5 text-center">{p.icon}</span>
                <Link href={`/c/${campaign.slug}/p/${p.slug}`} className="min-w-0 truncate text-sm text-ink hover:text-accent-2">
                  {p.title}
                </Link>
                <span className="ml-auto hidden text-xs text-ink-4 sm:inline">{VISIBILITY_LABELS[p.visibility]}</span>
                <Link href={`/c/${campaign.slug}/p/${p.slug}/editar`} className="btn btn-ghost btn-sm">Editar</Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {owner && (
        <Section id="peligro" title="Zona peligrosa" danger>
          <p className="mb-4 text-sm text-ink-3">
            Borrar la campaña elimina todas sus páginas, miembros y mensajes. Escribe <b className="text-ink">{campaign.name}</b> para
            confirmar.
          </p>
          <ActionForm action={deleteCampaign} className="flex flex-wrap items-center gap-3">
            {hidden}
            <input name="confirm" className="input max-w-xs" placeholder={campaign.name} autoComplete="off" />
            <SubmitButton className="btn btn-danger" pendingText="Borrando…">Borrar campaña</SubmitButton>
          </ActionForm>
        </Section>
      )}
    </div>
  );
}

function MemberLabel({ member }: { member: MemberRow }) {
  return (
    <Link href={`/u/${member.username}`} className="flex min-w-0 items-center gap-2.5 hover:text-accent-2">
      <Avatar name={member.displayName} src={member.avatarUrl} size={32} />
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink">{member.displayName}</span>
        <span className="block text-xs text-ink-4">@{member.username}</span>
      </span>
    </Link>
  );
}
