/**
 * Minimal Cloudflare ambient types for type-checking the seed script under
 * plain Node (the real Worker runtime provides the full types).
 */

declare interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  run(): Promise<{ meta: { changes?: number; last_row_id?: number } }>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}

declare interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(stmts: D1PreparedStatement[]): Promise<unknown[]>;
}

declare interface R2ObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>;
  json<T>(): Promise<T>;
}

declare interface R2Bucket {
  put(key: string, value: unknown): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}
