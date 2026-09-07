export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface Organization {
  id: number;
  sn: number | null;
  name: string;
  ceo_name: string | null;
  phone: string | null;
  email: string | null;
  bank: string | null;
  bank_norm: string | null;
  account_number: string | null;
  lga: string | null;
  state: string | null;
  state_norm: string | null;
  project_type: string | null;
  project_category: string;
  status: string;
  notes: string | null;
  cycle: string;
  source: string;
  source_import_id: number | null;
  created_at: string;
  updated_at: string;
  is_duplicate: boolean;
  missing: string[];
  duplicates?: Organization[];
}

export interface OrgFiltersState {
  search: string;
  state: string;
  category: string;
  bank: string;
  status: string;
  cycle: string;
  incomplete: boolean;
  duplicate: boolean;
}

export interface OrgInput {
  sn?: number | null;
  name: string;
  ceo_name?: string | null;
  phone?: string | null;
  email?: string | null;
  bank?: string | null;
  account_number?: string | null;
  lga?: string | null;
  state?: string | null;
  project_type?: string | null;
  status?: string;
  notes?: string | null;
  cycle?: string;
}

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface FilterOptions {
  states: string[];
  categories: string[];
  banks: string[];
  cycles: string[];
  statuses: string[];
}

export interface Stats {
  total: number;
  complete: number;
  incomplete: number;
  duplicates: number;
  statesCovered: number;
  lgasCovered: number;
  byState: { state: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  missing: { field: string; count: number }[];
  recent: {
    id: number;
    name: string;
    sn: number | null;
    state_norm: string | null;
    project_category: string;
    status: string;
    created_at: string;
    updated_at: string;
  }[];
  recentImports: {
    id: number;
    filename: string;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    error_count: number;
    actor_email: string | null;
    created_at: string;
  }[];
}

export interface ImportPreview {
  uploadId: string;
  filename: string;
  total: number;
  create: number;
  update: number;
  skip: number;
  errors: { excelRow: number; reason: string }[];
  errorTotal: number;
  warnings: { excelRow: number; message: string }[];
  warningTotal: number;
  headers: string[];
  unmappedHeaders: string[];
}

export interface ImportResult {
  importId: number;
  filename: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface ImportRecord {
  id: number;
  filename: string;
  r2_key: string | null;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  status: string;
  report: unknown;
  actor_email: string | null;
  created_at: string;
}

export interface AuditRow {
  id: number;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | string | null;
  ip: string | null;
  created_at: string;
}
