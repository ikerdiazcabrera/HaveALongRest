"use client";

import { startTransition, useActionState } from "react";
import type { FormState } from "@/lib/actions/shared";
import type { Campaign } from "@/lib/db/schema";
import { CoverField } from "./ImageUpload";
import { Feedback } from "./forms";
import { ThemePicker } from "./ThemePicker";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  campaign?: Campaign;
};

/** Datos generales de una campaña. Sin `campaign` es el formulario de creación. */
export function CampaignForm({ action, campaign }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const editing = Boolean(campaign);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        // Sin la prop action, React no resetea los campos tras guardar.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {campaign && <input type="hidden" name="campaignId" value={campaign.id} />}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="name">Nombre</label>
          <input id="name" name="name" className="input" defaultValue={campaign?.name} required minLength={3} maxLength={80} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="tagline">Lema</label>
          <input
            id="tagline"
            name="tagline"
            className="input"
            defaultValue={campaign?.tagline}
            maxLength={140}
            placeholder="Una frase que enganche a futuros jugadores"
          />
        </div>
        <div>
          <label className="label" htmlFor="gameSystem">Sistema de juego</label>
          <input id="gameSystem" name="gameSystem" className="input" defaultValue={campaign?.gameSystem} maxLength={60} placeholder="D&D 5e, Cosmere RPG, Vampiro…" />
        </div>
        <div>
          <label className="label" htmlFor="maxPlayers">Máximo de jugadores</label>
          <input id="maxPlayers" name="maxPlayers" type="number" min={1} max={100} className="input" defaultValue={campaign?.maxPlayers ?? ""} placeholder="Sin límite" />
          <p className="hint">Sin contar al máster ni co-másters.</p>
        </div>
        <div>
          <label className="label" htmlFor="visibility">Visibilidad</label>
          <select id="visibility" name="visibility" className="input" defaultValue={campaign?.visibility ?? "public"}>
            <option value="public">Pública: aparece en Explorar</option>
            <option value="private">Privada: solo la ven sus miembros</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="joinPolicy">Entrada de jugadores</label>
          <select id="joinPolicy" name="joinPolicy" className="input" defaultValue={campaign?.joinPolicy ?? "request"}>
            <option value="request">Con solicitud: el máster aprueba</option>
            <option value="open">Libre: cualquiera puede unirse</option>
            <option value="closed">Cerrada: no se admiten jugadores</option>
          </select>
        </div>
        {campaign && (
          <div>
            <label className="label" htmlFor="status">Estado</label>
            <select id="status" name="status" className="input" defaultValue={campaign.status}>
              <option value="active">Activa</option>
              <option value="paused">En pausa</option>
              <option value="finished">Terminada</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="description">Descripción</label>
        <textarea
          id="description"
          name="description"
          className="input min-h-40 font-mono text-[13px] leading-relaxed"
          defaultValue={campaign?.description}
          placeholder="Presenta la campaña: ambientación, tono, horarios… (admite Markdown)"
        />
      </div>

      <ThemePicker initialTheme={campaign?.theme ?? "taberna"} initialCustom={campaign?.customTheme ?? null} />

      {campaign && (
        <div>
          <span className="label">Portada</span>
          <CoverField name="coverImage" campaignId={campaign.id} initial={campaign.coverImage} />
        </div>
      )}

      {!editing && (
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" name="starterPages" defaultChecked className="accent-[var(--accent)]" />
          Crear pestañas iniciales (Historia, Personajes, Mundo y Notas del máster)
        </label>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? (editing ? "Guardando…" : "Creando…") : editing ? "Guardar cambios" : "Crear campaña"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
