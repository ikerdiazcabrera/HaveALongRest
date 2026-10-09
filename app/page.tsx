import Link from "next/link";
import { CampaignCard } from "@/components/CampaignCard";
import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth/session";
import { listPublicCampaigns, listUserCampaigns } from "@/lib/campaigns";
import { ROLE_LABELS } from "@/lib/permissions";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string; cuenta?: string }> }) {
  const { q, cuenta } = await searchParams;
  const user = await getCurrentUser();
  const [publicCampaigns, mine] = await Promise.all([
    listPublicCampaigns(q),
    user ? listUserCampaigns(user.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 pb-20">
        {cuenta === "borrada" && (
          <p role="status" className="mx-auto mt-6 max-w-lg rounded-lg border border-line bg-card px-4 py-3 text-center text-sm text-ink-2">
            Tu cuenta se ha borrado. ¡Gracias por jugar!
          </p>
        )}
        <section className="py-14 text-center sm:py-20">
          <h1 className="font-display text-4xl font-bold text-ink sm:text-5xl">Have a Long Rest</h1>
          <p className="mx-auto mt-4 max-w-xl text-ink-3">
            Encuentra una mesa, únete a la partida y sigue la historia desde la wiki de cada campaña.
          </p>
          <form className="mx-auto mt-8 flex max-w-lg gap-2" action="/">
            <input name="q" defaultValue={q} placeholder="Buscar por nombre, lema o sistema…" className="input" />
            <button className="btn btn-primary">Buscar</button>
          </form>
          {!user && (
            <p className="mt-6 text-sm text-ink-3">
              <Link href="/registro" className="text-accent-2 underline underline-offset-4">
                Crea una cuenta
              </Link>{" "}
              para unirte a campañas o dirigir la tuya.
            </p>
          )}
        </section>

        {mine.length > 0 && !q && (
          <section className="mb-14">
            <h2 className="mb-4 font-display text-2xl font-bold">Mis campañas</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {mine.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  extra={
                    <span className={`badge ${c.memberStatus === "pending" ? "badge-amber" : "badge-blue"}`}>
                      {c.memberStatus === "pending" ? "Solicitud pendiente" : ROLE_LABELS[c.role]}
                    </span>
                  }
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold">
              {q ? `Resultados para “${q}”` : "Campañas abiertas al público"}
            </h2>
            {user && (
              <Link href="/campanas/nueva" className="btn btn-secondary btn-sm">
                + Nueva campaña
              </Link>
            )}
          </div>
          {publicCampaigns.length === 0 ? (
            <div className="card p-10 text-center text-ink-3">
              {q ? "No hay campañas que coincidan con la búsqueda." : "Todavía no hay campañas públicas. ¡Crea la primera!"}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {publicCampaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
