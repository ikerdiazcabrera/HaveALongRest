"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { type SavePageState, updatePage } from "@/lib/actions/pages";
import type { PageVisibility } from "@/lib/db/schema";
import { resolveWikilinks } from "@/lib/markdown";
import { VISIBILITY_LABELS } from "@/lib/permissions";
import { Feedback } from "../forms";
import { CoverField, ImageUploadButton } from "../ImageUpload";
import { MarkdownView } from "../MarkdownView";

export type EditablePage = {
  id: string;
  title: string;
  slug: string;
  icon: string;
  parentId: string | null;
  visibility: PageVisibility;
  allowedUserIds: string[];
  spoilers: boolean;
  coverImage: string | null;
  content: string;
};

type Option = { id: string; title: string; icon: string; depth: number };
type Member = { userId: string; displayName: string; username: string };
type LinkTarget = { slug: string; title: string };
type Mode = "write" | "split" | "preview";

export function PageEditor({
  campaignId,
  campaignSlug,
  page,
  parentOptions,
  players,
  linkTargets,
}: {
  campaignId: string;
  campaignSlug: string;
  page: EditablePage;
  parentOptions: Option[];
  players: Member[];
  linkTargets: LinkTarget[];
}) {
  const router = useRouter();
  const [state, setState] = useState<SavePageState>(undefined);
  const [saving, startSaving] = useTransition();
  const [content, setContent] = useState(page.content);
  const [visibility, setVisibility] = useState(page.visibility);
  const [mode, setMode] = useState<Mode>("split");
  // Cada edición sube la versión; "sin guardar" = la versión actual no es la última guardada.
  const [version, setVersion] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0);
  const dirty = version !== savedVersion;
  const markDirty = () => setVersion((v) => v + 1);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Se llama a la acción directamente (no con <form action>): React resetearía los campos al terminar.
  function save(form: HTMLFormElement) {
    const data = new FormData(form);
    const submitted = version;
    startSaving(async () => {
      const result = await updatePage(undefined, data);
      setState(result);
      if (!result?.savedAt) return;
      setSavedVersion(submitted);
      if (result.slug && result.slug !== page.slug) router.replace(`/c/${campaignSlug}/p/${result.slug}/editar`);
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty]);

  const preview = useMemo(
    () =>
      resolveWikilinks(content, linkTargets, campaignSlug, (t) => `/c/${campaignSlug}/nueva?titulo=${encodeURIComponent(t)}`),
    [content, linkTargets, campaignSlug],
  );

  /** Envuelve la selección (o inserta un texto de ejemplo) y recoloca el cursor. */
  function edit(transform: (selected: string) => { text: string; select?: [number, number] }) {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const { text, select } = transform(content.slice(start, end));
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    markDirty();
    requestAnimationFrame(() => {
      el.focus();
      const [a, b] = select ?? [text.length, text.length];
      el.setSelectionRange(start + a, start + b);
    });
  }

  const wrap = (before: string, after: string, placeholder: string) =>
    edit((sel) => {
      const inner = sel || placeholder;
      return { text: before + inner + after, select: [before.length, before.length + inner.length] };
    });

  const block = (prefix: string, placeholder: string) =>
    edit((sel) => {
      const lines = (sel || placeholder).split("\n").map((l) => prefix + l);
      const text = "\n" + lines.join("\n") + "\n";
      return { text, select: [1 + prefix.length, text.length - 1] };
    });

  const insert = (text: string) => edit(() => ({ text }));

  return (
    <div className="flex flex-col gap-4" onChange={markDirty}>
      <form
        ref={formRef}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save(e.currentTarget);
        }}
      >
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="pageId" value={page.id} />
        <input type="hidden" name="content" value={content} />

        {/* Barra superior */}
        <div className="panel sticky top-16 z-30 flex flex-wrap items-center gap-3 p-3">
          <Link href={`/c/${campaignSlug}/p/${page.slug}`} className="btn btn-ghost btn-sm">
            ← Ver página
          </Link>
          <span className={`text-xs ${dirty ? "text-amber-300" : "text-ink-4"}`}>
            {dirty ? "Cambios sin guardar" : state?.savedAt ? "Todo guardado" : "Sin cambios"}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <Feedback state={state?.error ? state : undefined} />
            <span className="hidden text-xs text-ink-4 sm:inline">Ctrl+S</span>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          {/* Contenido */}
          <div className="panel flex min-w-0 flex-col gap-3 p-4">
            <div className="flex gap-2">
              <input
                name="icon"
                defaultValue={page.icon}
                maxLength={8}
                aria-label="Icono (emoji)"
                placeholder="🙂"
                className="input w-14 text-center text-xl"
              />
              <input
                name="title"
                defaultValue={page.title}
                required
                maxLength={120}
                aria-label="Título"
                className="input font-display text-xl font-bold"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 border-b border-line pb-2">
              <ToolButton label="Título de sección" onClick={() => block("## ", "Sección")}>H2</ToolButton>
              <ToolButton label="Subtítulo" onClick={() => block("### ", "Apartado")}>H3</ToolButton>
              <ToolButton label="Negrita" onClick={() => wrap("**", "**", "texto")}><b>B</b></ToolButton>
              <ToolButton label="Cursiva" onClick={() => wrap("*", "*", "texto")}><i>I</i></ToolButton>
              <ToolButton label="Lista" onClick={() => block("- ", "elemento")}>• Lista</ToolButton>
              <ToolButton label="Cita" onClick={() => block("> ", "cita")}>❝</ToolButton>
              <ToolButton
                label="Tabla"
                onClick={() => insert("\n| Columna | Columna |\n| --- | --- |\n| Valor | Valor |\n")}
              >
                Tabla
              </ToolButton>
              <PageLinkPicker targets={linkTargets} onPick={(title) => insert(`[[${title}]]`)} />
              <ImageUploadButton
                campaignId={campaignId}
                label="🖼 Imagen"
                className="btn btn-ghost btn-sm"
                onUploaded={(url, file) => insert(`\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n`)}
              />
              <ToolButton label="Bloque solo para el máster" onClick={() => wrap("\n:::dm\n", "\n:::\n", "Información secreta")}>
                <span className="text-red-300">🔒 Máster</span>
              </ToolButton>

              <div className="ml-auto flex rounded-lg border border-line p-0.5 text-xs">
                {(["write", "split", "preview"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-md px-2 py-1 ${mode === m ? "bg-card-hover text-ink" : "text-ink-3"}`}
                  >
                    {m === "write" ? "Escribir" : m === "split" ? "Dividido" : "Vista previa"}
                  </button>
                ))}
              </div>
            </div>

            <div className={`grid gap-4 ${mode === "split" ? "lg:grid-cols-2" : ""}`}>
              <textarea
                ref={textRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                hidden={mode === "preview"}
                spellCheck
                placeholder={"Escribe en Markdown.\n\n[[Otra página]] enlaza páginas de la campaña.\n:::dm … ::: oculta texto a los jugadores."}
                className="input min-h-[60vh] resize-y font-mono text-[13px] leading-relaxed"
              />
              {mode !== "write" && (
                <div className="min-h-[60vh] overflow-y-auto rounded-lg border border-line bg-black/20 p-4">
                  {content.trim() ? <MarkdownView content={preview} showDm /> : <p className="text-sm text-ink-4">Vista previa</p>}
                </div>
              )}
            </div>
          </div>

          {/* Ajustes de la página */}
          <aside className="panel flex h-fit flex-col gap-5 p-4">
            <div>
              <label className="label" htmlFor="visibility">Quién puede verla</label>
              <select
                id="visibility"
                name="visibility"
                className="input"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as PageVisibility)}
              >
                {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <p className="hint">
                {visibility === "public" && "Cualquier visitante de la campaña, aunque no sea miembro."}
                {visibility === "members" && "Todos los miembros de la campaña."}
                {visibility === "restricted" && "Solo los jugadores marcados (y el equipo de máster)."}
                {visibility === "dm" && "Solo tú y los co-másters."}
              </p>
            </div>

            <fieldset hidden={visibility !== "restricted"}>
              <legend className="label">Jugadores con acceso</legend>
              {players.length === 0 ? (
                <p className="text-sm text-ink-4">Aún no hay jugadores en la campaña.</p>
              ) : (
                <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                  {players.map((m) => (
                    <label key={m.userId} className="flex items-center gap-2 text-sm text-ink-2">
                      <input
                        type="checkbox"
                        name="allowedUserIds"
                        value={m.userId}
                        defaultChecked={page.allowedUserIds.includes(m.userId)}
                        className="accent-[var(--accent)]"
                      />
                      {m.displayName} <span className="text-ink-4">@{m.username}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" name="spoilers" defaultChecked={page.spoilers} className="accent-[var(--accent)]" />
              Marcar como spoiler
            </label>

            <div>
              <label className="label" htmlFor="parentId">Dentro de</label>
              <select id="parentId" name="parentId" className="input" defaultValue={page.parentId ?? ""}>
                <option value="">— Pestaña principal —</option>
                {parentOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {"  ".repeat(o.depth)}
                    {o.icon ? `${o.icon} ` : ""}
                    {o.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="slug">URL</label>
              <div className="flex items-center gap-1 text-xs text-ink-4">
                <span className="shrink-0">…/p/</span>
                <input id="slug" name="slug" defaultValue={page.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input" />
              </div>
            </div>

            <div>
              <span className="label">Imagen de tarjeta</span>
              <CoverField name="coverImage" campaignId={campaignId} initial={page.coverImage} onChange={markDirty} />
              <p className="hint">Se muestra en las tarjetas de la página padre.</p>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="btn btn-ghost btn-sm">
      {children}
    </button>
  );
}

function PageLinkPicker({ targets, onPick }: { targets: LinkTarget[]; onPick: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = targets.filter((t) => t.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  return (
    <span className="relative">
      <ToolButton label="Enlazar otra página" onClick={() => setOpen((o) => !o)}>🔗 Página</ToolButton>
      {open && (
        <div className="panel absolute top-full left-0 z-40 mt-1 w-64 p-2 shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter") {
                e.preventDefault();
                if (matches[0] || query.trim()) {
                  onPick(matches[0]?.title ?? query.trim());
                  setOpen(false);
                  setQuery("");
                }
              }
            }}
            placeholder="Buscar página…"
            className="input mb-1"
          />
          <ul className="max-h-60 overflow-y-auto">
            {matches.map((t) => (
              <li key={t.slug}>
                <button
                  type="button"
                  className="w-full truncate rounded px-2 py-1.5 text-left text-sm text-ink-2 hover:bg-card-hover"
                  onClick={() => {
                    onPick(t.title);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {t.title}
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-ink-4">Sin resultados. Enter enlaza a una página nueva.</li>
            )}
          </ul>
        </div>
      )}
    </span>
  );
}
