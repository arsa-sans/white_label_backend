/**
 * src/utils/logger.ts
 * Simple structured logger. In production, swap with winston/pino if needed.
 */
import { env } from '../config/env';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function log(level: LogLevel, message: string, meta?: unknown): void {
  if (level === 'debug' && !env.isDev) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(meta !== undefined && { meta }),
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
  debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
};
