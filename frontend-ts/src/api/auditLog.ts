import { client, qs } from './client';
import type { AuditLog } from '../types';

interface AuditLogParams {
  action?: string;
  entity?: string;
  userId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditResponse {
  data: AuditLog[];
  pagination?: { totalPages: number; page: number; limit: number; total: number };
  // Some backends flatten these; support both:
  totalPages?: number;
  page?: number;
  limit?: number;
  total?: number;
}

export const auditApi = {
  list: (params: AuditLogParams = {}) =>
    client.get<PaginatedAuditResponse>(`/audit-logs${qs(params)}`),
};
