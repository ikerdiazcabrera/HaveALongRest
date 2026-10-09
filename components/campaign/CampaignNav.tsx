"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export type NavNode = {
  id: string;
  slug: string;
  title: string;
  icon: string;
  visibility: "public" | "members" | "restricted" | "dm";
  spoilers: boolean;
  children: NavNode[];
};

const VISIBILITY_MARK: Partial<Record<NavNode["visibility"], { icon: string; title: string }>> = {
  restricted: { icon: "👁", title: "Visible solo para algunos jugadores" },
  dm: { icon: "🔒", title: "Solo máster" },
};

/** Ruta de ids desde la raíz hasta la página con ese slug (vacía si no está en el árbol). */
function pathTo(nodes: NavNode[], slug: string | undefined): string[] {
  if (!slug) return [];
  for (const node of nodes) {
    if (node.slug === slug) return [node.id];
    const sub = pathTo(node.children, slug);
    if (sub.length) return [node.id, ...sub];
  }
  return [];
}

type Flat = { node: NavNode; trail: string[] };
function flatten(nodes: NavNode[], trail: string[] = []): Flat[] {
  return nodes.flatMap((node) => [{ node, trail }, ...flatten(node.children, [...trail, node.title])]);
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Spinner mínimo mientras se carga la página del enlace pulsado. */
function PendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span aria-hidden className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />;
}

/**
 * Enlace que, al detectar intención (ratón encima o foco), pide la página completa por
 * adelantado: al hacer clic los datos ya están en el navegador. Patrón recomendado por Next.
 */
function IntentLink({ onMouseEnter, onFocus, ...props }: React.ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={intent ? true : null}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
    />
  );
}

/**
 * Apertura de carpetas sin efectos: por defecto están abiertas las que contienen la página
 * actual. Si el usuario abre/cierra una, su elección manda mientras siga en esa página;
 * al navegar, las carpetas de la nueva ruta se vuelven a abrir.
 */
type Override = { open: boolean; at: string | undefined };

type TreeState = {
  base: string;
  activeSlug: string | undefined;
  activePath: string[];
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
};

