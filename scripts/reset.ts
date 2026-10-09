import "./env";
import { rmSync } from "node:fs";
import { PGLITE_DIR } from "../lib/db/client";

if (process.env.DATABASE_URL) {
  console.error("db:reset solo borra la base de datos local (PGlite). Quita DATABASE_URL para usarlo.");
  process.exit(1);
}
rmSync(PGLITE_DIR, { recursive: true, force: true });
console.log("✓ Base de datos local eliminada");
