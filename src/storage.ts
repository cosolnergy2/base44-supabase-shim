import type { SupabaseClient } from '@supabase/supabase-js';

export interface UploadFileArgs {
  /** Supabase Storage bucket name. Defaults to schemaPrefix from client options. */
  bucket?: string;
  /** Object path within the bucket (e.g. 'invoices/2026/inv-001.pdf'). */
  path: string;
  /** File contents. */
  file: Blob | File | ArrayBuffer | Uint8Array;
  /** Content-Type. Inferred from File if omitted. */
  contentType?: string;
  /** Overwrite existing object at path. Default false. */
  upsert?: boolean;
}

export function makeStorage(client: SupabaseClient, defaultBucket: string) {
  return {
    /** Upload a file to a bucket. Returns the public URL. */
    async uploadFile({
      bucket,
      path,
      file,
      contentType,
      upsert = false,
    }: UploadFileArgs): Promise<{ path: string; url: string }> {
      const b = bucket ?? defaultBucket;
      const { error } = await client.storage.from(b).upload(path, file, {
        contentType,
        upsert,
      });
      if (error) throw error;
      const { data } = client.storage.from(b).getPublicUrl(path);
      return { path, url: data.publicUrl };
    },
    /** Get a public URL for a stored object. */
    getPublicUrl(path: string, bucket?: string): string {
      const b = bucket ?? defaultBucket;
      const { data } = client.storage.from(b).getPublicUrl(path);
      return data.publicUrl;
    },
    /** Generate a time-limited signed URL for private buckets. */
    async createSignedUrl(path: string, expiresInSec = 3600, bucket?: string): Promise<string> {
      const b = bucket ?? defaultBucket;
      const { data, error } = await client.storage.from(b).createSignedUrl(path, expiresInSec);
      if (error) throw error;
      return data.signedUrl;
    },
    /** Delete one or more objects. */
    async remove(paths: string | string[], bucket?: string): Promise<void> {
      const b = bucket ?? defaultBucket;
      const list = Array.isArray(paths) ? paths : [paths];
      const { error } = await client.storage.from(b).remove(list);
      if (error) throw error;
    },
    /** List objects in a bucket prefix. */
    async list(prefix?: string, bucket?: string) {
      const b = bucket ?? defaultBucket;
      const { data, error } = await client.storage.from(b).list(prefix);
      if (error) throw error;
      return data ?? [];
    },
  };
}
