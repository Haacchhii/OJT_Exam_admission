import prisma from '../config/db.js';

const QUEUE_MAX = 2000;
const FLUSH_BATCH_SIZE = 25;

const queue = [];
let flushing = false;

function toAuditRow({ userId, action, entity, entityId, details, ipAddress }) {
  return {
    userId: userId ?? null,
    action,
    entity,
    entityId: entityId ?? null,
    details: details ? JSON.stringify(details) : null,
    ipAddress: ipAddress ?? null,
  };
}

function scheduleFlush() {
  if (flushing) return;
  flushing = true;
  setImmediate(flushQueue);
}

async function flushQueue() {
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, FLUSH_BATCH_SIZE);
      await prisma.auditLog.createMany({ data: batch });
    }
  } catch {
    // Never throw from async audit logging.
  } finally {
    flushing = false;
    if (queue.length > 0) scheduleFlush();
  }
}

/**
 * Log an action to the audit trail (fire-and-forget).
 * @param {object} opts
 * @param {number} [opts.userId]    – ID of the user who performed the action
 * @param {string}  opts.action     – e.g. "admission.status_update"
 * @param {string}  opts.entity     – e.g. "admission"
 * @param {number} [opts.entityId]  – PK of the affected row
 * @param {object} [opts.details]   – any extra context (will be JSON-stringified)
 * @param {string} [opts.ipAddress] – request IP
 */
export function logAudit({ userId, action, entity, entityId, details, ipAddress }) {
  if (queue.length >= QUEUE_MAX) {
    queue.shift();
  }
  queue.push(toAuditRow({ userId, action, entity, entityId, details, ipAddress }));
  scheduleFlush();
}
