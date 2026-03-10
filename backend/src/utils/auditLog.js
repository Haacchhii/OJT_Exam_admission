import prisma from '../config/db.js';

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
  prisma.auditLog.create({
    data: {
      userId:    userId ?? null,
      action,
      entity,
      entityId:  entityId ?? null,
      details:   details ? JSON.stringify(details) : null,
      ipAddress: ipAddress ?? null,
    },
  }).catch(() => {
    // Audit logging must never crash the request
  });
}
