/**
 * Server-Sent Events (SSE) manager.
 *
 * Maintains a map of userId → Set<Response> so the server can push
 * real-time events (notifications, status changes) to connected clients
 * without polling.
 */

/** @type {Map<number, Set<import('express').Response>>} */
const clients = new Map();

/** How often to send a keep-alive comment (prevents proxy timeouts). */
const HEARTBEAT_MS = 30_000;

/**
 * Register an SSE connection for a user.
 * Sets the appropriate headers, sends an initial `:ok` comment, and
 * starts a heartbeat interval.
 */
export function addClient(userId, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering
  });
  res.write(':ok\n\n');

  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);

  // Heartbeat to keep the connection alive through load balancers
  const hb = setInterval(() => res.write(':heartbeat\n\n'), HEARTBEAT_MS);

  res.on('close', () => {
    clearInterval(hb);
    const set = clients.get(userId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.delete(userId);
    }
  });
}

/**
 * Push an SSE event to all connections for a given user.
 * @param {number} userId
 * @param {string} event   Event name (e.g. "notification", "admission-update")
 * @param {object} data    JSON-serialisable payload
 */
export function sendEvent(userId, event, data) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    res.write(msg);
  }
}

/**
 * Push an event to ALL connected clients (e.g. system-wide announcements).
 */
export function broadcastEvent(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const set of clients.values()) {
    for (const res of set) {
      res.write(msg);
    }
  }
}

/** Number of currently connected SSE clients. */
export function clientCount() {
  let n = 0;
  for (const set of clients.values()) n += set.size;
  return n;
}
