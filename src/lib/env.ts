// Centralized server-side env access. Fails fast on first use if a required
// var is missing, so the error points at the boundary (route handler / cron
// invocation) instead of failing deep inside jose / Drizzle.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  get DATABASE_URL() {
    return required('DATABASE_URL');
  },
  get JWT_SECRET() {
    return required('JWT_SECRET');
  },
  get CRON_SECRET() {
    return required('CRON_SECRET');
  },
  get SESSION_COOKIE_NAME() {
    return process.env.SESSION_COOKIE_NAME || 'rms_session';
  },
  get SESSION_TTL_SECONDS() {
    return optionalInt('SESSION_TTL_SECONDS', 24 * 60 * 60);
  },
  get DB_SSL() {
    return process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';
  },
  get FRONTEND_URL() {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  },
  get FROM_NAME() {
    return process.env.FROM_NAME || 'Rental Management';
  },
  get FROM_EMAIL() {
    return process.env.FROM_EMAIL || '';
  },
  get SMTP_HOST() {
    return process.env.SMTP_HOST || '';
  },
  get SMTP_PORT() {
    return optionalInt('SMTP_PORT', 587);
  },
  get SMTP_SECURE() {
    return process.env.SMTP_SECURE === 'true';
  },
  get SMTP_USER() {
    return process.env.SMTP_USER || '';
  },
  get SMTP_PASS() {
    return process.env.SMTP_PASS || '';
  },
};
