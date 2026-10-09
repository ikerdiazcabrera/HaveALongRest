// Transformaciones del Markdown de las páginas antes de renderizarlo.
// Sintaxis propia (compatible con notas de Obsidian):
//   [[Página]]  [[Página|texto]]  [[Página#Sección|texto]]   enlaces entre páginas
//   :::dm                                                    bloque solo para el máster
//   …
//   :::
import { slug as headingSlug } from "github-slugger";
import { slugify } from "./slug";

export type Segment = { dm: boolean; text: string };

const DM_OPEN = /^\s*:::\s*dm\b.*$/i;
const DM_CLOSE = /^\s*:::\s*$/;

/** Divide el contenido en tramos normales y tramos `:::dm`. Un bloque sin cerrar llega hasta el final. */
export function splitDmBlocks(markdown: string): Segment[] {
  const segments: Segment[] = [];
  let current: Segment = { dm: false, text: "" };
  for (const line of markdown.split(/\r?\n/)) {
    if (!current.dm && DM_OPEN.test(line)) {
      segments.push(current);
      current = { dm: true, text: "" };
    } else if (current.dm && DM_CLOSE.test(line)) {
      segments.push(current);
      current = { dm: false, text: "" };
    } else {
      current.text += line + "\n";
    }
  }
  segments.push(current);
  return segments.filter((s) => s.text.trim() !== "");
}

/** Elimina los bloques de máster. Se aplica en el servidor: el contenido secreto nunca llega al navegador. */
export function stripDmBlocks(markdown: string): string {
  return splitDmBlocks(markdown)
    .filter((s) => !s.dm)
    .map((s) => s.text)
    .join("\n");
}

export type LinkTarget = { slug: string; title: string };

const WIKILINK = /(!?)\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

/**
 * Convierte `[[wikilinks]]` en enlaces Markdown hacia páginas de la campaña.
 * `pages` debe contener solo las páginas que el lector puede ver: un enlace a una página
 * oculta se queda como texto plano, sin revelar que existe.
 * Con `missingHref`, los enlaces a páginas inexistentes apuntan a "crear página" (para el máster).
 */
export function resolveWikilinks(
  markdown: string,
  pages: LinkTarget[],
  campaignSlug: string,
  missingHref?: (title: string) => string,
): string {
  const byKey = new Map<string, LinkTarget>();
  for (const p of pages) {
    byKey.set(p.title.toLowerCase(), p);
    if (!byKey.has(p.slug)) byKey.set(p.slug, p);
  }
  return markdown.replace(WIKILINK, (match, bang: string, rawTarget: string, anchor?: string, alias?: string) => {
    if (bang) return match; // embeds de Obsidian (![[imagen.png]]): no son enlaces
    // Obsidian permite rutas ("Carpeta/Sub/Página"): nos quedamos con el último tramo.
    const target = rawTarget.trim().split("/").at(-1)!.trim();
    const text = (alias ?? target).trim();
    const page = byKey.get(target.toLowerCase()) ?? byKey.get(slugify(target));
    if (!page) {
      return missingHref ? `[${text}](${missingHref(target)})` : text;
    }
    const hash = anchor ? `#${headingSlug(anchor.trim())}` : "";
    return `[${text}](/c/${campaignSlug}/p/${page.slug}${hash})`;
  });
}

/** Primera imagen Markdown del contenido (para portadas automáticas). */
export function firstImage(markdown: string): string | null {
  const match = markdown.match(/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^)\s]+))/);
  return match ? (match[1] ?? match[2]) : null;
}
