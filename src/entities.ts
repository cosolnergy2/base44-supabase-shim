import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClientOptions,
  EntitiesProxy,
  EntityApi,
  EntityMapping,
  FilterObject,
  FilterValue,
  OrderBy,
} from './types.js';

const DEFAULT_SHARED_ENTITIES = [
  'Customer',
  'Company',
  'User',
  'Role',
  'Department',
  'Notification',
  'AuditLog',
];

/** PascalCase → snake_case + naive pluralization (s, ies, es). */
export function defaultEntityToTable(entityName: string): string {
  const snake = entityName.replace(/([A-Z])/g, (m, c, i) =>
    i === 0 ? c.toLowerCase() : '_' + c.toLowerCase(),
  );
  if (snake.endsWith('y') && !/[aeiou]y$/.test(snake)) return snake.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/.test(snake)) return snake + 'es';
  return snake + 's';
}

export function resolveEntityMapping(
  entityName: string,
  opts: Required<Pick<ClientOptions, 'schemaPrefix'>> &
    Pick<ClientOptions, 'sharedSchema' | 'sharedEntities' | 'entityMap'>,
): EntityMapping {
  if (opts.entityMap?.[entityName]) return opts.entityMap[entityName];
  const sharedEntities = opts.sharedEntities ?? DEFAULT_SHARED_ENTITIES;
  const sharedSchema = opts.sharedSchema ?? 'core';
  const schema = sharedEntities.includes(entityName) ? sharedSchema : opts.schemaPrefix;
  return { schema, table: defaultEntityToTable(entityName) };
}

/**
 * Parse Base44-style orderBy:
 *   - string '-created_date' → { field: 'created_date', ascending: false }
 *   - string 'name' → { field: 'name', ascending: true }
 *   - object passes through.
 */
export function parseOrderBy(input: string | OrderBy | undefined): OrderBy | undefined {
  if (!input) return undefined;
  if (typeof input === 'object') return input;
  if (input.startsWith('-')) return { field: input.slice(1), ascending: false };
  return { field: input, ascending: true };
}

function applyFilter(query: any, where: FilterObject): any {
  for (const [field, raw] of Object.entries(where)) {
    const v = raw as FilterValue;
    if (v === null) {
      query = query.is(field, null);
    } else if (typeof v === 'object' && !Array.isArray(v) && 'op' in v) {
      const { op, value } = v;
      switch (op) {
        case 'eq':
          query = query.eq(field, value);
          break;
        case 'neq':
          query = query.neq(field, value);
          break;
        case 'gt':
          query = query.gt(field, value);
          break;
        case 'gte':
          query = query.gte(field, value);
          break;
        case 'lt':
          query = query.lt(field, value);
          break;
        case 'lte':
          query = query.lte(field, value);
          break;
        case 'like':
          query = query.like(field, value as string);
          break;
        case 'ilike':
          query = query.ilike(field, value as string);
          break;
        case 'in':
          query = query.in(field, value as unknown[]);
          break;
      }
    } else if (Array.isArray(v)) {
      query = query.in(field, v);
    } else {
      query = query.eq(field, v);
    }
  }
  return query;
}

export function makeEntityApi(client: SupabaseClient, mapping: EntityMapping): EntityApi {
  const from = () => client.schema(mapping.schema as never).from(mapping.table);

  return {
    async list(orderBy, limit) {
      let q = from().select('*');
      const ob = parseOrderBy(orderBy);
      if (ob) q = q.order(ob.field, { ascending: ob.ascending ?? true });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    async filter(where, orderBy, limit) {
      let q = from().select('*');
      q = applyFilter(q, where);
      const ob = parseOrderBy(orderBy);
      if (ob) q = q.order(ob.field, { ascending: ob.ascending ?? true });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    async get(id) {
      const { data, error } = await from().select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    async create(body) {
      const { data, error } = await from().insert(body).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, body) {
      const { data, error } = await from().update(body).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await from().delete().eq('id', id);
      if (error) throw error;
    },
  };
}

export function makeEntitiesProxy(
  client: SupabaseClient,
  opts: Required<Pick<ClientOptions, 'schemaPrefix'>> &
    Pick<ClientOptions, 'sharedSchema' | 'sharedEntities' | 'entityMap'>,
): EntitiesProxy {
  const cache: Record<string, EntityApi> = {};
  return new Proxy({} as EntitiesProxy, {
    get(_target, prop: string) {
      if (typeof prop !== 'string') return undefined;
      if (!cache[prop]) {
        const mapping = resolveEntityMapping(prop, opts);
        cache[prop] = makeEntityApi(client, mapping);
      }
      return cache[prop];
    },
  });
}
