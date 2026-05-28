import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Ship the drizzle/ migrations folder with the serverless bundle so
  // ensureDbReady() can run pending migrations at request time. Without
  // this, the migrations folder is excluded from the build output.
  outputFileTracingIncludes: {
    '/api/**/*': ['./drizzle/**/*'],
  },
};

export default nextConfig;
