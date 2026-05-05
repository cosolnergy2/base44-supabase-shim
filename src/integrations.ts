import type { SupabaseClient } from '@supabase/supabase-js';

export interface IntegrationsOptions {
  /** Default storage bucket for UploadFile. Falls back to schemaPrefix from createClient. */
  defaultBucket: string;
  /**
   * Edge function name to invoke for SendEmail. If unset, calls fail loudly.
   * Implement this function in supabase/volumes/functions/send-email/.
   */
  sendEmailFunction?: string;
  /**
   * Edge function name to invoke for InvokeLLM. If unset, calls fail loudly
   * (AI features are out of scope for the air-gapped self-host stack).
   */
  invokeLlmFunction?: string;
}

/**
 * Stub of `base44.integrations.Core.*`. Three methods are implemented:
 *
 *   UploadFile  → delegates to Supabase Storage upload + returns {url, path}.
 *   SendEmail   → invokes a configured edge function (or throws if none).
 *   InvokeLLM   → invokes a configured edge function (or throws if none).
 *
 * Air-gapped LAN cannot call OpenAI directly; wire your own LLM endpoint
 * (Ollama, internal API gateway, etc.) inside an edge function and pass the
 * function name via createClient({ integrations: { invokeLlmFunction: 'llm-relay' } }).
 */
export function makeIntegrations(client: SupabaseClient, opts: IntegrationsOptions) {
  const Core = {
    async UploadFile({
      file,
      bucket,
      path,
      contentType,
    }: {
      file: Blob | File | ArrayBuffer | Uint8Array;
      bucket?: string;
      path?: string;
      contentType?: string;
    }): Promise<{ url: string; path: string }> {
      const b = bucket ?? opts.defaultBucket;
      const p =
        path ??
        `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${(file as File)?.name ?? 'file'}`;
      const { error } = await client.storage.from(b).upload(p, file, {
        contentType: contentType ?? (file as File)?.type,
        upsert: false,
      });
      if (error) throw error;
      const { data } = client.storage.from(b).getPublicUrl(p);
      return { url: data.publicUrl, path: p };
    },

    async SendEmail(payload: {
      to: string | string[];
      subject: string;
      body?: string;
      html?: string;
      from?: string;
    }): Promise<{ ok: boolean }> {
      if (!opts.sendEmailFunction) {
        throw new Error(
          'SendEmail not configured. Set integrations.sendEmailFunction in createClient() ' +
            'and deploy a corresponding Supabase Edge Function (e.g. send-email).',
        );
      }
      const { error } = await client.functions.invoke(opts.sendEmailFunction, { body: payload });
      if (error) throw error;
      return { ok: true };
    },

    async InvokeLLM(payload: {
      prompt: string;
      model?: string;
      [key: string]: unknown;
    }): Promise<unknown> {
      if (!opts.invokeLlmFunction) {
        throw new Error(
          'InvokeLLM not configured. AI features are disabled in this self-host build. ' +
            'Set integrations.invokeLlmFunction in createClient() and deploy an edge function ' +
            'that proxies to your LLM endpoint (Ollama / internal gateway).',
        );
      }
      const { data, error } = await client.functions.invoke(opts.invokeLlmFunction, {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
  };

  return { Core };
}
