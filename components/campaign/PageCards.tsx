/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { PageSummary } from "@/lib/campaigns";

const VISIBILITY_BADGE = {
  restricted: { label: "Algunos jugadores", cls: "badge-blue" },
  dm: { label: "Solo máster", cls: "badge-red" },
} as const;

/** Rejilla de tarjetas para pestañas o subpáginas. Con alguna portada, usa formato retrato. */
export function PageCards({ pages, campaignSlug }: { pages: PageSummary[]; campaignSlug: string }) {
  if (pages.length === 0) return null;
  const withImages = pages.some((p) => p.coverImage);
  return (
    <div
      className={`grid gap-3 ${
        withImages ? "grid-cols-[repeat(auto-fill,minmax(150px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
      }`}
    >
      {pages.map((p) => {
        const badge = p.visibility === "restricted" || p.visibility === "dm" ? VISIBILITY_BADGE[p.visibility] : null;
        return (
          <Link
            key={p.id}
            href={`/c/${campaignSlug}/p/${p.slug}`}
            className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-accent/60"
          >
            {withImages && (
              <div className="relative aspect-[4/5] overflow-hidden bg-black/30">
                {p.coverImage ? (
                  <img
                    src={p.coverImage}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover object-top transition group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl opacity-60">{p.icon || "📄"}</div>
                )}
              </div>
            )}
            <div className="flex flex-1 flex-col gap-1.5 p-3">
              <span className="flex items-center gap-2 text-sm leading-snug font-semibold text-ink">
                {!withImages && <span aria-hidden className="text-lg">{p.icon || "📄"}</span>}
                {p.title}
              </span>
              {(p.spoilers || badge) && (
                <span className="flex flex-wrap gap-1">
                  {p.spoilers && <span className="badge badge-amber">Spoilers</span>}
                  {badge && <span className={`badge ${badge.cls}`}>{badge.label}</span>}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
