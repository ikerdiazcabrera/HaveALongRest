import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageEditor } from "@/components/campaign/PageEditor";
import { ActionForm, SubmitButton } from "@/components/forms";
import { deletePage } from "@/lib/actions/pages";
import { requireUser } from "@/lib/auth/session";
import { getCampaignContext, getMembers, getPage, getVisiblePages } from "@/lib/campaigns";
import { canEditPages } from "@/lib/permissions";
import { descendantIds, flattenTree } from "@/lib/tree";

export const metadata: Metadata = { title: "Editar página" };

export default async function EditPage({ params }: { params: Promise<{ campaign: string; page: string }> }) {
  const { campaign: slug, page: pageSlug } = await params;
  await requireUser(`/c/${slug}/p/${pageSlug}/editar`);
  const ctx = await getCampaignContext(slug);
  if (!ctx || !canEditPages(ctx.viewer)) notFound();
  const page = await getPage(ctx, decodeURIComponent(pageSlug));
  if (!page) notFound();

  const [pages, members] = await Promise.all([getVisiblePages(ctx), getMembers(ctx.campaign.id)]);
  const excluded = descendantIds(pages, page.id);

  return (
    <div className="flex flex-col gap-6">
      <PageEditor
        key={page.id}
        campaignId={ctx.campaign.id}
        campaignSlug={ctx.campaign.slug}
        page={{
          id: page.id,
          title: page.title,
          slug: page.slug,
          icon: page.icon,
          parentId: page.parentId,
          visibility: page.visibility,
          allowedUserIds: page.allowedUserIds,
          spoilers: page.spoilers,
          coverImage: page.coverImage,
          content: page.content,
        }}
        parentOptions={flattenTree(pages.filter((p) => !excluded.has(p.id)))}
        players={members.filter((m) => m.status === "active" && m.role === "player")}
        linkTargets={pages.filter((p) => p.id !== page.id).map(({ slug, title }) => ({ slug, title }))}
      />

      <section className="panel border-red-500/30 p-4">
        <h2 className="text-sm font-bold text-red-300">Borrar página</h2>
        <p className="mt-1 mb-3 text-sm text-ink-3">
          Sus subpáginas no se borran: pasan a colgar de la página superior.
        </p>
        <ActionForm action={deletePage} confirmMessage={`¿Borrar “${page.title}”? No se puede deshacer.`}>
          <input type="hidden" name="campaignId" value={ctx.campaign.id} />
          <input type="hidden" name="pageId" value={page.id} />
          <SubmitButton className="btn btn-danger btn-sm" pendingText="Borrando…">
            Borrar página
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
