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

const DEFAULT_AUDIT_PAGE = 1;
const DEFAULT_AUDIT_LIMIT = 100;

function withDefaultAuditListParams<T extends { page?: number; limit?: number }>(params?: T): T {
  return {
    ...(params || {}),
    page: params?.page ?? DEFAULT_AUDIT_PAGE,
    limit: params?.limit ?? DEFAULT_AUDIT_LIMIT,
  } as T;
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
    client.get<PaginatedAuditResponse>(`/audit-logs${qs(withDefaultAuditListParams(params))}`),
};
