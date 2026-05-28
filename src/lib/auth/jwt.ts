import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

export type SessionRole = 'admin' | 'manager';

export interface SessionClaims {
  id: number;
  role: SessionRole;
  email: string;
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ id: claims.id, role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    const { id, role, email } = payload as Partial<SessionClaims>;
    if (typeof id !== 'number' || typeof email !== 'string') return null;
    if (role !== 'admin' && role !== 'manager') return null;
    return { id, role, email };
  } catch {
    return null;
  }
}
