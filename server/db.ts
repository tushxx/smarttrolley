import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

function getConnectionString(): string {
  const { PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT } = process.env;

  // Prefer building from individual vars (always fresh from Replit)
  if (PGHOST && PGUSER && PGPASSWORD && PGDATABASE) {
    const port = PGPORT || '5432';
    const encoded = encodeURIComponent(PGPASSWORD);
    return `postgresql://${PGUSER}:${encoded}@${PGHOST}:${port}/${PGDATABASE}?sslmode=require`;
  }

  // Fall back to DATABASE_URL
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  throw new Error(
    "Database credentials not found. Set PGHOST, PGUSER, PGPASSWORD, PGDATABASE or DATABASE_URL."
  );
}

const connectionString = getConnectionString();
export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });
