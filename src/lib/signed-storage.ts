import "server-only";

import {
  getObject,
  putObject,
  removePrefix,
  sanitizeFilename,
} from "./supabase-storage";

/**
 * Helper générique pour les fichiers « signés » attachés à une entité
 * (avenant, démission, contrat). Un seul fichier par préfixe : on nettoie
 * avant chaque dépôt. Les octets vivent sur Supabase ; la base ne stocke
 * que le nom/mime/taille sur l'entité.
 *
 * Préfixes utilisés :
 *   - amendments/{id}/signed
 *   - resignations/{id}/signed
 *   - contracts/{id}/signed
 */

const MAX_BYTES = 12 * 1024 * 1024; // 12 Mo
const ACCEPTED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

export function validateSignedFile(file: File): string | null {
  if (!file || file.size === 0) return "Aucun fichier sélectionné.";
  if (file.size > MAX_BYTES) {
    return `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo).`;
  }
  const mime = file.type || "application/octet-stream";
  if (!ACCEPTED_MIME.has(mime)) {
    return `Format non supporté : ${mime} (PDF, JPG ou PNG).`;
  }
  return null;
}

export type SignedSaveResult =
  | { ok: true; filename: string; mimeType: string; size: number }
  | { ok: false; error: string };

export async function saveSignedFile(
  prefix: string,
  file: File,
): Promise<SignedSaveResult> {
  const invalid = validateSignedFile(file);
  if (invalid) return { ok: false, error: invalid };

  // Un seul fichier signé par entité → on purge l'ancien d'abord.
  await removePrefix(prefix);

  const filename = sanitizeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const put = await putObject({
    path: `${prefix}/${filename}`,
    buffer,
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (!put.ok) return { ok: false, error: put.error };

  return {
    ok: true,
    filename,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function readSignedFile(
  prefix: string,
  filename: string,
): Promise<Buffer | null> {
  return getObject(`${prefix}/${sanitizeFilename(filename)}`);
}

export async function deleteSignedPrefix(prefix: string): Promise<void> {
  await removePrefix(prefix);
}
