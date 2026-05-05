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

export function makeAuth(client: SupabaseClient) {
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
    async getUser() {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    onAuthStateChange(cb: Parameters<SupabaseClient['auth']['onAuthStateChange']>[0]) {
      return client.auth.onAuthStateChange(cb);
    },
  };
}
