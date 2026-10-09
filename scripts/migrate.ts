import "./env";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { createDb } from "../lib/db/client";

const handle = createDb();
const migrationsFolder = "./drizzle";

if (handle.kind === "pglite") {
  await migratePglite(drizzlePglite(handle.client), { migrationsFolder });
} else {
  await migratePostgres(handle.db, { migrationsFolder });
}
await handle.close();
console.log(`✓ Migraciones aplicadas (${handle.kind})`);
