"use client";

/** Último recurso si falla el propio layout raíz. Sin estilos de la app: HTML mínimo. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#15111c", color: "#f4efe6", textAlign: "center", padding: "4rem 1rem" }}>
        <h1>Algo ha salido mal</h1>
        <p>La aplicación no ha podido cargar.</p>
        <button type="button" onClick={reset} style={{ padding: "0.5rem 1rem", marginTop: "1rem" }}>
          Reintentar
        </button>
      </body>
    </html>
  );
}
