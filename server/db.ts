import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

function getConnectionString(): string | null {
  const { PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT } = process.env;

  if (PGHOST && PGUSER && PGPASSWORD && PGDATABASE) {
    const port = PGPORT || '5432';
    const encoded = encodeURIComponent(PGPASSWORD);
    return `postgresql://${PGUSER}:${encoded}@${PGHOST}:${port}/${PGDATABASE}?sslmode=require`;
  }

  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  return null;  // no credentials — caller will use in-memory storage instead
}

const connectionString = getConnectionString();

// db and pool are null when no credentials are configured.
// storage.ts checks for this and falls back to MemStorage automatically.
export const pool = connectionString ? new Pool({ connectionString }) : null;
export const db   = connectionString ? drizzle({ client: pool!, schema }) : null;
