import prisma from '../config/db.js';
import { logAudit } from '../utils/auditLog.js';
import { ROLES } from '../utils/constants.js';

const ALLOWED_ROLES = [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER, ROLES.APPLICANT];

export async function getNotificationPreferences(req, res, next) {
  try {
    const prefs = await prisma.notificationPreference.findMany({ where: { userId: req.user.id } });
    res.json(prefs);
  } catch (err) { next(err); }
}

export async function updateNotificationPreferences(req, res, next) {
  try {
    const updates = req.body; // expected: Array<{ eventType: string, enabled: boolean }>
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Invalid payload' });

    const results = [];
    for (const u of updates) {
      if (!u || typeof u.eventType !== 'string') continue;
      const ev = u.eventType;
      const enabled = Boolean(u.enabled);
      const existing = await prisma.notificationPreference.findUnique({ where: { userId_eventType: { userId: req.user.id, eventType: ev } } });
      if (existing) {
        const updated = await prisma.notificationPreference.update({ where: { id: existing.id }, data: { enabled } });
        results.push(updated);
      } else {
        const created = await prisma.notificationPreference.create({ data: { userId: req.user.id, eventType: ev, enabled } });
        results.push(created);
      }
    }

    logAudit({ userId: req.user.id, action: 'notification_prefs_updated', entity: 'user', entityId: req.user.id, details: { count: results.length }, ipAddress: req.ip });
    res.json({ ok: true, data: results });
  } catch (err) { next(err); }
}

export async function getRoleNotificationDefaults(req, res, next) {
  try {
    const role = req.query.role ? String(req.query.role).trim() : null;
    if (role && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role', code: 'VALIDATION_ERROR' });
    }

    const where = role ? { role } : {};
    const rows = await prisma.notificationRolePreference.findMany({
      where,
      orderBy: [{ role: 'asc' }, { eventType: 'asc' }],
    });

    res.json(rows);
  } catch (err) { next(err); }
}

export async function updateRoleNotificationDefaults(req, res, next) {
  try {
    const updates = req.body; // expected: Array<{ role: string, eventType: string, enabled: boolean }>
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' });
    }

    const results = [];
    for (const u of updates) {
      if (!u || typeof u.role !== 'string' || typeof u.eventType !== 'string') continue;
      const role = u.role.trim();
      const eventType = u.eventType.trim();
      if (!role || !eventType) continue;
      if (!ALLOWED_ROLES.includes(role)) continue;

      const enabled = Boolean(u.enabled);

      const row = await prisma.notificationRolePreference.upsert({
        where: { role_eventType: { role, eventType } },
        update: { enabled, updatedAt: new Date() },
        create: { role, eventType, enabled },
      });
      results.push(row);
    }

    logAudit({
      userId: req.user.id,
      action: 'notification_role_defaults_updated',
      entity: 'notification_role_preference',
      details: { count: results.length },
      ipAddress: req.ip,
    });

    res.json({ ok: true, data: results });
  } catch (err) { next(err); }
}
