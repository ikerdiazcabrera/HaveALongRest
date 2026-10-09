// Datos de demostración. BORRA todo el contenido de la base de datos.
//   npm run db:seed            (solo con la base de datos local)
//   npm run db:seed -- --force (también contra DATABASE_URL: ¡cuidado!)
import "./env";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { hashPassword } from "../lib/auth/password";
import { createDb } from "../lib/db/client";
import { campaignMembers, campaigns, messages, pages, users } from "../lib/db/schema";
import { firstImage } from "../lib/markdown";
import { slugify, uniqueSlug } from "../lib/slug";

if (process.env.DATABASE_URL && !process.argv.includes("--force")) {
  console.error("DATABASE_URL está definida: el seed borraría esa base de datos. Usa --force si de verdad quieres.");
  process.exit(1);
}

const PASSWORD = "longrest";
const { db, close } = createDb();

await db.execute(sql`TRUNCATE users, sessions, campaigns, campaign_members, pages, messages RESTART IDENTITY CASCADE`);

// ─── Usuarios ────────────────────────────────────────────────────────────────

const passwordHash = await hashPassword(PASSWORD);
const PLAYER_NAMES = ["Iker", "Salva", "Aitor", "Nico", "Dani", "JJ", "Jose", "Daniela", "Val", "Sala", "Manu"];
const userRows = await db
  .insert(users)
  .values(
    [
      {
        username: "dm",
        displayName: "El Máster",
        bio: "Dirijo partidas en el Cosmere desde hace años. Me encantan las campañas largas y los giros de guion.",
        favoriteGames: ["Cosmere RPG", "Mistborn Adventure Game", "D&D 5e"],
      },
      {
        username: "ana",
        displayName: "Ana",
        bio: "Máster novata pero entusiasta. Busco jugadores con paciencia y ganas de explorar mazmorras.",
        favoriteGames: ["D&D 5e", "La Llamada de Cthulhu"],
      },
      { username: "bruno", displayName: "Bruno" },
      ...PLAYER_NAMES.map((name) => ({ username: name.toLowerCase(), displayName: name })),
    ].map((u) => ({ ...u, email: `${u.username}@example.com`, passwordHash })),
  )
  .returning({ id: users.id, username: users.username });
const uid = Object.fromEntries(userRows.map((u) => [u.username, u.id])) as Record<string, string>;

// ─── Campaña 1: importada del antiguo export de Obsidian (pages.json) ─────────

type RawPage = {
  slug: string;
  title: string;
  visibility: "public" | "private";
  allowed_users: string[];
  spoilers: boolean;
  content_admin: string;
};

const raw: RawPage[] = JSON.parse(readFileSync("scripts/seed-data/archivo-pages.json", "utf8"));

const [camino] = await db
  .insert(campaigns)
  .values({
    slug: "caminapiedras",
    name: "Caminapiedras",
    tagline: "Una partida en Roshar: tormentas, juramentos y conspiraciones en las Llanuras Quebradas.",
    gameSystem: "Cosmere RPG",
    description: [
      "Campaña importada del antiguo **Archivo de las Tormentas**.",
      "",
      "Empieza por la [[Historia]] o conoce a la [[Party Principal]]. Las reglas de la casa están en [[Sistemas]].",
      "",
      ":::dm",
      "Esto es un bloque de máster: los jugadores no lo ven. Cada página puede tener bloques así.",
      ":::",
    ].join("\n"),
    coverImage: "/content/images/archivo.jpg",
    theme: "caminapiedras",
    visibility: "public",
    joinPolicy: "request",
    maxPlayers: 12,
    ownerId: uid.dm,
  })
  .returning({ id: campaigns.id });

await db.insert(campaignMembers).values([
  { campaignId: camino.id, userId: uid.dm, role: "owner" },
  ...PLAYER_NAMES.map((n) => ({ campaignId: camino.id, userId: uid[n.toLowerCase()], role: "player" as const })),
]);

// Obsidian usa "carpeta/carpeta" como nota índice de cada carpeta.
const isFolderNote = (parts: string[]) => parts.length >= 2 && parts.at(-1) === parts.at(-2);
const folderNotes = new Map<string, RawPage>();
for (const p of raw) {
  const parts = p.slug.split("/");
  if (isFolderNote(parts)) folderNotes.set(parts.slice(0, -1).join("/"), p);
}
// Páginas que no tienen sentido en la nueva estructura: la raíz y el índice de la campaña.
const SKIP = new Set(["Archivo", "Caminapiedras/Caminapiedras"]);

