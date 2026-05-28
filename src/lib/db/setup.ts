import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

function parseDbUrl(url: string) {
  const u = new URL(url);
  const dbName = u.pathname.replace(/^\//, '') || 'postgres';
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  return { dbName, adminUrl: adminUrl.toString() };
}

async function ensureDatabaseExists(url: string): Promise<void> {
  const { dbName, adminUrl } = parseDbUrl(url);
  const admin = postgres(adminUrl, {
    max: 1,
    ssl: env.DB_SSL ? 'require' : false,
    onnotice: () => {},
  });
  try {
    const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (rows.length === 0) {
      logger.info({ dbName }, 'creating database');
      // CREATE DATABASE doesn't accept parameter binding for the name.
      // Quote it and escape embedded quotes to neutralize injection from a
      // malformed DATABASE_URL.
      const escapedName = dbName.replace(/"/g, '""');
      await admin.unsafe(`CREATE DATABASE "${escapedName}"`);
      logger.info({ dbName }, 'database created');
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

async function runMigrations(url: string): Promise<void> {
  const client = postgres(url, {
    max: 1,
    ssl: env.DB_SSL ? 'require' : false,
    onnotice: () => {},
  });
  try {
    const migratorDb = drizzle(client);
    const migrationsFolder = path.join(process.cwd(), 'drizzle');
    logger.info({ migrationsFolder }, 'running drizzle migrations');
    await migrate(migratorDb, { migrationsFolder });
    logger.info('drizzle migrations complete');
  } finally {
    await client.end({ timeout: 5 });
  }
}

let bootstrapPromise: Promise<void> | null = null;

/**
 * On first call, optionally creates the target database (if it doesn't
 * exist) and runs every pending Drizzle migration. Idempotent — subsequent
 * calls return the cached promise. Safe to call from every route handler.
 *
 * - `SKIP_DB_SETUP=true` — disable entirely (e.g. when you've already
 *    migrated and want zero startup overhead).
 * - In production this is **opt-in** via `AUTO_DB_SETUP=true`. The default
 *    expectation in prod is that `npm run db:migrate` runs as part of your
 *    deploy pipeline. Auto-setup at request time is risky in a serverless
 *    deploy where many cold starts race to migrate.
 */
export function ensureDbReady(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    if (process.env.SKIP_DB_SETUP === 'true') {
      logger.debug('SKIP_DB_SETUP=true — db setup skipped');
      return;
    }
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && process.env.AUTO_DB_SETUP !== 'true') {
      logger.debug('production mode — auto db setup disabled; run `npm run db:migrate` as part of deploy');
      return;
    }
    try {
      await ensureDatabaseExists(env.DATABASE_URL);
    } catch (err) {
      // Managed Postgres providers (Neon, Supabase, RDS) usually deny the
      // `postgres` admin db. In that case the target db is already there;
      // log and continue so migrations can still run.
      logger.warn({ err: (err as Error).message }, 'could not verify db existence; assuming it already exists');
    }
    await runMigrations(env.DATABASE_URL);
  })().catch((err) => {
    logger.error({ err }, 'db bootstrap failed');
    bootstrapPromise = null; // allow a future request to retry
    throw err;
  });
  return bootstrapPromise;
}
