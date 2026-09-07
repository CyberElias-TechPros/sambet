import type { SambetEnv } from './lib/env';

export type Bindings = SambetEnv;

/** Run a query and return the first result or null. */
export async function one<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const stmt = db.prepare(sql);
  for (const p of params) stmt.bind(p);
  const res = await stmt.first<T | null>();
  return (res as T | null) ?? null;
}

export async function all<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const stmt = db.prepare(sql);
  for (const p of params) stmt.bind(p);
  const res = await stmt.all<T>();
  return res.results;
}

/** Escape a string for inclusion in a static SQL file (seed data). */
export function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

/** Quote a value as a SQL literal (null → NULL). */
export function sqlLiteral(value: string | number | null): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${sqlEscape(value)}'`;
}
