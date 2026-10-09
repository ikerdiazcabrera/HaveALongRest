"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Error inesperado en una página: no se muestran detalles internos al usuario. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <div aria-hidden className="text-5xl">💥</div>
      <h1 className="font-display text-3xl font-bold">Algo ha salido mal</h1>
      <p className="max-w-md text-ink-3">
        Ha ocurrido un error inesperado. Prueba otra vez; si sigue pasando, avisa indicando este código:
        {error.digest && <code className="ml-1 text-accent-2">{error.digest}</code>}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">Reintentar</button>
        <Link href="/" className="btn btn-secondary">Ir al inicio</Link>
      </div>
    </main>
  );
}
