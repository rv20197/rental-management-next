// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-32-bytes-long-padding-padding';
  process.env.SESSION_TTL_SECONDS = '60';
});

describe('jose JWT sign/verify', () => {
  it('round-trips claims (id, role, email) through sign + verify', async () => {
    const { signSession, verifySession } = await import('./jwt');
    const token = await signSession({ id: 42, role: 'manager', email: 'a@b.c' });
    const claims = await verifySession(token);
    expect(claims).toEqual({ id: 42, role: 'manager', email: 'a@b.c' });
  });

  it('returns null for a garbage token', async () => {
    const { verifySession } = await import('./jwt');
    expect(await verifySession('not-a-jwt')).toBeNull();
  });

  it('returns null when role is not admin or manager', async () => {
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const token = await new SignJWT({ id: 1, role: 'guest', email: 'x@y.z' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('60s')
      .sign(secret);
    const { verifySession } = await import('./jwt');
    expect(await verifySession(token)).toBeNull();
  });

  it('returns null when signed with a different secret', async () => {
    const { SignJWT } = await import('jose');
    const wrongSecret = new TextEncoder().encode('different-secret');
    const token = await new SignJWT({ id: 1, role: 'manager', email: 'x@y.z' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('60s')
      .sign(wrongSecret);
    const { verifySession } = await import('./jwt');
    expect(await verifySession(token)).toBeNull();
  });
});
