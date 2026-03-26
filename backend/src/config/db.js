import { PrismaClient } from '../../generated/prisma-client/index.js';

const logLevel = process.env.NODE_ENV === 'production'
  ? ['error', 'warn']
  : ['query', 'error', 'warn'];

const poolSize = parseInt(process.env.DATABASE_POOL_SIZE, 10) || 20;
const poolTimeout = parseInt(process.env.DATABASE_POOL_TIMEOUT, 10) || 10;

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
