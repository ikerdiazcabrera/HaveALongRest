import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <div aria-hidden className="text-5xl">🎲</div>
      <h1 className="font-display text-3xl font-bold">Pifia crítica</h1>
      <p className="max-w-md text-ink-3">
        Esta página no existe o no tienes permiso para verla. Si es de una campaña privada, entra con una cuenta que forme
        parte de ella.
      </p>
      <div className="flex gap-2">
        <Link href="/" className="btn btn-primary">Volver a Explorar</Link>
        <Link href="/login" className="btn btn-secondary">Entrar</Link>
      </div>
    </main>
  );
}
