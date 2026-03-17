import { Server } from 'socket.io';
import env from '../config/env.js';
import jwt from 'jsonwebtoken';

let io;

export function initIo(server) {
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
    
    jwt.verify(token, env.JWT_SECRET, (err, decoded) => {
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
    return { emit: () => {}, to: () => ({ emit: () => {} }) };
  }
  return io;
}
