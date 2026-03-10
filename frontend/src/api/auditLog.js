import { client, qs } from './client.js';

export const auditApi = {
  /** GET /api/audit-logs?action=&entity=&userId=&from=&to=&search=&page=&limit= */
  list: (params = {}) => client.get(`/audit-logs${qs(params)}`),
};