function parentSlugOf(p: RawPage): string | null {
  const parts = p.slug.split("/");
  let folder = parts.slice(0, isFolderNote(parts) ? -2 : -1);
  while (folder.length > 0) {
    const note = folderNotes.get(folder.join("/"));
    if (note && note.slug !== p.slug) return SKIP.has(note.slug) ? null : note.slug;
    folder = folder.slice(0, -1);
  }
  return null;
}

function convertContent(p: RawPage, isIndex: boolean): string {
  let md = p.content_admin
    .replace(/<dm-section>([\s\S]*?)<\/dm-section>/g, (_m, inner: string) => `\n:::dm\n${inner.trim()}\n:::\n`)
    .replace(/!\[([^\]]*)\]\(\/([^)]+)\)/g, (_m, alt: string, file: string) => `![${alt}](</content/archivo/public/${file}>)`);
  // Los índices de carpeta solo listaban enlaces a sus hijas: ahora salen como tarjetas.
  if (isIndex && md.split("\n").every((line) => !line.trim() || /^\s*\[\[[^\]]+\]\]\s*$/.test(line))) md = "";
  return md.trim();
}

const TOP_LEVEL = ["Historia", "Party Principal", "Personajes", "Enemigos", "Asociaciones", "Sistemas"];
const ICONS: Record<string, string> = {
  Historia: "📜",
  "Party Principal": "🛡️",
  Personajes: "👥",
  Enemigos: "⚔️",
  Asociaciones: "🏛️",
  Sistemas: "⚙️",
};

const imported = raw.filter((p) => !SKIP.has(p.slug));
const taken = new Set<string>();
const slugOf = new Map<string, string>();
for (const p of imported) {
  const slug = uniqueSlug(slugify(p.title), taken);
  taken.add(slug);
  slugOf.set(p.slug, slug);
}

const byParent = new Map<string | null, RawPage[]>();
for (const p of imported) {
  const parent = parentSlugOf(p);
  byParent.set(parent, [...(byParent.get(parent) ?? []), p]);
}
const collator = new Intl.Collator("es", { numeric: true });
const topRank = (title: string) => (TOP_LEVEL.includes(title) ? TOP_LEVEL.indexOf(title) : TOP_LEVEL.length);
const sortSiblings = (list: RawPage[], parent: string | null) =>
  parent === null
    ? list.sort((a, b) => topRank(a.title) - topRank(b.title))
    : list.sort((a, b) => collator.compare(a.title, b.title));

// Inserta por niveles para conocer el id del padre.
const idOf = new Map<string, string>();
const queue: (string | null)[] = [null];
while (queue.length) {
  const parent = queue.shift()!;
  const children = sortSiblings(byParent.get(parent) ?? [], parent);
  for (const [position, p] of children.entries()) {
    const content = convertContent(p, folderNotes.get(p.slug.split("/").slice(0, -1).join("/")) === p);
    const allowed = p.allowed_users.map((u) => uid[u.toLowerCase()]).filter(Boolean);
    const [row] = await db
      .insert(pages)
      .values({
        campaignId: camino.id,
        parentId: parent ? idOf.get(parent)! : null,
        slug: slugOf.get(p.slug)!,
        title: p.title,
        icon: parent === null ? (ICONS[p.title] ?? "") : "",
        coverImage: firstImage(content),
        content,
        visibility: p.visibility === "public" ? "public" : allowed.length ? "restricted" : "dm",
        allowedUserIds: allowed,
        spoilers: p.spoilers,
        position,
        updatedBy: uid.dm,
      })
      .returning({ id: pages.id });
    idOf.set(p.slug, row.id);
    queue.push(p.slug);
  }
}

await db.insert(messages).values([
  { campaignId: camino.id, userId: uid.dm, body: "¡Bienvenidos a la nueva web de la campaña! El chat ya funciona aquí mismo." },
  { campaignId: camino.id, userId: uid.iker, body: "¿Quedamos el sábado a las 17:00 para la siguiente sesión?" },
  { campaignId: camino.id, userId: uid.salva, body: "Por mí perfecto. Llevo las fichas actualizadas." },
  // Privados: solo los ven sus dos participantes.
  {
    campaignId: camino.id,
    userId: uid.iker,
    recipientId: uid.dm,
    body: "Oye, ¿puede mi personaje haber oído hablar de los Sangre Espectral antes? Quiero meterlo en su trasfondo.",
  },
  {
    campaignId: camino.id,
    userId: uid.dm,
    recipientId: uid.iker,
    body: "Sí: un rumor en Kharbranth. Te lo cuento en la próxima sesión, no se lo digas al resto 😉",
  },
]);

