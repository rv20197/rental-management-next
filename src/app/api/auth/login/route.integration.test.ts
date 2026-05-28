// Integration test for POST /api/auth/login.
//
// This file shows the pattern for integration-testing a Next.js route
// handler against a real Postgres + cookie store. It only runs when
// TEST_DATABASE_URL is set in the environment; otherwise it is skipped.
//
// To enable:
//   1. Create an empty Postgres database (e.g. `createdb rental_test`).
//   2. Export TEST_DATABASE_URL=postgres://... in your shell or .env.test.
//   3. Apply the schema:  DATABASE_URL=$TEST_DATABASE_URL npm run db:migrate
//   4. Re-run `npm test`.
//
// The harness:
//   - Imports the route handler directly (no HTTP server).
//   - Builds a Request with cookies-relevant headers.
//   - Asserts on the returned Response.
//
// For full Set-Cookie testing, see `cookies()` mocking notes in
// https://nextjs.org/docs/app/building-your-application/testing/vitest.

import { describe, expect, it } from 'vitest';

const hasTestDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!hasTestDb)('POST /api/auth/login (integration)', () => {
  it('rejects unknown email with 401', async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
    process.env.JWT_SECRET ??= 'test-secret-please-replace-in-ci';

    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'whatever' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('Invalid credentials');
  });
});

if (!hasTestDb) {
  describe('POST /api/auth/login (integration) [skipped]', () => {
    it('is skipped without TEST_DATABASE_URL — see file header for setup', () => {
      expect(hasTestDb).toBe(false);
    });
  });
}
