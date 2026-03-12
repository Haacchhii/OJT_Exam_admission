import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { sendEvent } from '../utils/sse.js';
import { ROLES } from '../utils/constants.js';

// GET /api/notifications/:userId?page=&limit=
export async function getNotifications(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    // Ownership check: users can only access their own notifications (admins can access any)
    if (req.user.role !== ROLES.ADMIN && req.user.id !== userId) {
      return res.status(403).json({ error: 'You can only access your own notifications', code: 'FORBIDDEN' });
    }
    const { page, limit } = req.query;
    const pg = paginate(page, limit);

    const where = { userId };
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({ where, ...(pg && { skip: pg.skip, take: pg.take }), orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
    ]);

    res.json(paginatedResponse(notifications, total, pg));
  } catch (err) { next(err); }
}

// GET /api/notifications/:userId/unread-count
export async function getUnreadCount(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (req.user.role !== ROLES.ADMIN && req.user.id !== userId) {
      return res.status(403).json({ error: 'You can only access your own notifications', code: 'FORBIDDEN' });
    }
    const count = await prisma.notification.count({ where: { userId, isRead: false } });
    res.json({ count });
  } catch (err) { next(err); }
}

// PATCH /api/notifications/:id/read
export async function markRead(req, res, next) {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: Number(req.params.id) } });
    if (!notification) return res.status(404).json({ error: 'Notification not found', code: 'NOT_FOUND' });
    if (req.user.role !== ROLES.ADMIN && req.user.id !== notification.userId) {
      return res.status(403).json({ error: 'You can only modify your own notifications', code: 'FORBIDDEN' });
    }
    await prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true },
    });
    res.status(204).end();
  } catch (err) { next(err); }
}

// PATCH /api/notifications/:userId/read-all
export async function markAllRead(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (req.user.role !== ROLES.ADMIN && req.user.id !== userId) {
      return res.status(403).json({ error: 'You can only modify your own notifications', code: 'FORBIDDEN' });
    }
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    res.status(204).end();
  } catch (err) { next(err); }
}

// POST /api/notifications
export async function createNotification(req, res, next) {
  try {
    const { userId, title, message, type } = req.body;
    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'userId, title, and message are required', code: 'VALIDATION_ERROR' });
    }

    const notification = await prisma.notification.create({
      data: { userId, title, message, type: type || 'info' },
    });

    // Push real-time event to connected SSE clients
    sendEvent(userId, 'notification', notification);

    res.status(201).json(notification);
  } catch (err) { next(err); }
}
