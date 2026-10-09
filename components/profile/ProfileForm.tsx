"use client";

import { useRef, useState, useTransition } from "react";
import { removeAvatar, updateProfile, uploadAvatar } from "@/lib/actions/profile";
import type { FormState } from "@/lib/actions/shared";
import { MAX_FAVORITE_GAMES } from "@/lib/validation";
import { Avatar } from "../Avatar";
import { Feedback } from "../forms";

type Profile = { displayName: string; avatarUrl: string | null; bio: string; favoriteGames: string[] };

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, setState] = useState<FormState>(undefined);
  const [saving, startSaving] = useTransition();
  const [games, setGames] = useState(profile.favoriteGames);
  const [draft, setDraft] = useState("");

  function addGame() {
    const game = draft.trim().slice(0, 40);
    if (game && games.length < MAX_FAVORITE_GAMES && !games.some((g) => g.toLowerCase() === game.toLowerCase())) {
      setGames([...games, game]);
    }
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-6">
      <AvatarField name={profile.displayName} initial={profile.avatarUrl} />

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startSaving(async () => setState(await updateProfile(undefined, data)));
        }}
      >
        <div>
          <label className="label" htmlFor="displayName">Nombre visible</label>
          <input id="displayName" name="displayName" defaultValue={profile.displayName} maxLength={40} required className="input" />
        </div>

        <div>
          <label className="label" htmlFor="bio">Sobre mí</label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={profile.bio}
            maxLength={1000}
            rows={5}
            placeholder="¿Qué te gusta jugar? ¿Prefieres dirigir o ser jugador? ¿Horarios?"
            className="input resize-y"
          />
        </div>

        <div>
          <label className="label" htmlFor="game-input">Juegos favoritos</label>
          {games.map((g) => (
            <input key={g} type="hidden" name="favoriteGames" value={g} />
          ))}
          <div className="input flex flex-wrap items-center gap-1.5 focus-within:border-accent">
            {games.map((g) => (
              <span key={g} className="badge badge-accent text-xs">
                {g}
                <button
                  type="button"
                  onClick={() => setGames(games.filter((x) => x !== g))}
                  aria-label={`Quitar ${g}`}
                  className="ml-0.5 opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
            {games.length < MAX_FAVORITE_GAMES && (
              <input
                id="game-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addGame();
                  } else if (e.key === "Backspace" && !draft && games.length) {
                    setGames(games.slice(0, -1));
                  }
                }}
                onBlur={addGame}
                maxLength={40}
                placeholder={games.length ? "Añadir otro…" : "D&D 5e, Pathfinder… (Enter para añadir)"}
                className="min-w-40 flex-1 bg-transparent py-0.5 outline-none placeholder:text-ink-4"
              />
            )}
          </div>
          <p className="hint">Hasta {MAX_FAVORITE_GAMES}. Enter o coma para añadir.</p>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Guardar perfil"}
          </button>
          <Feedback state={state} />
        </div>
      </form>
    </div>
  );
}

function AvatarField({ name, initial }: { name: string; initial: string | null }) {
  const [url, setUrl] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    const data = new FormData();
    data.set("file", file);
    setError(null);
    startBusy(async () => {
      const result = await uploadAvatar(data);
      if ("error" in result) setError(result.error);
      else setUrl(result.url);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} src={url} size={88} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Subiendo…" : url ? "Cambiar foto" : "Subir foto"}
          </button>
          {url && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() =>
                startBusy(async () => {
                  await removeAvatar();
                  setUrl(null);
                })
              }
            >
              Quitar
            </button>
          )}
        </div>
        <p className="text-xs text-ink-4">PNG, JPG, WebP o GIF. Máximo 4 MB.</p>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
