import prisma from '../config/db.js';
import { logAudit } from '../utils/auditLog.js';

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
