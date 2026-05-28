import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { ensureDbReady } from '@/lib/db/setup';
import { createLimiter, enforceLimit, getClientIp } from '@/lib/rateLimit';
import { json, jsonError } from '@/lib/http';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

// 5 sign-ups per IP per hour. Keeps a single home/office IP from being
// blocked while still slowing automated account creation.
const limiter = createLimiter('register', 5, '1 h');

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
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Name, email, and password are required', 400);
  }
  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (existing) return jsonError('User already exists', 400);

  const hashed = await hashPassword(parsed.data.password);
  const [created] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: normalizedEmail,
      password: hashed,
      role: 'manager',
    })
    .returning({ id: users.id });

  return json({ message: 'User created successfully', userId: created.id }, { status: 201 });
}
