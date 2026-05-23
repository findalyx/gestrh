import "server-only";

import {
  getObject,
  putObject,
  removePrefix,
  sanitizeFilename,
} from "./supabase-storage";

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (contrat scanné parfois lourd)

function pathFor(contractId: string, filename: string): string {
  return `contracts/${contractId}/${sanitizeFilename(filename)}`;
}

export type ContractPdfResult =
  | { ok: true; filename: string; mimeType: string; size: number }
  | { ok: false; error: string };

export async function saveContractPdf(args: {
  contractId: string;
  file: File;
}): Promise<ContractPdfResult> {
  const { contractId, file } = args;
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
      error: "Format non accepté (PDF, PNG ou JPG uniquement)",
    };
  }

  // Un seul PDF par contrat → on nettoie l'ancien dossier d'abord.
  await deleteContractFolder(contractId);

  const filename = sanitizeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const put = await putObject({
    path: pathFor(contractId, filename),
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

/**
 * Variante directe pour les PDF auto-générés par `generateContractPdf`
 * (déjà un Buffer en mémoire, pas de File).
 */
export async function saveContractPdfBuffer(args: {
  contractId: string;
  filename: string;
  buffer: Buffer;
}): Promise<ContractPdfResult> {
  const filename = sanitizeFilename(args.filename);
  await deleteContractFolder(args.contractId);
  const put = await putObject({
    path: pathFor(args.contractId, filename),
    buffer: args.buffer,
    contentType: "application/pdf",
    upsert: true,
  });
  if (!put.ok) return { ok: false, error: put.error };
  return {
    ok: true,
    filename,
    mimeType: "application/pdf",
    size: args.buffer.length,
  };
}

export async function readContractPdf(args: {
  contractId: string;
  filename: string;
}): Promise<Buffer | null> {
  return getObject(pathFor(args.contractId, args.filename));
}

export async function deleteContractFolder(contractId: string): Promise<void> {
  await removePrefix(`contracts/${contractId}`);
}