function Row({ node, tree }: { node: NavNode; tree: TreeState }) {
  const { base, activeSlug, activePath, isOpen, toggle } = tree;
  const active = node.slug === activeSlug;
  const onPath = !active && activePath.includes(node.id);
  const hasChildren = node.children.length > 0;
  const open = hasChildren && isOpen(node.id);
  const mark = VISIBILITY_MARK[node.visibility];

  return (
    <li>
      <div
        className={`group/row relative flex items-center rounded-md transition ${
          active ? "bg-accent/15 text-ink" : onPath ? "text-ink" : "text-ink-2 hover:bg-card hover:text-ink"
        }`}
      >
        {active && <span aria-hidden className="absolute top-1 bottom-1 -left-px w-0.5 rounded-full bg-accent" />}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(node.id)}
            aria-expanded={open}
            aria-label={`${open ? "Contraer" : "Expandir"} ${node.title}`}
            className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-ink-4 hover:bg-card-hover hover:text-ink"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${open ? "rotate-90" : ""}`}>
              <path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <span aria-hidden className="w-6 shrink-0" />
        )}
        <IntentLink
          href={`${base}/p/${node.slug}`}
          aria-current={active ? "page" : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-sm ${active ? "font-semibold" : onPath ? "font-medium" : ""}`}
        >
          <span aria-hidden className="w-4 shrink-0 text-center text-[13px]">
            {node.icon || (hasChildren ? "📁" : "📄")}
          </span>
          <span className="truncate">{node.title}</span>
          <PendingDot />
          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
            {node.spoilers && <span title="Contiene spoilers" className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            {mark && <span title={mark.title} className="text-[10px] opacity-70">{mark.icon}</span>}
            {hasChildren && !open && (
              <span className="rounded bg-card px-1 text-[10px] leading-4 text-ink-4">{node.children.length}</span>
            )}
          </span>
        </IntentLink>
      </div>
      {open && (
        // Línea guía alineada con el chevron del padre: deja claro de quién cuelga cada página.
        <ul className={`ml-3 border-l pl-1.5 ${onPath || active ? "border-accent/40" : "border-line"}`}>
          {node.children.map((child) => (
            <Row key={child.id} node={child} tree={tree} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CampaignNav({
  campaignSlug,
  campaignName,
  roleLabel,
  tree,
  isGameMaster,
  pendingRequests,
}: {
  campaignSlug: string;
  campaignName: string;
  roleLabel: string | null;
  tree: NavNode[];
  isGameMaster: boolean;
  pendingRequests: number;
}) {
  const pathname = usePathname();
  const base = `/c/${campaignSlug}`;
  const match = pathname.match(/^\/c\/[^/]+\/p\/([^/]+)/);
  const activeSlug = match ? decodeURIComponent(match[1]) : undefined;

  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [query, setQuery] = useState("");

  const activePath = useMemo(() => pathTo(tree, activeSlug), [tree, activeSlug]);
  const flat = useMemo(() => flatten(tree), [tree]);
  const total = flat.length;

  const isOpen = (id: string) => {
    const override = overrides[id];
    const onPath = activePath.includes(id);
    if (!override) return onPath;
    // Un cierre manual de una carpeta de la ruta solo vale en la página donde se hizo.
    return onPath && !override.open && override.at !== activeSlug ? true : override.open;
  };
  const toggle = (id: string) =>
    setOverrides((o) => ({ ...o, [id]: { open: !isOpen(id), at: activeSlug } }));
  const setAll = (open: boolean) =>
    setOverrides(
      Object.fromEntries(flat.filter((f) => f.node.children.length).map((f) => [f.node.id, { open, at: activeSlug }])),
    );

  const treeState: TreeState = { base, activeSlug, activePath, isOpen, toggle };

  const results = query.trim()
    ? flat.filter((f) => normalize(f.node.title).includes(normalize(query.trim()))).slice(0, 30)
    : null;

  return (
    <nav aria-label={`Páginas de ${campaignName}`} className="flex flex-col gap-3">
      <Link
        href={base}
        className={`block rounded-lg px-2 py-2 transition hover:bg-card ${pathname === base ? "bg-card-hover" : ""}`}
      >
        <span className="block font-display text-lg leading-tight font-bold text-ink">{campaignName}</span>
        {roleLabel && <span className="mt-1 inline-block text-xs text-accent-2">{roleLabel}</span>}
      </Link>

      {total > 8 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder={`Buscar entre ${total} páginas…`}
          aria-label="Buscar páginas"
          className="input py-1.5 text-xs"
        />
      )}

      <div>
        <div className="mb-1 flex items-center justify-between px-2">
          <p className="text-[10px] font-bold tracking-[0.14em] text-ink-4 uppercase">
            {results ? `${results.length} resultado${results.length === 1 ? "" : "s"}` : "Pestañas"}
          </p>
          {!results && flat.some((f) => f.node.children.length) && (
            <span className="flex gap-1 text-[10px] text-ink-4">
              <button type="button" onClick={() => setAll(true)} className="hover:text-ink">Expandir</button>
              <span aria-hidden>·</span>
              <button type="button" onClick={() => setAll(false)} className="hover:text-ink">Contraer</button>
            </span>
          )}
        </div>

        {results ? (
          <ul className="flex flex-col gap-0.5">
            {results.length === 0 && <li className="px-2 text-sm text-ink-4">Nada coincide.</li>}
            {results.map(({ node, trail }) => (
              <li key={node.id}>
                <IntentLink
                  href={`${base}/p/${node.slug}`}
                  onClick={() => setQuery("")}
                  className={`block rounded-md px-2 py-1.5 hover:bg-card ${node.slug === activeSlug ? "bg-accent/15" : ""}`}
                >
                  <span className="flex items-center gap-2 text-sm text-ink">
                    <span aria-hidden className="w-4 text-center text-[13px]">{node.icon || "📄"}</span>
                    <span className="truncate">{node.title}</span>
                    <PendingDot />
                  </span>
                  {trail.length > 0 && <span className="block truncate pl-6 text-[11px] text-ink-4">{trail.join(" › ")}</span>}
                </IntentLink>
              </li>
            ))}
          </ul>
        ) : tree.length === 0 ? (
          <p className="px-2 text-sm text-ink-4">Aún no hay páginas visibles.</p>
        ) : (
          <ul className="flex flex-col gap-px">
            {tree.map((node) => (
              <Row key={node.id} node={node} tree={treeState} />
            ))}
          </ul>
        )}
      </div>

      {isGameMaster && (
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <Link href={`${base}/nueva`} className="btn btn-secondary btn-sm justify-start">
            + Nueva página
          </Link>
          <Link href={`${base}/ajustes`} className="btn btn-ghost btn-sm justify-start">
            ⚙ Ajustes y miembros
            {pendingRequests > 0 && <span className="badge badge-amber ml-auto">{pendingRequests}</span>}
          </Link>
        </div>
      )}
    </nav>
  );
}
