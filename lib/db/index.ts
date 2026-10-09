import "server-only";
import { createDb, type Db, type DbHandle } from "./client";

// Un único cliente por proceso (sobrevive a la recarga en caliente de `next dev`).
const globalForDb = globalThis as unknown as { __hlrDb?: DbHandle };

function handle(): DbHandle {
  return (globalForDb.__hlrDb ??= createDb());
}

/**
 * Conexión perezosa: se abre en la primera consulta. Así `next build` (que importa los
 * módulos en varios procesos) no abre la base de datos ni exige DATABASE_URL.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = handle().db;
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export * from "./schema";
