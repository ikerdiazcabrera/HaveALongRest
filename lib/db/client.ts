import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { mkdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

export type DbHandle =
  | { kind: "postgres"; db: Db; client: postgres.Sql; close: () => Promise<void> }
  | { kind: "pglite"; db: Db; client: PGlite; close: () => Promise<void> };

export const PGLITE_DIR = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");

/**
 * Con `DATABASE_URL` se conecta a Postgres (Neon, Supabase, Vercel Postgres...).
 * Sin ella usa PGlite: Postgres embebido en un directorio local, sin instalar nada.
 * Ambos hablan el mismo SQL, así que las migraciones y consultas son idénticas.
 */
export function createDb(): DbHandle {
  const url = process.env.DATABASE_URL;
  if (url) {
    // prepare:false para funcionar detrás de poolers en modo transacción (Supabase/Neon).
    const client = postgres(url, { prepare: false, max: process.env.VERCEL ? 3 : 10 });
    const db = drizzlePostgres(client, { schema });
    return { kind: "postgres", db, client, close: () => client.end() };
  }
  if (process.env.VERCEL) {
    throw new Error("Falta DATABASE_URL: en Vercel el sistema de ficheros es efímero y PGlite no sirve.");
  }
  mkdirSync(PGLITE_DIR, { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  // Misma API de consultas que postgres-js; el tipo concreto del driver no importa a la app.
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  return { kind: "pglite", db, client, close: () => client.close() };
}
