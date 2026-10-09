// Datos de demostración. BORRA todo el contenido de la base de datos.
//   npm run db:seed            (solo con la base de datos local)
//   npm run db:seed -- --force (también contra DATABASE_URL: ¡cuidado!)
//
// Crea una demo genérica. Si existe scripts/private/archivo.ts (no está en el repositorio
// público), además importa la campaña privada con sus datos reales.
import "./env";
import { existsSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { hashPassword } from "../lib/auth/password";
import { createDb, type Db } from "../lib/db/client";
import { campaignMembers, campaigns, messages, pages, users } from "../lib/db/schema";

if (process.env.DATABASE_URL && !process.argv.includes("--force")) {
  console.error("DATABASE_URL está definida: el seed borraría esa base de datos. Usa --force si de verdad quieres.");
  process.exit(1);
}

const PASSWORD = "longrest";
const { db, close } = createDb();

await db.execute(sql`TRUNCATE users, sessions, campaigns, campaign_members, pages, messages, rate_limits RESTART IDENTITY CASCADE`);

// ─── Usuarios ────────────────────────────────────────────────────────────────

const passwordHash = await hashPassword(PASSWORD);
const userRows = await db
  .insert(users)
  .values(
    [
      {
        username: "dm",
        displayName: "El Máster",
        bio: "Dirijo partidas desde hace años. Me encantan las campañas largas y los giros de guion.",
        favoriteGames: ["Cosmere RPG", "Mistborn Adventure Game", "D&D 5e"],
      },
      {
        username: "ana",
        displayName: "Ana",
        bio: "Máster novata pero entusiasta. Busco jugadores con paciencia y ganas de explorar mazmorras.",
        favoriteGames: ["D&D 5e", "La Llamada de Cthulhu"],
      },
      { username: "lyra", displayName: "Lyra", bio: "Juego de pícara siempre que puedo.", favoriteGames: ["D&D 5e", "Pathfinder"] },
      { username: "tomas", displayName: "Tomás" },
      { username: "bruno", displayName: "Bruno" },
    ].map((u) => ({ ...u, email: `${u.username}@example.com`, passwordHash })),
  )
  .returning({ id: users.id, username: users.username });
const uid = Object.fromEntries(userRows.map((u) => [u.username, u.id])) as Record<string, string>;

/** Ruta de una imagen de /public solo si existe (las de las campañas privadas no están en el repo). */
const publicImage = (src: string) => (existsSync(path.join("public", src)) ? src : null);

// ─── La Cripta del Rey Olvidado: pública, entrada libre, tema personalizado ──

const [cripta] = await db
  .insert(campaigns)
  .values({
    slug: "la-cripta-del-rey-olvidado",
    name: "La Cripta del Rey Olvidado",
    tagline: "Mazmorreo clásico para jugadores nuevos. Una sesión cada dos semanas, online.",
    gameSystem: "D&D 5e",
    description: [
      "Partida introductoria: **no hace falta experiencia**. Buscamos 2 jugadores más.",
      "",
      "Lee el [[Mundo]] antes de crear tu personaje y repasa el [[Diario de sesiones]].",
      "",
      ":::dm",
      "Esto es un bloque de máster: los jugadores no lo ven. Cada página puede tener bloques así.",
      ":::",
    ].join("\n"),
    theme: "custom",
    customTheme: { accent: "#7ad3a8", background: ["#1f3b2c", "#2b2140", "#0e1f2e"] },
    joinPolicy: "open",
    maxPlayers: 5,
    ownerId: uid.ana,
  })
  .returning({ id: campaigns.id });

await db.insert(campaignMembers).values([
  { campaignId: cripta.id, userId: uid.ana, role: "owner" },
  { campaignId: cripta.id, userId: uid.lyra, role: "player" },
  { campaignId: cripta.id, userId: uid.tomas, role: "player" },
]);

type PageSeed = {
  slug: string;
  title: string;
  icon?: string;
  visibility?: "public" | "members" | "restricted" | "dm";
  allowedUserIds?: string[];
  content?: string;
  children?: PageSeed[];
};

/** Inserta un árbol de páginas respetando el orden. */
async function insertTree(database: Db, campaignId: string, tree: PageSeed[], parentId: string | null = null) {
  for (const [position, { children, ...page }] of tree.entries()) {
    const [row] = await database
      .insert(pages)
      .values({ campaignId, parentId, position, visibility: "members", ...page })
      .returning({ id: pages.id });
    if (children) await insertTree(database, campaignId, children, row.id);
  }
}

await insertTree(db, cripta.id, [
  {
    slug: "mundo",
    title: "Mundo",
    icon: "🗺️",
    visibility: "public",
    content: [
      "## El valle de Brumahonda",
      "",
      "Un valle de pastores a la sombra de la **Cripta del Rey Olvidado**.",
      "",
      "| Lugar | Descripción |",
      "| --- | --- |",
      "| [[Aldea de Roble]] | Punto de partida |",
      "| [[La Cripta]] | Nadie que entró ha vuelto |",
      "",
      ":::dm",
      "El rey no está muerto: es [[Brann el posadero]].",
      ":::",
    ].join("\n"),
    children: [
      {
        slug: "lugares",
        title: "Lugares",
        icon: "📍",
        visibility: "public",
        children: [
          { slug: "aldea-de-roble", title: "Aldea de Roble", visibility: "public", content: "Casas de piedra, una posada y un pozo que nunca se seca." },
          { slug: "la-cripta", title: "La Cripta", visibility: "public", content: "Una escalera que baja más de lo que debería." },
        ],
      },
      { slug: "secretos-del-valle", title: "Secretos del valle", icon: "🔒", visibility: "dm", content: "Encuentros aleatorios y tesoros." },
    ],
  },
  {
    slug: "diario-de-sesiones",
    title: "Diario de sesiones",
    icon: "📜",
    children: [
      { slug: "sesion-1", title: "Sesión 1: La posada", content: "El grupo se conoce en la [[Aldea de Roble]] y acepta explorar la cripta." },
      { slug: "sesion-2", title: "Sesión 2: Escaleras abajo", content: "Primer descenso. Tomás cae en una trampa de pinchos." },
    ],
  },
  {
    slug: "personajes",
    title: "Personajes",
    icon: "👥",
    children: [{ slug: "brann-el-posadero", title: "Brann el posadero", content: "Amable, servicial y sospechosamente viejo." }],
  },
  {
    slug: "trasfondo-de-lyra",
    title: "Trasfondo de Lyra",
    icon: "🗝️",
    visibility: "restricted",
    allowedUserIds: [uid.lyra],
    content: "Solo Lyra (y la máster) pueden leer esta página.",
  },
]);

await db.insert(messages).values([
  { campaignId: cripta.id, userId: uid.ana, body: "¡Bienvenidos! La próxima sesión es el jueves a las 19:00." },
  { campaignId: cripta.id, userId: uid.tomas, body: "Allí estaré. Esta vez miro dónde piso." },
  // Privados: solo los ven sus dos participantes.
  { campaignId: cripta.id, userId: uid.lyra, recipientId: uid.ana, body: "¿Puede mi pícara conocer al posadero de antes?" },
  { campaignId: cripta.id, userId: uid.ana, recipientId: uid.lyra, body: "Sí, pero no se lo cuentes al resto 😉" },
]);

// ─── Nacidos de la Bruma: privada, solo para sus miembros ────────────────────

const [bruma] = await db
  .insert(campaigns)
  .values({
    slug: "nacidos-de-la-bruma",
    name: "Nacidos de la Bruma",
    tagline: "Alomancia y revolución en Luthadel.",
    gameSystem: "Mistborn Adventure Game",
    coverImage: publicImage("/content/images/mistborn.png"),
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

// ─── Datos privados (opcionales) ─────────────────────────────────────────────

const privateSeed = path.join(import.meta.dirname, "private", "archivo.ts");
let privateSummary = "";
if (existsSync(privateSeed)) {
  // Especificador no literal: el repositorio público no tiene este módulo y TypeScript no debe exigirlo.
  const modulePath = "./private/archivo.ts";
  const { default: seedArchivo } = await import(modulePath);
  privateSummary = await seedArchivo({ db, passwordHash, dmId: uid.dm });
}

await close();
console.log(`✓ Datos de demo creados (contraseña de todos: ${PASSWORD})`);
console.log("  dm, ana (máster de La Cripta), lyra y tomas (jugadores), bruno (sin campañas)");
if (privateSummary) console.log(`  + ${privateSummary}`);
