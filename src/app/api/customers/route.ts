import { z } from 'zod';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { json, jsonError, requireAuth } from '@/lib/http';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().nullish(),
  phone: z.string().min(1),
  address: z.string().nullish(),
});

function normalizeEmail(raw: unknown): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '') return null;
  return trimmed.toLowerCase();
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const rows = await db.select().from(customers);
  return json(rows);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid customer payload', 400);

  const email = normalizeEmail(parsed.data.email);
  if (email != null && !EMAIL_RE.test(email)) return jsonError('Invalid email format', 400);

  const [created] = await db
    .insert(customers)
    .values({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email,
      phone: parsed.data.phone,
      address: parsed.data.address ?? null,
    })
    .returning();
  return json(created, { status: 201 });
}
