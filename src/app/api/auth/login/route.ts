import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { comparePassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';
import { ensureDbReady } from '@/lib/db/setup';
import { createLimiter, enforceLimit, getClientIp } from '@/lib/rateLimit';
import { json, jsonError } from '@/lib/http';

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

// 5 login attempts per IP per minute. Loosely matches the old Express
// 20-per-15min limiter while allowing short bursts for typos.
const limiter = createLimiter('login', 5, '1 m');

export async function POST(request: Request) {
  await ensureDbReady();
  const limit = await enforceLimit(limiter, getClientIp(request));
  if (limit) return limit;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid credentials', 401);

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const user = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (!user) return jsonError('Invalid credentials', 401);

  const ok = await comparePassword(parsed.data.password, user.password);
  if (!ok) return jsonError('Invalid credentials', 401);

  await setSessionCookie({ id: user.id, role: user.role, email: user.email });
  return json({ message: 'Login successful' });
}
