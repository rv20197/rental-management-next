import { runReminderSweep } from '@/lib/services/reminderService';
import { ensureDbReady } from '@/lib/db/setup';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { json, jsonError } from '@/lib/http';

// Replaces the daily node-cron job from the Express backend.
// Vercel Cron hits this endpoint on the schedule in vercel.json and
// attaches CRON_SECRET as a Bearer token.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    logger.warn({ ip: request.headers.get('x-forwarded-for') }, 'cron call rejected: bad secret');
    return jsonError('Unauthorized', 401);
  }
  try {
    await ensureDbReady();
    const result = await runReminderSweep();
    return json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, 'reminder sweep failed');
    return jsonError(`Reminder sweep failed: ${(err as Error).message}`, 500);
  }
}
