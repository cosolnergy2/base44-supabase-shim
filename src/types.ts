import type { SupabaseClient } from '@supabase/supabase-js';

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface EntityMapping {
  schema: string;
  table: string;
}

export interface ClientOptions {
  /** Supabase project URL, e.g. https://api.erp.local */
  supabaseUrl: string;
  /** anon public key for browser use */
  supabaseAnonKey: string;
  /** service_role key — only set in trusted server contexts */
  supabaseServiceRoleKey?: string;
  /**
   * Postgres schema for app-specific entities.
   * E.g. 'propertyflow' / 'fms' / 'finance' / 'construction'.
   */
  schemaPrefix: string;
  /**
   * Postgres schema for shared entities (Customer, Company, User, Role...).
   * Default: 'core'.
   */
  sharedSchema?: string;
  /**
   * List of entity names that live in `sharedSchema` instead of `schemaPrefix`.
   * Default: ['Customer', 'Company', 'User', 'Role', 'Department', 'Notification', 'AuditLog'].
   */
  sharedEntities?: string[];
  /**
   * Explicit per-entity mapping overrides. Use this if the auto-derived
   * snake_case+pluralize naming doesn't match the actual table name.
   */
  entityMap?: Record<string, EntityMapping>;
  /**
   * Optional pre-built supabase client. If omitted, one is created from the keys.
   * Useful in tests / when you already have a client elsewhere.
   */
  client?: SupabaseClient;
}

export interface OrderBy {
  /** Field name. Prefix with '-' for descending (Base44 convention). */
  field: string;
  ascending?: boolean;
}

/** Where-clause filter object as used by Base44: `{ field: value, ... }` for equality, or
 * `{ field: { op: 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'ilike' | 'in' | 'neq', value: any } }`.
 */
export type FilterValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | { op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in'; value: unknown };

export type FilterObject = Record<string, FilterValue>;

export interface EntityApi<T = Record<string, unknown>> {
  list(orderBy?: string | OrderBy, limit?: number): Promise<T[]>;
  filter(where: FilterObject, orderBy?: string | OrderBy, limit?: number): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(body: Partial<T>): Promise<T>;
  update(id: string, body: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

export type EntitiesProxy = {
  [entityName: string]: EntityApi;
};
