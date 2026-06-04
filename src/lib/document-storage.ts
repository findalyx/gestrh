import "server-only";

import {
  getObject,
  putObject,
  removePrefix,
  sanitizeFilename,
} from "./supabase-storage";

/**
 * Stockage des pièces justificatives d'agent sur Supabase.
 * Préfixe : documents/{documentId}/{filename}
 * La base ne garde que fileName/mimeType/size (cf. modèle Document).
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8 Mo

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function pathFor(documentId: string, filename: string): string {
  return `documents/${documentId}/${sanitizeFilename(filename)}`;
}

export type DocumentSaveResult =
  | { ok: true; filename: string; mimeType: string; size: number }
  | { ok: false; error: string };

export function validateDocumentFile(file: File): string | null {
  if (!file || file.size === 0) return "Fichier vide.";
  if (file.size > MAX_BYTES) {
    return `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo).`;
  }
  const mime = file.type || "application/octet-stream";
  if (!ACCEPTED_MIME.has(mime)) {
    return `Type de fichier non supporté (${mime}).`;
  }
  return null;
}

export async function saveAgentDocumentFile(args: {
  documentId: string;
  file: File;
}): Promise<DocumentSaveResult> {
  const { documentId, file } = args;
  const invalid = validateDocumentFile(file);
  if (invalid) return { ok: false, error: invalid };

  const filename = sanitizeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const put = await putObject({
    path: pathFor(documentId, filename),
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

export async function readAgentDocumentFile(args: {
  documentId: string;
  filename: string;
}): Promise<Buffer | null> {
  return getObject(pathFor(args.documentId, args.filename));
}

export async function deleteAgentDocumentFolder(
  documentId: string,
): Promise<void> {
  await removePrefix(`documents/${documentId}`);
}
