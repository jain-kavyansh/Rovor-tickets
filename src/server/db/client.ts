import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;
const g = globalThis as unknown as { pgPool?: Pool; drizzleDb?: Db };

function getDb(): Db {
  if (!g.drizzleDb) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
    // Reused across hot reloads and warm serverless invocations.
    g.pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    g.drizzleDb = drizzle(g.pgPool, { schema });
  }
  return g.drizzleDb;
}

/** Lazily initialised so `next build` doesn't need a database connection or env var. */
export const db = new Proxy({} as Db, {
  get: (_t, prop) => Reflect.get(getDb(), prop),
});
