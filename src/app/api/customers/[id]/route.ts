import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { json, jsonError, requireAuth } from '@/lib/http';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const patchSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().nullish(),
  phone: z.string().optional(),
  address: z.string().nullish(),
});

function normalizeEmail(raw: unknown): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '') return null;
  return trimmed.toLowerCase();
}

async function readCustomer(id: string) {
  const customerId = parseInt(id, 10);
  if (!Number.isFinite(customerId)) return null;
  return (await db.query.customers.findFirst({ where: eq(customers.id, customerId) })) ?? null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const customer = await readCustomer(id);
  if (!customer) return jsonError('Customer not found', 404);
  return json(customer);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const customer = await readCustomer(id);
  if (!customer) return jsonError('Customer not found', 404);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid customer payload', 400);

  const patch: Record<string, unknown> = {};
  if (parsed.data.firstName !== undefined) patch.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) patch.lastName = parsed.data.lastName;
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone;
  if (parsed.data.address !== undefined) patch.address = parsed.data.address;
  if ('email' in body) {
    const email = normalizeEmail(body.email);
    if (email != null && !EMAIL_RE.test(email)) return jsonError('Invalid email format', 400);
    patch.email = email;
  }

  const [next] = await db.update(customers).set(patch).where(eq(customers.id, customer.id)).returning();
  return json(next);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const customerId = parseInt(id, 10);
  if (!Number.isFinite(customerId)) return jsonError('Customer not found', 404);
  const result = await db.delete(customers).where(eq(customers.id, customerId)).returning({ id: customers.id });
  if (result.length === 0) return jsonError('Customer not found', 404);
  return json({ message: 'Customer deleted successfully' });
}
