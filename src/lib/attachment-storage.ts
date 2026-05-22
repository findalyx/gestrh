import "server-only";

import { mkdir, readFile, rm, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "uploads", "announcements");

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
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80) || "fichier"
  );
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

  // Sanitize + déduplicate
  let filename = sanitizeFilename(file.name);
  const dir = path.join(ROOT, announcementId);
  await mkdir(dir, { recursive: true });
  let dest = path.join(dir, filename);
  let i = 1;
  while (existsSync(dest)) {
    const dot = filename.lastIndexOf(".");
    const base = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : "";
    filename = `${base}-${i}${ext}`;
    dest = path.join(dir, filename);
    i++;
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buffer);

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
  const dest = path.join(
    ROOT,
    args.announcementId,
    sanitizeFilename(args.filename),
  );
  if (!existsSync(dest)) return null;
  const resolved = path.resolve(dest);
  if (!resolved.startsWith(path.resolve(ROOT))) return null;
  return readFile(resolved);
}

export async function deleteAnnouncementAttachmentFile(args: {
  announcementId: string;
  filename: string;
}): Promise<void> {
  const dest = path.join(
    ROOT,
    args.announcementId,
    sanitizeFilename(args.filename),
  );
  if (existsSync(dest)) {
    await unlink(dest);
  }
}

export async function deleteAnnouncementFolder(
  announcementId: string,
): Promise<void> {
  const dir = path.join(ROOT, announcementId);
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
}
