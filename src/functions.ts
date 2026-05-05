import type { SupabaseClient } from '@supabase/supabase-js';

/** Mirror of base44.functions — Supabase Edge Functions invoke wrapper.
 *
 *  Returns the raw body. On HTTP error, throws an Error with the response body attached.
 */
export function makeFunctions(client: SupabaseClient) {
  return {
    /** Invoke an edge function by name, passing JSON body. Returns parsed JSON. */
    async invoke<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T> {
      const { data, error } = await client.functions.invoke<T>(name, {
        body: payload,
      });
      if (error) throw error;
      return data as T;
    },
    /** Lower-level: invoke and return Response so caller can handle non-JSON. */
    async fetch(name: string, init?: RequestInit): Promise<Response> {
      const url = `${(client as unknown as { supabaseUrl: string }).supabaseUrl}/functions/v1/${name}`;
      const headers = new Headers(init?.headers);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      headers.set('apikey', (client as unknown as { supabaseKey: string }).supabaseKey);
      return fetch(url, { ...init, headers });
    },
  };
}
