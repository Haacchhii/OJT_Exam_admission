import app from './app.js';
import env from './config/env.js';
import prisma from './config/db.js';
import { initIo } from './utils/socket.js';

const server = app.listen(env.PORT, () => {
  console.log(`Golden Key API running on port ${env.PORT} [${env.NODE_ENV}]`);
  console.log(`[cors] allowed origins from env: ${env.CORS_ORIGIN}`);
});

// Initialize Socket.io only on non-serverless environments
// Vercel serverless doesn't support persistent connections (no cold start optimization)
if (!process.env.VERCEL) {
  initIo(server);
} else {
  console.log('[Socket.io] Disabled in Vercel serverless environment');
}

// --- Graceful shutdown ----------------------------------------------
async function shutdown(signal) {
  console.log(`\n${signal} received - shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Database disconnected. Goodbye.');
    process.exit(0);
  });
  // Force exit after 10 s if connections aren't freed
  setTimeout(() => { process.exit(1); }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Catch unhandled errors so the process doesn't crash silently
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
