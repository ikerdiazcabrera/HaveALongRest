import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { STATUS_BADGE } from "@/components/CampaignCard";
import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { getPublicProfile } from "@/lib/users";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
}

export default async function PublicProfile({ params }: Params) {
  const { username } = await params;
  const viewer = await getCurrentUser();
  const profile = await getPublicProfile(decodeURIComponent(username), viewer?.id ?? null);
  if (!profile) notFound();
  const isMe = viewer?.id === profile.id;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <section className="panel flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <Avatar name={profile.displayName} src={profile.avatarUrl} size={112} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold break-words">{profile.displayName}</h1>
            <p className="text-sm text-ink-3">
              @{profile.username} · en Have a Long Rest desde{" "}
              {profile.createdAt.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
            </p>
            {profile.favoriteGames.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Juegos favoritos">
                {profile.favoriteGames.map((g) => (
                  <li key={g} className="badge badge-accent">🎲 {g}</li>
                ))}
              </ul>
            )}
          </div>
          {isMe && (
            <Link href="/perfil" className="btn btn-secondary btn-sm self-start">
              Editar perfil
            </Link>
          )}
        </section>

        <section className="panel p-6 sm:p-8">
          <h2 className="mb-3 font-display text-xl font-bold">Sobre mí</h2>
          {profile.bio ? (
            <p className="whitespace-pre-line text-ink-2">{profile.bio}</p>
          ) : (
            <p className="text-ink-4 italic">{isMe ? "Aún no has escrito nada sobre ti." : "Todavía no ha escrito nada sobre sí."}</p>
          )}
        </section>

        <section className="panel p-6 sm:p-8">
          <h2 className="mb-4 font-display text-xl font-bold">Campañas</h2>
          {profile.campaigns.length === 0 ? (
            <p className="text-ink-4 italic">No participa en ninguna campaña visible.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {profile.campaigns.map((c) => (
                <li key={c.slug} className="flex flex-wrap items-center gap-2 py-3">
                  <Link href={`/c/${c.slug}`} className="font-semibold text-ink hover:text-accent-2">
                    {c.name}
                  </Link>
                  {c.gameSystem && <span className="badge badge-neutral">{c.gameSystem}</span>}
                  <span className={`badge ${STATUS_BADGE[c.status].cls}`}>{STATUS_BADGE[c.status].label}</span>
                  <span className="badge badge-accent ml-auto">{ROLE_LABELS[c.role]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
