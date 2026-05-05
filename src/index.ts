import { createClient as createSupabase, type SupabaseClient } from '@supabase/supabase-js';
import { makeAuth } from './auth.js';
import { makeEntitiesProxy } from './entities.js';
import { makeFunctions } from './functions.js';
import { makeStorage } from './storage.js';
import type { ClientOptions, EntitiesProxy } from './types.js';

export type * from './types.js';
export { defaultEntityToTable, resolveEntityMapping, parseOrderBy } from './entities.js';

export interface Base44Client {
  /** Underlying Supabase client (anon key). */
  supabase: SupabaseClient;
  entities: EntitiesProxy;
  auth: ReturnType<typeof makeAuth>;
  functions: ReturnType<typeof makeFunctions>;
  storage: ReturnType<typeof makeStorage>;
  /** Service-role-scoped namespace for trusted server contexts. Throws if no service key supplied. */
  asServiceRole: { entities: EntitiesProxy };
}

/** Create a Base44-compatible client backed by Supabase. */
export function createClient(options: ClientOptions): Base44Client {
  if (!options.supabaseUrl) throw new Error('createClient: supabaseUrl is required');
  if (!options.supabaseAnonKey) throw new Error('createClient: supabaseAnonKey is required');
  if (!options.schemaPrefix) throw new Error('createClient: schemaPrefix is required');

  const supabase =
    options.client ?? createSupabase(options.supabaseUrl, options.supabaseAnonKey);

  const entities = makeEntitiesProxy(supabase, {
    schemaPrefix: options.schemaPrefix,
    sharedSchema: options.sharedSchema,
    sharedEntities: options.sharedEntities,
    entityMap: options.entityMap,
  });

  const asServiceRole = (() => {
    let serviceClient: SupabaseClient | null = null;
    let serviceEntities: EntitiesProxy | null = null;
    return {
      get entities(): EntitiesProxy {
        if (!options.supabaseServiceRoleKey) {
          throw new Error(
            'asServiceRole.entities accessed but supabaseServiceRoleKey was not provided. ' +
              'Only set this in trusted server contexts (edge functions, scripts).',
          );
        }
        if (!serviceClient) {
          serviceClient = createSupabase(options.supabaseUrl, options.supabaseServiceRoleKey);
        }
        if (!serviceEntities) {
          serviceEntities = makeEntitiesProxy(serviceClient, {
            schemaPrefix: options.schemaPrefix,
            sharedSchema: options.sharedSchema,
            sharedEntities: options.sharedEntities,
            entityMap: options.entityMap,
          });
        }
        return serviceEntities;
      },
    };
  })();

  return {
    supabase,
    entities,
    auth: makeAuth(supabase),
    functions: makeFunctions(supabase),
    storage: makeStorage(supabase, options.schemaPrefix),
    asServiceRole,
  };
}
