import { createClient as createSupabase, type SupabaseClient } from '@supabase/supabase-js';
import { makeAuth, type AuthOptions } from './auth.js';
import { makeEntitiesProxy } from './entities.js';
import { makeFunctions } from './functions.js';
import { makeIntegrations, type IntegrationsOptions } from './integrations.js';
import { app, makeAppLogs, makeUsers } from './misc.js';
import { makeStorage } from './storage.js';
import type { ClientOptions, EntitiesProxy } from './types.js';

export type * from './types.js';
export { defaultEntityToTable, resolveEntityMapping, parseOrderBy } from './entities.js';

export interface ExtendedClientOptions extends ClientOptions {
  /** Auth-related options (login redirect path, etc). */
  authOptions?: AuthOptions;
  /** Integration stub configuration (storage default bucket, edge function names). */
  integrations?: Partial<IntegrationsOptions>;
}

export interface Base44Client {
  /** Underlying Supabase client (anon key). */
  supabase: SupabaseClient;
  entities: EntitiesProxy;
  auth: ReturnType<typeof makeAuth>;
  functions: ReturnType<typeof makeFunctions>;
  storage: ReturnType<typeof makeStorage>;
  integrations: ReturnType<typeof makeIntegrations>;
  /** Per-page activity logger. Writes to core.audit_log; errors are swallowed. */
  appLogs: ReturnType<typeof makeAppLogs>;
  /** Admin user management; browser-side calls throw (use Studio instead). */
  users: ReturnType<typeof makeUsers>;
  /** Empty placeholder for base44.app property access. */
  app: Record<string, unknown>;
  /** Service-role-scoped namespace for trusted server contexts. Throws if no service key supplied. */
  asServiceRole: { entities: EntitiesProxy };
}

/** Create a Base44-compatible client backed by Supabase. */
export function createClient(options: ExtendedClientOptions): Base44Client {
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
    auth: makeAuth(supabase, options.authOptions),
    functions: makeFunctions(supabase),
    storage: makeStorage(supabase, options.schemaPrefix),
    integrations: makeIntegrations(supabase, {
      defaultBucket: options.integrations?.defaultBucket ?? options.schemaPrefix,
      sendEmailFunction: options.integrations?.sendEmailFunction,
      invokeLlmFunction: options.integrations?.invokeLlmFunction,
    }),
    appLogs: makeAppLogs(supabase, options.schemaPrefix),
    users: makeUsers(),
    app,
    asServiceRole,
  };
}
