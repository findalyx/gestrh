import "server-only";

import {
  getObject,
  putObject,
  removePrefix,
  sanitizeFilename as supaSanitize,
} from "./supabase-storage";

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function sanitizeFilename(name: string): string {
  return supaSanitize(name) || "cv.pdf";
}

function pathFor(applicationId: string, filename: string): string {
  return `cvs/${applicationId}/${sanitizeFilename(filename)}`;
}

export type CvUploadResult =
  | { ok: true; filename: string; mimeType: string; size: number }
  | { ok: false; error: string };

export async function saveCvFile(args: {
  applicationId: string;
  file: File;
}): Promise<CvUploadResult> {
  const { applicationId, file } = args;
  if (!file || file.size === 0) {
    return { ok: false, error: "Fichier vide" };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} MB)`,
    };
  }
  if (file.type && !ACCEPTED_MIME_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Format non accepté (PDF, Word, PNG ou JPG uniquement)",
    };
  }

  const filename = sanitizeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const put = await putObject({
    path: pathFor(applicationId, filename),
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

export async function readCvFile(args: {
  applicationId: string;
  filename: string;
}): Promise<Buffer | null> {
  return getObject(pathFor(args.applicationId, args.filename));
}

export async function deleteCvFolder(applicationId: string): Promise<void> {
  await removePrefix(`cvs/${applicationId}`);
}
