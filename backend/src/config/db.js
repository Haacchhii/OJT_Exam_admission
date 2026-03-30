import { PrismaClient } from '../../generated/prisma-client/index.js';

const logLevel = process.env.NODE_ENV === 'production'
  ? ['error', 'warn']
  : ['query', 'error', 'warn'];

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
