import "server-only";

import {
  getObject,
  putObject,
  removePrefix,
  sanitizeFilename,
} from "./supabase-storage";

/**
 * Stockage des documents mensuels de prestation (bon de commande / facture /
 * attestation de service fait signée). Un document par (prestataire, période).
 * Chemin Supabase : prestations/{agentId}/{period}-{filename}
 */

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo (scan signé parfois lourd)

function pathFor(agentId: string, period: string, filename: string): string {
  return `prestations/${agentId}/${period}-${sanitizeFilename(filename)}`;
}

export type PrestationDocResult =
  | { ok: true; filename: string; path: string; size: number }
  | { ok: false; error: string };

export async function savePrestationDocument(args: {
  agentId: string;
  period: string;
  file: File;
}): Promise<PrestationDocResult> {
  const { agentId, period, file } = args;
  if (!file || file.size === 0) {
    return { ok: false, error: "Fichier vide" };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo)`,
    };
  }
  if (file.type && !ACCEPTED_MIME.has(file.type)) {
    return {
      ok: false,
      error: "Format non accepté (PDF, PNG, JPG ou WebP)",
    };
  }

  const filename = sanitizeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const path = pathFor(agentId, period, filename);
  const put = await putObject({
    path,
    buffer,
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (!put.ok) return { ok: false, error: put.error };

  return { ok: true, filename, path, size: file.size };
}

/** Variante pour une note d'honoraires générée (déjà un Buffer, pas de File). */
export async function savePrestationBuffer(args: {
  agentId: string;
  period: string;
  filename: string;
  buffer: Buffer;
}): Promise<PrestationDocResult> {
  const filename = sanitizeFilename(args.filename);
  const path = pathFor(args.agentId, args.period, filename);
  const put = await putObject({
    path,
    buffer: args.buffer,
    contentType: "application/pdf",
    upsert: true,
  });
  if (!put.ok) return { ok: false, error: put.error };
  return { ok: true, filename, path, size: args.buffer.length };
}

export async function readPrestationDocument(
  path: string,
): Promise<Buffer | null> {
  return getObject(path);
}

/** Supprime tous les documents de prestation d'un agent (à sa suppression). */
export async function deletePrestationFolder(agentId: string): Promise<void> {
  await removePrefix(`prestations/${agentId}`);
}