// ─── Campaña 2: pequeña, de entrada libre ────────────────────────────────────

const [cripta] = await db
  .insert(campaigns)
  .values({
    slug: "la-cripta-del-rey-olvidado",
    name: "La Cripta del Rey Olvidado",
    tagline: "Mazmorreo clásico para jugadores nuevos. Una sesión cada dos semanas, online.",
    gameSystem: "D&D 5e",
    description:
      "Partida introductoria: **no hace falta experiencia**. Buscamos 2 jugadores más.\n\nLee el [[Mundo]] antes de crear tu personaje.",
    theme: "custom",
    customTheme: { accent: "#7ad3a8", background: ["#1f3b2c", "#2b2140", "#0e1f2e"] },
    joinPolicy: "open",
    maxPlayers: 5,
    ownerId: uid.ana,
  })
  .returning({ id: campaigns.id });

await db.insert(campaignMembers).values([
  { campaignId: cripta.id, userId: uid.ana, role: "owner" },
  { campaignId: cripta.id, userId: uid.iker, role: "player" },
  { campaignId: cripta.id, userId: uid.val, role: "player" },
]);

const [mundo] = await db
  .insert(pages)
  .values({
    campaignId: cripta.id,
    slug: "mundo",
    title: "Mundo",
    icon: "🗺️",
    visibility: "public",
    position: 0,
    content:
      "## El valle de Brumahonda\n\nUn valle de pastores a la sombra de la **Cripta del Rey Olvidado**.\n\n| Lugar | Descripción |\n| --- | --- |\n| Aldea de Roble | Punto de partida |\n| La Cripta | Nadie que entró ha vuelto |\n\n:::dm\nEl rey no está muerto: es el posadero de Roble.\n:::",
  })
  .returning({ id: pages.id });
const [diario] = await db
  .insert(pages)
  .values({ campaignId: cripta.id, slug: "diario", title: "Diario de sesiones", icon: "📜", visibility: "members", position: 1 })
  .returning({ id: pages.id });
await db.insert(pages).values([
  {
    campaignId: cripta.id,
    parentId: diario.id,
    slug: "sesion-1",
    title: "Sesión 1: La posada",
    visibility: "members",
    content: "El grupo se conoce en la posada de Roble y acepta explorar la cripta. Ver [[Mundo]].",
  },
  {
    campaignId: cripta.id,
    parentId: mundo.id,
    slug: "secretos-del-valle",
    title: "Secretos del valle",
    icon: "🔒",
    visibility: "dm",
    content: "Encuentros aleatorios y tesoros. Solo para el máster.",
  },
  {
    campaignId: cripta.id,
    slug: "trasfondo-de-iker",
    title: "Trasfondo de Iker",
    icon: "🧝",
    visibility: "restricted",
    allowedUserIds: [uid.iker],
    position: 2,
    content: "Solo Iker (y la máster) pueden leer esta página.",
  },
]);

// ─── Campaña 3: privada, solo para sus miembros ──────────────────────────────

const [bruma] = await db
  .insert(campaigns)
  .values({
    slug: "nacidos-de-la-bruma",
    name: "Nacidos de la Bruma",
    tagline: "Alomancia y revolución en Luthadel.",
    gameSystem: "Mistborn Adventure Game",
    coverImage: "/content/images/mistborn.png",
    theme: "sangre-espectral",
    visibility: "private",
    joinPolicy: "closed",
    status: "paused",
    ownerId: uid.dm,
  })
  .returning({ id: campaigns.id });
await db.insert(campaignMembers).values([
  { campaignId: bruma.id, userId: uid.dm, role: "owner" },
  { campaignId: bruma.id, userId: uid.ana, role: "editor" },
]);

await close();
console.log(`✓ Datos de demo creados: ${userRows.length} usuarios, ${idOf.size} páginas importadas en Caminapiedras.`);
console.log(`  Contraseña de todos los usuarios: ${PASSWORD}`);
console.log("  Prueba: dm (máster), iker (jugador), ana (máster de La Cripta), bruno (sin campañas).");
