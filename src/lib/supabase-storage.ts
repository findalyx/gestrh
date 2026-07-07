import "server-only";

import { STORAGE_BUCKET, getSupabaseAdmin } from "./supabase";

/**
 * Helpers de bas niveau pour Supabase Storage.
 * Utilise un unique bucket "gestrh-files" avec des préfixes :
 *   - contracts/{contractId}/{filename}
 *   - cvs/{applicationId}/{filename}
 *   - announcements/{announcementId}/{filename}
 *   - branding/{filename}
 *
 * Bucket privé : aucun fichier accessible publiquement. La lecture se fait
 * uniquement via les routes API authentifiées (proxy serveur).
 */

export function sanitizeFilename(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80) || "fichier"
  );
}

// ============================================================
//  UPLOAD : Buffer → Supabase Storage
// ============================================================
export type StoragePutResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export async function putObject(args: {
  path: string;
  buffer: Buffer;
  contentType: string;
  upsert?: boolean;
}): Promise<StoragePutResult> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(args.path, args.buffer, {
      contentType: args.contentType,
      upsert: args.upsert ?? false,
    });
  if (error) {
    console.error("[supabase-storage] putObject error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, path: data.path };
}

// ============================================================
//  DOWNLOAD : Supabase Storage → Buffer
// ============================================================
export async function getObject(path: string): Promise<Buffer | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .download(path);
  if (error) {
    // Erreur attendue si le fichier n'existe pas — on log à un niveau bas
    if (error.message?.includes("Object not found")) return null;
    console.error("[supabase-storage] getObject error:", error);
    return null;
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================================
//  SUPPRESSION : un fichier ou un préfixe entier
// ============================================================
export async function removeObject(path: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) {
    // Silencieux si fichier déjà absent
    if (!error.message?.includes("Object not found")) {
      console.error("[supabase-storage] removeObject error:", error);
    }
  }
}

/**
 * Supprime tous les objets sous un préfixe (ex: tous les fichiers d'un contrat).
 * Supabase Storage n'a pas de "rm -rf" → on liste puis on supprime en batch.
 */
export async function removePrefix(prefix: string): Promise<void> {
  const sb = getSupabaseAdmin();
  // Liste les fichiers sous le préfixe
  const cleanPrefix = prefix.replace(/\/$/, "");
  const { data: files, error: listErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .list(cleanPrefix);
  if (listErr) {
    console.error("[supabase-storage] list error for prefix", prefix, listErr);
    return;
  }
  if (!files || files.length === 0) return;

  const paths = files
    .filter((f) => f.name && !f.id?.endsWith("/")) // on ignore les pseudo-dossiers
    .map((f) => `${cleanPrefix}/${f.name}`);
  if (paths.length === 0) return;

  const { error: rmErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .remove(paths);
  if (rmErr) {
    console.error("[supabase-storage] removePrefix error:", rmErr);
  }
}

/**
 * Génère une URL signée que le navigateur peut utiliser pour PUT un fichier
 * directement dans Supabase Storage, sans repasser par Vercel.
 * Utile pour contourner la limite de 4.5 Mo des Server Actions Vercel.
 * La signature expire par défaut au bout de 2 heures.
 */
export type SignedUploadUrl =
  | { ok: true; signedUrl: string; token: string; path: string }
  | { ok: false; error: string };

export async function createSignedUploadUrl(
  path: string,
): Promise<SignedUploadUrl> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path);
  if (error) {
    console.error("[supabase-storage] createSignedUploadUrl error:", error);
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

/**
 * Liste tous les fichiers sous un préfixe (renvoie juste les noms).
 */
export async function listPrefix(prefix: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const cleanPrefix = prefix.replace(/\/$/, "");
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .list(cleanPrefix);
  if (error || !data) return [];
  return data.filter((f) => f.name).map((f) => f.name);
}
