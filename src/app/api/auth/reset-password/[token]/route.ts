import crypto from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { ensureDbReady } from '@/lib/db/setup';
import { createLimiter, enforceLimit, getClientIp } from '@/lib/rateLimit';
import { json, jsonError } from '@/lib/http';

const schema = z.object({ password: z.string().min(1) });

// 5 reset submissions per IP per hour. Defends against attackers who
// scraped a leaked reset token and try to brute-force the password form.
const limiter = createLimiter('reset-password', 5, '1 h');

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  await ensureDbReady();
  const limit = await enforceLimit(limiter, getClientIp(request));
  if (limit) return limit;

  const { token } = await params;
  if (!token) return jsonError('Invalid token', 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('New password is required', 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError('New password is required', 400);

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await db.query.users.findFirst({
    where: and(eq(users.resetPasswordToken, hashedToken), gt(users.resetPasswordExpires, new Date())),
  });
  if (!user) return jsonError('This reset link is invalid or has expired.', 400);

  const hashed = await hashPassword(parsed.data.password);
  await db
    .update(users)
    .set({ password: hashed, resetPasswordToken: null, resetPasswordExpires: null })
    .where(eq(users.id, user.id));

  return json({ message: 'Password reset successfully. Please log in.' });
}
