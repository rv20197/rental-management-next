import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { ensureDbReady } from '@/lib/db/setup';
import { createLimiter, enforceLimit, getClientIp } from '@/lib/rateLimit';
import { json, jsonError } from '@/lib/http';

const schema = z.object({ email: z.string().min(1) });

const RESPONSE_MESSAGE = 'If an account with that email exists, a password reset link has been sent.';

// 3 reset emails per IP per hour. Caps "spam the reset endpoint" attacks
// without locking out an honest user who mistyped their email a couple of
// times.
const limiter = createLimiter('forgot-password', 3, '1 h');

export async function POST(request: Request) {
  await ensureDbReady();
  const limit = await enforceLimit(limiter, getClientIp(request));
  if (limit) return limit;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Email is required', 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError('Email is required', 400);

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const user = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  // Don't reveal whether the email exists; always respond 200.
  if (!user) return json({ message: RESPONSE_MESSAGE });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expires = new Date(Date.now() + 3600 * 1000);

  await db
    .update(users)
    .set({ resetPasswordToken: hashed, resetPasswordExpires: expires })
    .where(eq(users.id, user.id));

  const resetUrl = `${env.FRONTEND_URL}/reset-password/${resetToken}`;
  const message = `You are receiving this email because you (or someone else) have requested the reset of a password. \n\n Please click on the following link, or paste this into your browser to complete the process: \n\n ${resetUrl}`;

  try {
    await sendEmail(user.email, 'Password Reset Request', message);
  } catch (err) {
    // Log so ops can see SMTP failures, but still 200 below so the response
    // does not reveal whether the email actually existed.
    logger.error({ err, userId: user.id }, 'password reset email failed');
  }

  return json({ message: RESPONSE_MESSAGE });
}
