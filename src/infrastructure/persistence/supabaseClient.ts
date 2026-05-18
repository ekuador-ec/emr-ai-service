import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  /**
   * Modern Supabase secret key (sb_secret_xxx). It bypasses RLS so it must
   * remain server-side and is the equivalent of the legacy service_role key.
   * Accepts the legacy service_role JWT as well to remain backwards compatible.
   */
  secretKey: string;
}

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: { schema: "public" }
  });
}
