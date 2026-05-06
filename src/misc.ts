import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Stub for `base44.appLogs` — Base44 cloud's per-page activity tracker.
 * Writes a row to core.audit_log if the table exists, otherwise silently
 * succeeds. App code wraps this in .catch(() => {}) anyway, so any failure
 * is non-fatal.
 */
export function makeAppLogs(client: SupabaseClient, app: string) {
  return {
    async logUserInApp(pageName: string): Promise<void> {
      try {
        await client.schema('core' as never).from('audit_log').insert({
          app,
          action: 'page_view',
          module: pageName,
        });
      } catch {
        // best-effort; analytics errors must never break the app
      }
    },
  };
}

/**
 * Stub for `base44.users` — admin-only user management. Self-host equivalent
 * uses Supabase Auth admin API but requires a service_role key, which the
 * browser client doesn't have. So inviteUser here logs a warning and returns
 * a benign error so callers can show a "not supported" message.
 */
export function makeUsers() {
  return {
    async inviteUser(_args: { email: string; [key: string]: unknown }): Promise<never> {
      throw new Error(
        'inviteUser is admin-only and not exposed to the browser shim. ' +
          'Use the Studio dashboard or an edge function with service_role to invite users.',
      );
    },
  };
}

/** Empty placeholder for `base44.app` — kept defined so property access doesn't crash. */
export const app: Record<string, unknown> = {};
