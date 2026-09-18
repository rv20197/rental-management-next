import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Opt pdfkit out of bundling so its font files can be read properly
  serverExternalPackages: ['pdfkit'],

  turbopack: {
    root: path.resolve(__dirname),
  },
  // Ship the drizzle/ migrations folder with the serverless bundle so
  // ensureDbReady() can run pending migrations at request time. Without
  // this, the migrations folder is excluded from the build output.
  outputFileTracingIncludes: {
    '/api/**/*': ['./drizzle/**/*'],
  },
};

export default nextConfig;
