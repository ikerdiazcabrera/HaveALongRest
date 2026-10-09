import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthCard title="Bienvenido de nuevo" subtitle="Entra para volver a tus campañas">
      <LoginForm next={next} />
    </AuthCard>
  );
}
