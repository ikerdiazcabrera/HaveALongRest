import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/lib/actions/auth";
import { Avatar } from "./Avatar";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span aria-hidden className="text-xl">🌙</span>
          <span className="font-display text-sm font-bold tracking-wide whitespace-nowrap text-ink sm:text-lg">Have a Long Rest</span>
        </Link>
        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          <Link href="/" className="btn btn-ghost btn-sm">Explorar</Link>
          {user && <Link href="/campanas/nueva" className="btn btn-ghost btn-sm">Crear campaña</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/campanas/nueva" className="btn btn-primary btn-sm sm:hidden">+ Campaña</Link>
              <Link href="/perfil" title="Mi perfil" className="flex items-center gap-2 rounded-full py-0.5 pr-2 pl-0.5 hover:bg-card-hover">
                <Avatar name={user.displayName} src={user.avatarUrl} size={28} />
                <span className="hidden text-sm text-ink-2 sm:inline">{user.displayName}</span>
              </Link>
              <form action={logout}>
                <button type="submit" className="btn btn-ghost btn-sm">Salir</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Entrar</Link>
              <Link href="/registro" className="btn btn-primary btn-sm">Crear cuenta</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
