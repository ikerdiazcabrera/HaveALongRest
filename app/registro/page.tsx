import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { RegisterForm } from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthCard title="Únete a la mesa" subtitle="Crea tu cuenta de Have a Long Rest">
      <RegisterForm next={next} />
    </AuthCard>
  );
}
