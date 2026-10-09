import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", weight: ["600", "700"] });

export const metadata: Metadata = {
  title: { default: "Have a Long Rest", template: "%s · Have a Long Rest" },
  description: "Encuentra campañas de rol, únete a una mesa y lleva la wiki de tu campaña.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Todo se renderiza por petición: la CSP con nonce (proxy.ts) lo necesita, y además
  // todas las páginas dependen de la sesión del usuario.
  await connection();
  return (
    <html lang="es" className={`${inter.variable} ${cinzel.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
