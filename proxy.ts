import { type NextRequest, NextResponse } from "next/server";

/**
 * Content Security Policy con nonce por petición: el navegador solo ejecuta los scripts
 * que lleven el nonce (los de Next.js, que lo añade solo). Aunque alguien consiguiera
 * colar HTML en una página, sus <script> no se ejecutarían.
 *
 * - style-src admite 'unsafe-inline' porque la app usa atributos style (temas, avatares);
 *   el riesgo de inyectar CSS es mucho menor que el de inyectar JS.
 * - img-src admite https: porque las páginas pueden enlazar imágenes externas.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Páginas HTML: se excluyen recursos estáticos, imágenes y prefetches de <Link>.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|content/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
