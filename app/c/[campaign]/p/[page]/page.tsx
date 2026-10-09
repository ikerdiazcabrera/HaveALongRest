/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageCards } from "@/components/campaign/PageCards";
import { MarkdownView } from "@/components/MarkdownView";
import { ancestorsOf, getCampaignContext, getPage, getVisiblePages } from "@/lib/campaigns";
import { resolveWikilinks, stripDmBlocks } from "@/lib/markdown";
import { canEditPages, canSeeDmContent, VISIBILITY_LABELS } from "@/lib/permissions";

type Params = { params: Promise<{ campaign: string; page: string }> };

async function load(params: Params["params"]) {
  const { campaign: campaignSlug, page: pageSlug } = await params;
  const ctx = await getCampaignContext(campaignSlug);
  if (!ctx) return null;
  // En paralelo: la página pedida y el índice de páginas visibles (para migas e hijas).
  const [page, pages] = await Promise.all([getPage(ctx, decodeURIComponent(pageSlug)), getVisiblePages(ctx)]);
  return page ? { ctx, page, pages } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: data.page.title } : {};
}

const VISIBILITY_BADGE = {
  members: "badge-neutral",
  restricted: "badge-blue",
  dm: "badge-red",
} as const;

export default async function WikiPage({ params }: Params) {
  const data = await load(params);
  if (!data) notFound();
  const { ctx, page, pages } = data;
  const { campaign, viewer } = ctx;

  const children = pages.filter((p) => p.parentId === page.id);
  const ancestors = ancestorsOf(pages, page.id);
  const showDm = canSeeDmContent(viewer);
  const editable = canEditPages(viewer);

  // El contenido de máster se elimina en el servidor: nunca llega al navegador del jugador.
  const source = showDm ? page.content : stripDmBlocks(page.content);
  const content = resolveWikilinks(
    source,
    pages,
    campaign.slug,
    editable
      ? (title) => `/c/${campaign.slug}/nueva?titulo=${encodeURIComponent(title)}&padre=${page.id}`
      : undefined,
  );
  const showCover = page.coverImage && !page.content.includes(page.coverImage);

  return (
    <article className="panel p-5 sm:p-8">
      <nav aria-label="Ruta" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-ink-4">
        <Link href={`/c/${campaign.slug}`} className="hover:text-ink">{campaign.name}</Link>
        {ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1.5">
            <span aria-hidden>/</span>
            <Link href={`/c/${campaign.slug}/p/${a.slug}`} className="hover:text-ink">{a.title}</Link>
          </span>
        ))}
      </nav>

      <header className="mb-6 flex flex-wrap items-start gap-4 border-b border-line pb-5">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl leading-tight font-bold text-ink">
            {page.icon && <span className="mr-2">{page.icon}</span>}
            {page.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {page.spoilers && <span className="badge badge-amber">Contiene spoilers</span>}
            {page.visibility !== "public" && (
              <span className={`badge ${VISIBILITY_BADGE[page.visibility]}`}>{VISIBILITY_LABELS[page.visibility]}</span>
            )}
          </div>
        </div>
        {editable && (
          <Link href={`/c/${campaign.slug}/p/${page.slug}/editar`} className="btn btn-primary">
            ✎ Editar página
          </Link>
        )}
      </header>

      {showCover && (
        <img
          src={page.coverImage!}
          alt=""
          className="mb-6 max-h-96 w-full max-w-md rounded-xl border border-line object-cover object-top"
        />
      )}

      {content.trim() ? (
        <MarkdownView content={content} showDm={showDm} />
      ) : (
        children.length === 0 && (
          <p className="text-ink-3 italic">
            Esta página está vacía.
            {editable && (
              <>
                {" "}
                <Link href={`/c/${campaign.slug}/p/${page.slug}/editar`} className="text-accent-2 underline">
                  Empieza a escribir
                </Link>
                .
              </>
            )}
          </p>
        )
      )}

      {(children.length > 0 || editable) && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">{children.length > 0 ? "Contenido" : ""}</h2>
            {editable && (
              <Link href={`/c/${campaign.slug}/nueva?padre=${page.id}`} className="btn btn-ghost btn-sm">
                + Añadir subpágina
              </Link>
            )}
          </div>
          <PageCards pages={children} campaignSlug={campaign.slug} />
        </section>
      )}

      <footer className="mt-10 text-xs text-ink-4">
        Actualizada el {page.updatedAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
      </footer>
    </article>
  );
}
