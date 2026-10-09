import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { SiteHeader } from "@/components/SiteHeader";
import { changePassword, deleteAccount, logoutOtherSessions } from "@/lib/actions/profile";
import { requireUser } from "@/lib/auth/session";
import { getOwnProfile } from "@/lib/users";

export const metadata: Metadata = { title: "Mi perfil" };

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`panel p-5 sm:p-7 ${danger ? "border-red-500/30" : ""}`}>
      <h2 className={`mb-5 font-display text-xl font-bold ${danger ? "text-red-300" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}

export default async function ProfilePage() {
  const user = await requireUser("/perfil");
  const profile = await getOwnProfile(user.id);
  if (!profile) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Mi perfil</h1>
            <p className="mt-1 text-sm text-ink-3">
              @{profile.username} · {profile.email}
            </p>
          </div>
          <Link href={`/u/${profile.username}`} className="btn btn-secondary btn-sm">
            Ver mi perfil público
          </Link>
        </div>

        <Section title="Perfil público">
          <ProfileForm
            profile={{
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              bio: profile.bio,
              favoriteGames: profile.favoriteGames,
            }}
          />
        </Section>

        <Section title="Contraseña">
          <ActionForm action={changePassword} className="flex max-w-md flex-col gap-4">
            <input type="text" name="username" autoComplete="username" value={profile.username} readOnly hidden />
            <div>
              <label className="label" htmlFor="currentPassword">Contraseña actual</label>
              <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="newPassword">Nueva contraseña</label>
              <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="confirmPassword">Repite la nueva contraseña</label>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className="input" />
            </div>
            <div>
              <SubmitButton pendingText="Cambiando…">Cambiar contraseña</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section title="Sesiones">
          <p className="mb-4 text-sm text-ink-3">
            Si entraste desde un ordenador que no es tuyo, cierra la sesión allí sin tener que ir a ese dispositivo.
          </p>
          <ActionForm action={logoutOtherSessions} className="flex flex-wrap items-center gap-3">
            <SubmitButton className="btn btn-secondary" pendingText="Cerrando…">Cerrar sesión en los demás dispositivos</SubmitButton>
          </ActionForm>
        </Section>

        <Section title="Borrar cuenta" danger>
          <p className="mb-4 text-sm text-ink-3">
            Se borran tu perfil, tus membresías y tus mensajes privados. Tus mensajes en chats de grupo quedan como
            «Usuario eliminado». Si eres máster de alguna campaña, cédela o bórrala antes. <b className="text-ink">No se puede deshacer.</b>
          </p>
          <ActionForm
            action={deleteAccount}
            confirmMessage="¿Seguro que quieres borrar tu cuenta para siempre?"
            className="flex max-w-md flex-col gap-4"
          >
            <div>
              <label className="label" htmlFor="confirm">Escribe tu usuario ({profile.username})</label>
              <input id="confirm" name="confirm" autoComplete="off" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="password">Contraseña</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
            </div>
            <div>
              <SubmitButton className="btn btn-danger" pendingText="Borrando…">Borrar mi cuenta</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </main>
    </>
  );
}
