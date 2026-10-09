import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { createPage } from "@/lib/actions/pages";
import { requireUser } from "@/lib/auth/session";
import { getCampaignContext, getVisiblePages } from "@/lib/campaigns";
import { canEditPages, VISIBILITY_LABELS } from "@/lib/permissions";
import { flattenTree } from "@/lib/tree";

export const metadata: Metadata = { title: "Nueva página" };

export default async function NewPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaign: string }>;
  searchParams: Promise<{ titulo?: string; padre?: string }>;
}) {
  const [{ campaign: slug }, { titulo, padre }] = await Promise.all([params, searchParams]);
  await requireUser(`/c/${slug}/nueva`);
  const ctx = await getCampaignContext(slug);
  if (!ctx || !canEditPages(ctx.viewer)) notFound();
  const options = flattenTree(await getVisiblePages(ctx));

  return (
    <div className="panel max-w-2xl p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold">Nueva página</h1>
      <p className="mt-1 mb-6 text-sm text-ink-3">
        Las páginas sin padre aparecen como pestañas principales. Podrás cambiarlo después.
      </p>
      <ActionForm action={createPage} className="flex flex-col gap-5">
        <input type="hidden" name="campaignId" value={ctx.campaign.id} />
        <div>
          <label className="label" htmlFor="title">Título</label>
          <input id="title" name="title" className="input" defaultValue={titulo} required maxLength={120} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="parentId">Dentro de</label>
          <select id="parentId" name="parentId" className="input" defaultValue={padre ?? ""}>
            <option value="">— Pestaña principal —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {"  ".repeat(o.depth)}
                {o.icon ? `${o.icon} ` : ""}
                {o.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="visibility">Quién puede verla</label>
          <select id="visibility" name="visibility" className="input" defaultValue="members">
            {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <SubmitButton pendingText="Creando…">Crear y editar</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
