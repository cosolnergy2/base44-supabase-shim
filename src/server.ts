import { createClient as createSupabase, type SupabaseClient } from '@supabase/supabase-js';
import { makeEntitiesProxy } from './entities.js';
import type { ClientOptions, EntitiesProxy } from './types.js';

export type * from './types.js';

export interface ServerClient {
  supabase: SupabaseClient;
  entities: EntitiesProxy;
  asServiceRole: { entities: EntitiesProxy };
}

/**
 * Create a Base44-style client from an incoming HTTP Request, intended for
 * Supabase Edge Functions (Deno) or any server runtime that has fetch Request.
 *
 * Honors the caller's Authorization header so RLS applies as the end user.
 * `asServiceRole` uses the configured service_role key (bypasses RLS) for
 * privileged operations — analogous to base44.asServiceRole.
 */
export function createClientFromRequest(
  req: Request,
  options: Omit<ClientOptions, 'client'> & { supabaseServiceRoleKey: string },
): ServerClient {
  if (!options.supabaseUrl) throw new Error('createClientFromRequest: supabaseUrl is required');
  if (!options.supabaseAnonKey)
    throw new Error('createClientFromRequest: supabaseAnonKey is required');
  if (!options.supabaseServiceRoleKey)
    throw new Error('createClientFromRequest: supabaseServiceRoleKey is required for server use');

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createSupabase(options.supabaseUrl, options.supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createSupabase(options.supabaseUrl, options.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const mappingOpts = {
    schemaPrefix: options.schemaPrefix,
    sharedSchema: options.sharedSchema,
    sharedEntities: options.sharedEntities,
    entityMap: options.entityMap,
  };

  return {
    supabase: userClient,
    entities: makeEntitiesProxy(userClient, mappingOpts),
    asServiceRole: {
      entities: makeEntitiesProxy(serviceClient, mappingOpts),
    },
  };
}
