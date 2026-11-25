// Runs once when a Next.js server instance starts, before it serves requests.
// Creates the database if missing and applies pending Drizzle migrations, so
// `yarn dev` / `yarn start` work against a fresh Postgres with no manual steps.
// Honors the same SKIP_DB_SETUP / AUTO_DB_SETUP flags as ensureDbReady().
export async function register() {
  // setup.ts uses Node-only modules (postgres, node:path); skip the Edge runtime.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { ensureDbReady } = await import('@/lib/db/setup');
  try {
    await ensureDbReady();
  } catch {
    // Already logged by ensureDbReady. Don't crash the server (e.g. Postgres
    // not running yet) — the cached promise is reset, so the next API request
    // retries setup via the existing per-route ensureDbReady() calls.
  }
}
