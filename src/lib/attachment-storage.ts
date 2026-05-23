import "server-only";

import {
  getObject,
  listPrefix,
  putObject,
  removeObject,
  removePrefix,
  sanitizeFilename as supaSanitize,
} from "./supabase-storage";

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB par fichier

export function sanitizeFilename(name: string): string {
  return supaSanitize(name);
}

function pathFor(announcementId: string, filename: string): string {
  return `announcements/${announcementId}/${sanitizeFilename(filename)}`;
}

export type AttachmentSaveResult =
  | { ok: true; filename: string; mimeType: string; size: number }
  | { ok: false; error: string };

export async function saveAnnouncementAttachment(args: {
  announcementId: string;
  file: File;
}): Promise<AttachmentSaveResult> {
  const { announcementId, file } = args;
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
      error: "Format non accepté (PDF, Word, Excel, images, texte)",
    };
  }

  // Déduplique le nom si un fichier homonyme existe déjà sous le préfixe
  let filename = sanitizeFilename(file.name);
  const existing = new Set(await listPrefix(`announcements/${announcementId}`));
  let candidate = filename;
  let i = 1;
  while (existing.has(candidate)) {
    const dot = filename.lastIndexOf(".");
    const base = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : "";
    candidate = `${base}-${i}${ext}`;
    i++;
  }
  filename = candidate;

  const buffer = Buffer.from(await file.arrayBuffer());
  const put = await putObject({
    path: pathFor(announcementId, filename),
    buffer,
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (!put.ok) return { ok: false, error: put.error };

  return {
    ok: true,
    filename,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function readAnnouncementAttachment(args: {
  announcementId: string;
  filename: string;
}): Promise<Buffer | null> {
  return getObject(pathFor(args.announcementId, args.filename));
}

export async function deleteAnnouncementAttachmentFile(args: {
  announcementId: string;
  filename: string;
}): Promise<void> {
  await removeObject(pathFor(args.announcementId, args.filename));
}

export async function deleteAnnouncementFolder(
  announcementId: string,
): Promise<void> {
  await removePrefix(`announcements/${announcementId}`);
}
