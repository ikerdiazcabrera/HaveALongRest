import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Cabeceras de seguridad para todas las respuestas. La CSP va en proxy.ts porque
// necesita un nonce distinto en cada petición.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PGlite (Postgres embebido para desarrollo) carga ficheros WASM en runtime:
  // no debe pasar por el bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: {
      // Subida de imágenes (límite real 4 MB + margen multipart). Vercel limita a 4,5 MB.
      bodySizeLimit: "4.2mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
