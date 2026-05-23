import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur, avec la SERVICE ROLE KEY qui contourne RLS.
 * À NE JAMAIS exposer côté client. Les variables sont définies dans .env :
 *   - SUPABASE_URL              (ex: https://xxxx.supabase.co)
 *   - SUPABASE_SERVICE_ROLE_KEY (clé secrète, onglet API du projet Supabase)
 */
let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env",
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** Nom unique du bucket de stockage utilisé par toute l'app. */
export const STORAGE_BUCKET = "gestrh-files";
