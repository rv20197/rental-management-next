// Creates the database named in DATABASE_URL if it doesn't exist yet.
// Run before `drizzle-kit migrate`, which fails on a missing database.
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const target = new URL(url);
const dbName = decodeURIComponent(target.pathname.replace(/^\//, '')) || 'postgres';
const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';

const ssl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' ? 'require' : false;
const admin = postgres(adminUrl.toString(), { max: 1, ssl, onnotice: () => {} });

try {
  const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (rows.length === 0) {
    await admin.unsafe(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database "${dbName}"`);
  } else {
    console.log(`Database "${dbName}" exists`);
  }
} catch (err) {
  // Managed providers (Neon, Supabase, RDS) often deny access to the admin db;
  // the target db already exists there, so let the migration step proceed.
  console.warn(`Could not verify database existence (${err.message}); continuing`);
} finally {
  await admin.end({ timeout: 5 });
}
