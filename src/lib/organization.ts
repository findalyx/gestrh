import "server-only";

import { cache } from "react";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const BRANDING_DIR = path.join(process.cwd(), "uploads", "branding");

const DEFAULTS = {
  name: "Université St Christopher",
  shortName: "SC",
  tagline: "SIRH · Université",
  city: "Dakar",
  country: "Sénégal",
} as const;

/**
 * Récupère (et crée à la volée si absente) l'organisation. Memoïzé par requête.
 */
export const getOrganization = cache(async () => {
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: DEFAULTS.name,
        shortName: DEFAULTS.shortName,
        tagline: DEFAULTS.tagline,
        city: DEFAULTS.city,
        country: DEFAULTS.country,
      },
    });
  }
  return org;
});

// ============================================================
//  STOCKAGE DU LOGO SUR DISQUE
// ============================================================

const ACCEPTED_LOGO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

function sanitize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 64);
}

export type LogoUploadResult =
  | { ok: true; filename: string; mimeType: string }
  | { ok: false; error: string };

export async function saveLogoFile(file: File): Promise<LogoUploadResult> {
  if (!file || file.size === 0) {
    return { ok: false, error: "Fichier vide" };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (max 2 MB)" };
  }
  if (file.type && !ACCEPTED_LOGO_MIME.has(file.type)) {
    return {
      ok: false,
      error: "Format non accepté (PNG, JPG, SVG ou WebP uniquement)",
    };
  }

  // On supprime l'ancien logo avant d'écrire le nouveau pour éviter
  // l'accumulation de fichiers orphelins.
  await clearLogoFiles();

  const filename = sanitize(file.name) || `logo${extOf(file.type)}`;
  await mkdir(BRANDING_DIR, { recursive: true });
  const dest = path.join(BRANDING_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buffer);

  return {
    ok: true,
    filename,
    mimeType: file.type || "application/octet-stream",
  };
}

export async function readLogoFile(filename: string): Promise<Buffer | null> {
  const dest = path.join(BRANDING_DIR, sanitize(filename));
  if (!existsSync(dest)) return null;
  const resolved = path.resolve(dest);
  if (!resolved.startsWith(path.resolve(BRANDING_DIR))) return null;
  return readFile(resolved);
}

export async function clearLogoFiles(): Promise<void> {
  if (existsSync(BRANDING_DIR)) {
    await rm(BRANDING_DIR, { recursive: true, force: true });
  }
}

function extOf(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/svg+xml":
      return ".svg";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}
