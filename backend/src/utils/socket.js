import { Server } from 'socket.io';
import env from '../config/env.js';
import jwt from 'jsonwebtoken';

let io;
const JWT_VERIFY_OPTIONS = { algorithms: ['HS256'] };

function createMockIo() {
  return { emit: () => {}, to: () => ({ emit: () => {} }) };
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

  io.use((socket, next) => {
    // Optional: Authenticate socket connections using JWT if needed
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error'));
    
    jwt.verify(token, env.JWT_SECRET, JWT_VERIFY_OPTIONS, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = decoded;
      next();
    });
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
