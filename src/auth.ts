import type { SupabaseClient } from '@supabase/supabase-js';

export interface SignInArgs {
  email: string;
  password: string;
}

export interface SignUpArgs {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}

export interface AuthOptions {
  /**
   * Browser path the redirectToLogin() shim should send users to.
   * Default: '/login'.
   */
  loginPath?: string;
}

export function makeAuth(client: SupabaseClient, opts: AuthOptions = {}) {
  const loginPath = opts.loginPath ?? '/login';

  return {
    async signIn({ email, password }: SignInArgs) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    async signUp({ email, password, metadata }: SignUpArgs) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: metadata ?? {} },
      });
      if (error) throw error;
      return data;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    /** Base44 alias for signOut. */
    async logout() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    async getUser() {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    /** Base44 alias for getUser. Returns the current user object or throws if not signed in. */
    async me() {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      if (!data.user) throw new Error('Not authenticated');
      return data.user;
    },
    /**
     * Base44 alias for updating the current user's metadata. Accepts arbitrary
     * key/value pairs that get stored in `user_metadata`.
     */
    async updateMe(metadata: Record<string, unknown>) {
      const { data, error } = await client.auth.updateUser({ data: metadata });
      if (error) throw error;
      return data.user;
    },
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    /**
     * Base44 used to redirect SPA users to its hosted login page. Self-host
     * has no hosted login, so this just navigates to the configured local
     * loginPath. Override the path via createClient({ ..., authLoginPath: '/x' }).
     */
    redirectToLogin(returnUrl?: string) {
      if (typeof window === 'undefined') return;
      // Already on the login route → no-op. Prevents redirect loops when an
      // unauthenticated check on /login itself fires another redirectToLogin.
      if (window.location.pathname === loginPath) return;
      // Defensive: if the returnUrl already points back to a login page (cyclic
      // chain from old buggy state), drop it. Also drop if it's absurdly long.
      let safeReturn: string | undefined = returnUrl;
      if (safeReturn) {
        const looksCyclic = safeReturn.includes(`${loginPath}?next=`) || safeReturn.includes(`${loginPath}%3F`);
        if (looksCyclic || safeReturn.length > 1024) safeReturn = undefined;
      }
      const url = safeReturn
        ? `${loginPath}?next=${encodeURIComponent(safeReturn)}`
        : loginPath;
      window.location.assign(url);
    },
    onAuthStateChange(cb: Parameters<SupabaseClient['auth']['onAuthStateChange']>[0]) {
      return client.auth.onAuthStateChange(cb);
    },
  };
}
