import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { cached } from '../utils/cache.js';

// GET /api/audit-logs?action=&entity=&userId=&from=&to=&page=&limit=
export async function getAuditLogs(req, res, next) {
  try {
    const { action, entity, entityId, userId, from, to, search, page, limit } = req.query;
    const pg = paginate(page ?? 1, limit ?? 100);

    const where = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entity) where.entity = entity;
    if (entityId) where.entityId = Number(entityId);
    if (userId) where.userId = Number(userId);

    if (from || to) {
      where.createdAt = {};
      if (from) { const d = new Date(from); if (!isNaN(d.getTime())) where.createdAt.gte = d; }
      if (to)   { const d = new Date(to);   if (!isNaN(d.getTime())) where.createdAt.lte = d; }
    }

    if (search) {
      where.OR = [
        { action:  { contains: search, mode: 'insensitive' } },
        { entity:  { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
      ];
    }

    const cacheKey = `audit:logs:${JSON.stringify({
      action: action || null,
      entity: entity || null,
      entityId: entityId ? Number(entityId) : null,
      userId: userId ? Number(userId) : null,
      from: from || null,
      to: to || null,
      search: search || null,
      page: pg?.page || 1,
      limit: pg?.limit || null,
    })}`;

    const { logs, total } = await cached(cacheKey, async () => {
      const [rows, count] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          ...(pg && { skip: pg.skip, take: pg.take }),
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true, role: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);
      return { logs: rows, total: count };
    }, 30_000);

    // Parse JSON details for each log
    const shaped = logs.map(log => ({
      ...log,
      details: log.details ? (() => { try { return JSON.parse(log.details); } catch { return log.details; } })() : null,
    }));

    res.json(paginatedResponse(shaped, total, pg));
  } catch (err) { next(err); }
}
