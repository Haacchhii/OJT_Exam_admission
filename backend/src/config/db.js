import { PrismaClient } from '../../generated/prisma-client/index.js';
import env from './env.js';
import { observeDbQuery } from '../utils/perfStore.js';
import { getRequestContext } from '../utils/requestContext.js';

const logLevel = [
  { emit: 'stdout', level: 'error' },
  { emit: 'stdout', level: 'warn' },
  { emit: 'event', level: 'query' },
];

const isServerless = Boolean(process.env.VERCEL);
const defaultPoolSize = isServerless ? 5 : 20;        // Increased from 1 → 5 for Vercel
const defaultPoolTimeout = isServerless ? 10 : 10;     // Increased from 5 → 10 for Vercel

const parsedPoolSize = Number.parseInt(process.env.DATABASE_POOL_SIZE ?? '', 10);
const parsedPoolTimeout = Number.parseInt(process.env.DATABASE_POOL_TIMEOUT ?? '', 10);
const poolSize = Number.isNaN(parsedPoolSize) ? defaultPoolSize : parsedPoolSize;
const poolTimeout = Number.isNaN(parsedPoolTimeout) ? defaultPoolTimeout : parsedPoolTimeout;

const prisma = new PrismaClient({
  log: logLevel,
  datasources: {
    db: {
      url: appendPoolParams(process.env.DATABASE_URL, poolSize, poolTimeout),
    },
  },
});

prisma.$on('query', (event) => {
  const context = getRequestContext();
  observeDbQuery({
    method: context?.method,
    routePath: context?.path,
    target: event.target,
    durationMs: event.duration,
    query: event.query,
  });

  if (env.NODE_ENV !== 'production' || env.PRISMA_LOG_QUERIES) {
    if (event.duration < env.DB_SLOW_QUERY_MS) return;
    const requestPath = context?.path || 'unknown';
    const compactQuery = String(event.query || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    console.warn(
      `[db-slow] ${event.duration}ms route=${requestPath} target=${event.target || 'db'} query=${compactQuery}`
    );
  }
});

/** Append connection pool params to DATABASE_URL if not already present */
function appendPoolParams(url, size, timeout) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  const params = [];
  if (!url.includes('connection_limit')) params.push(`connection_limit=${size}`);
  if (!url.includes('pool_timeout'))     params.push(`pool_timeout=${timeout}`);
  return params.length ? `${url}${sep}${params.join('&')}` : url;
}

export default prisma;
