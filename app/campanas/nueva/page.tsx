import type { Metadata } from "next";
import { CampaignForm } from "@/components/CampaignForm";
import { SiteHeader } from "@/components/SiteHeader";
import { createCampaign } from "@/lib/actions/campaigns";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nueva campaña" };

export default async function NewCampaignPage() {
  await requireUser("/campanas/nueva");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold">Nueva campaña</h1>
        <p className="mt-2 mb-8 text-ink-3">
          Serás el máster: podrás editar las pestañas, decidir qué ve cada jugador y aprobar a quién entra.
        </p>
        <div className="panel p-6 sm:p-8">
          <CampaignForm action={createCampaign} />
        </div>
      </main>
    </>
  );
}
