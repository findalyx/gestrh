import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Dossier racine des fichiers uploadés. À la racine du projet, hors `public/`
 * pour rester derrière l'authentification.
 */
const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
const CV_ROOT = path.join(UPLOADS_ROOT, "cvs");

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Sanitize a filename — keep only chars sûrs, longueur max 80.
 */
export function sanitizeFilename(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return base || "cv.pdf";
}

export type CvUploadResult =
  | { ok: true; filename: string; mimeType: string; size: number }
  | { ok: false; error: string };

/**
 * Persiste un fichier CV pour une candidature donnée.
 * Le fichier est stocké dans `./uploads/cvs/{applicationId}/{filename}`.
 */
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
  const dir = path.join(CV_ROOT, applicationId);
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buffer);

  return {
    ok: true,
    filename,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

/**
 * Lit un fichier CV depuis le disque.
 */
export async function readCvFile(args: {
  applicationId: string;
  filename: string;
}): Promise<Buffer | null> {
  const dest = path.join(CV_ROOT, args.applicationId, sanitizeFilename(args.filename));
  if (!existsSync(dest)) return null;
  // Vérifie que le chemin résolu reste sous CV_ROOT (protection path traversal)
  const resolved = path.resolve(dest);
  if (!resolved.startsWith(path.resolve(CV_ROOT))) return null;
  return readFile(resolved);
}

/**
 * Supprime tous les fichiers CV d'une candidature.
 */
export async function deleteCvFolder(applicationId: string): Promise<void> {
  const dir = path.join(CV_ROOT, applicationId);
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
}
