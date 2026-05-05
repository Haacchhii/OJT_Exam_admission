import prisma from '../config/db.js';
import { logAudit } from '../utils/auditLog.js';

export async function getAdmissionComments(req, res, next) {
  try {
    const admissionId = Number(req.params.admissionId);
    if (isNaN(admissionId)) return res.status(400).json({ error: 'Invalid admission id' });
    const comments = await prisma.admissionComment.findMany({ where: { admissionId }, include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: 'asc' } });
    res.json(comments);
  } catch (err) { next(err); }
}

export async function addAdmissionComment(req, res, next) {
  try {
    const admissionId = Number(req.params.admissionId);
    if (isNaN(admissionId)) return res.status(400).json({ error: 'Invalid admission id' });
    const content = typeof req.body?.content === 'string' ? req.body.content.trim().slice(0, 3000) : '';
    if (!content) return res.status(400).json({ error: 'Comment content required' });

    const comment = await prisma.admissionComment.create({ data: { admissionId, userId: req.user.id, content } , include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } });

    logAudit({ userId: req.user.id, action: 'admission_comment_added', entity: 'admission', entityId: admissionId, details: { commentId: comment.id }, ipAddress: req.ip });

    // Emit via socket to any listeners on the admission thread
    try { const io = (await import('../utils/socket.js')).getIo(); io.to(`admission_${admissionId}`).emit('admission_comment', comment); } catch (_) { }

    res.status(201).json(comment);
  } catch (err) { next(err); }
}

export async function deleteAdmissionComment(req, res, next) {
  try {
    const id = Number(req.params.commentId);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid comment id' });
    const existing = await prisma.admissionComment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Comment not found' });
    // Only author or admin/registrar can delete
    if (existing.userId !== req.user.id && !['administrator','registrar'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await prisma.admissionComment.delete({ where: { id } });
    logAudit({ userId: req.user.id, action: 'admission_comment_deleted', entity: 'admission', entityId: existing.admissionId, details: { commentId: id }, ipAddress: req.ip });
    res.status(204).end();
  } catch (err) { next(err); }
}
