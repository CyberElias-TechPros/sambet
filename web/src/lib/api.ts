import type {
  AuditRow,
  FilterOptions,
  ImportPreview,
  ImportRecord,
  ImportResult,
  Organization,
  OrgFiltersState,
  OrgInput,
  PageMeta,
  Stats,
  TeamMember,
  User,
} from './types';

export class ApiError extends Error {
  status: number;
  fields: Record<string, string> | null;
  constructor(status: number, message: string, fields: Record<string, string> | null = null) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text.slice(0, 200) || 'Unexpected response' };
  }
  if (!res.ok) {
    throw new ApiError(res.status, json?.error ?? 'Request failed', json?.fields ?? null);
  }
  return json as T;
}

export function toQuery(f: OrgFiltersState, extra: { sort?: string; order?: string; page?: number; pageSize?: number } = {}): string {
  const q = new URLSearchParams();
  if (f.search.trim()) q.set('search', f.search.trim());
  if (f.state) q.set('state', f.state);
  if (f.category) q.set('category', f.category);
  if (f.bank) q.set('bank', f.bank);
  if (f.status) q.set('status', f.status);
  if (f.cycle) q.set('cycle', f.cycle);
  if (f.incomplete) q.set('incomplete', '1');
  if (f.duplicate) q.set('duplicate', '1');
  if (extra.sort) q.set('sort', extra.sort);
  if (extra.order) q.set('order', extra.order);
  if (extra.page) q.set('page', String(extra.page));
  if (extra.pageSize) q.set('pageSize', String(extra.pageSize));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const api = {
  // auth
  authStatus: () => request<{ initialized: boolean }>('/auth/status'),
  setup: (body: { name: string; email: string; password: string }) =>
    request<{ ok: boolean; user: User }>('/auth/setup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ ok: boolean; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/auth/me'),
  changePassword: (body: { current: string; next: string }) =>
    request<{ ok: boolean }>('/auth/password', { method: 'POST', body: JSON.stringify(body) }),

  // organizations
  listOrgs: (f: OrgFiltersState, extra: { sort?: string; order?: string; page?: number; pageSize?: number } = {}) =>
    request<{ data: Organization[]; meta: PageMeta }>(`/organizations${toQuery(f, extra)}`),
  getOrg: (id: number) => request<{ data: Organization }>(`/organizations/${id}`),
  createOrg: (body: OrgInput) => request<{ data: Organization & { id: number } }>('/organizations', { method: 'POST', body: JSON.stringify(body) }),
  updateOrg: (id: number, body: OrgInput) =>
    request<{ data: Organization; changed: string[] }>(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteOrg: (id: number) => request<{ ok: boolean }>(`/organizations/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids: number[]) => request<{ ok: boolean; deleted: number }>('/organizations/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  filterOptions: () => request<FilterOptions>('/organizations/options'),

  // imports
  previewImport: (file: File, strategy: 'update' | 'skip') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('strategy', strategy);
    return request<{ data: ImportPreview }>('/imports/preview', { method: 'POST', body: fd });
  },
  executeImport: (uploadId: string, strategy: 'update' | 'skip') =>
    request<{ data: ImportResult }>('/imports/execute', { method: 'POST', body: JSON.stringify({ uploadId, strategy }) }),
  submitImport: (uploadId: string, strategy: 'update' | 'skip') =>
    request<{ data: { importId: number; status: 'pending' } }>('/imports/submit', { method: 'POST', body: JSON.stringify({ uploadId, strategy }) }),
  approveImport: (id: number, strategy: 'update' | 'skip') =>
    request<{ data: ImportResult }>(`/imports/${id}/approve`, { method: 'POST', body: JSON.stringify({ strategy }) }),
  rejectImport: (id: number, reason: string) =>
    request<{ data: { importId: number; status: 'rejected' } }>(`/imports/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  listImports: (page = 1, pageSize = 10, status?: string) =>
    request<{ data: ImportRecord[]; meta: PageMeta }>(`/imports?page=${page}&pageSize=${pageSize}${status ? `&status=${status}` : ''}`),
  importFileUrl: (id: number) => `/api/imports/${id}/file`,

  // team (admin only)
  listUsers: () => request<{ data: TeamMember[] }>('/users'),
  createUser: (body: { name: string; email: string; password: string; role: 'admin' | 'editor' }) =>
    request<{ data: TeamMember }>('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: number, body: { role?: 'admin' | 'editor'; disabled?: boolean }) =>
    request<{ ok: boolean }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  resetUserPassword: (id: number) =>
    request<{ data: { email: string; tempPassword: string } }>(`/users/${id}/reset-password`, { method: 'POST' }),

  // stats + audit
  stats: () => request<Stats>('/stats'),
  audit: (page = 1, action?: string) =>
    request<{ data: AuditRow[]; meta: PageMeta }>(`/stats/audit?page=${page}&pageSize=25${action ? `&action=${encodeURIComponent(action)}` : ''}`),

  // downloads (return URLs for same-origin fetch-as-download)
  exportUrl: (f: OrgFiltersState, format: 'xlsx' | 'csv') => `/api/organizations/export?format=${format}${toQuery(f)}`,
  templateUrl: () => '/api/organizations/template',
};
