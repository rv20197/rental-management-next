import pino from 'pino';

// In development we run a pino-pretty transport for human-readable logs.
// In production (Vercel / any Node deploy) we ship structured JSON, which
// the host's log aggregator can parse.
const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino(
  isDev
    ? {
        level: process.env.LOG_LEVEL || 'debug',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }
    : {
        level: process.env.LOG_LEVEL || 'info',
      },
);
