import { getSession } from '@/lib/auth/session';
import type { SessionClaims } from '@/lib/auth/jwt';
import { ensureDbReady } from '@/lib/db/setup';

function toJsonSafe(body: unknown): unknown {
  if (body == null) return body;
  if (body instanceof Date) return body.toISOString();
  if (typeof body === 'bigint') return body.toString();
  if (Array.isArray(body)) return body.map((item) => toJsonSafe(item));
  if (typeof body === 'object') {
    if (typeof (body as { toJSON?: unknown }).toJSON === 'function') {
      return toJsonSafe((body as { toJSON: () => unknown }).toJSON());
    }
    if (body instanceof Map) {
      return Object.fromEntries(Array.from(body.entries(), ([key, value]) => [String(key), toJsonSafe(value)]));
    }
    if (body instanceof Set) {
      return Array.from(body.values(), (value) => toJsonSafe(value));
    }
    return Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, toJsonSafe(value)]),
    );
  }
  return body;
}

export function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(toJsonSafe(body) ?? null, init);
}

export function jsonError(message: string, status = 500): Response {
  return Response.json({ message }, { status });
}

export async function requireAuth(): Promise<SessionClaims | Response> {
  await ensureDbReady();
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);
  return session;
}

export function pickRouteStatusFromError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  let status = 500;
  if (msg.includes('not found')) status = 404;
  else if (msg.includes('edited')) status = 403;
  else if (msg.includes('Insufficient') || msg.startsWith('Invalid') || msg.includes('active') || msg.includes('required') || msg.includes('after start date')) status = 400;
  return { status, message: msg };
}
