import { PrismaClient } from '@prisma/client';

const logLevel = process.env.NODE_ENV === 'production'
  ? ['error', 'warn']
  : ['query', 'error', 'warn'];

const prisma = new PrismaClient({ log: logLevel });

export default prisma;
