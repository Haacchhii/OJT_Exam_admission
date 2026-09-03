import { Server } from 'socket.io';
import env from '../config/env.js';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

let io;
const JWT_VERIFY_OPTIONS = { algorithms: ['HS256'] };

function createMockIo() {
  return { emit: () => {}, to: () => ({ emit: () => {} }) };
}

export async function authenticateSocketToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, JWT_VERIFY_OPTIONS);
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) throw new Error('invalid subject');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        emailVerified: true,
        mustChangePassword: true,
        tokenVersion: true,
        deletedAt: true,
      },
    });

    const invalidAccount = !user
      || user.deletedAt
      || user.status !== 'Active'
      || user.mustChangePassword
      || (env.EMAIL_VERIFICATION_REQUIRED && !user.emailVerified)
      || user.tokenVersion !== payload.tokenVersion;
    if (invalidAccount) throw new Error('invalid account');

    return user;
  } catch {
    throw new Error('Authentication error');
  }
}

export function initIo(server) {
  if (process.env.VERCEL) {
    console.warn('[Socket.io] Disabled in serverless runtime');
    io = createMockIo();
    return io;
  }

  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN.split(',').map(o => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      socket.user = await authenticateSocketToken(token);
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    // Users can join rooms based on their roles or specific IDs
    if (socket.user) {
      socket.join(`user_${socket.user.id}`);
      socket.join(`role_${socket.user.role}`);
    }

    socket.on('disconnect', () => {
      // Cleanup if necessary
    });
  });

  return io;
}

export function getIo() {
  if (!io) {
    console.error('Socket.io is not initialized. Using a mock to prevent crashes.');
    return createMockIo();
  }
  return io;
}
