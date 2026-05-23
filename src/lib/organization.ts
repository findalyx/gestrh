import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  getObject,
  putObject,
  removePrefix,
  sanitizeFilename,
} from "@/lib/supabase-storage";

const BRANDING_PREFIX = "branding";

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

export type LogoUploadResult =
  | { ok: true; filename: string; mimeType: string }
  | { ok: false; error: string };

function pathFor(filename: string): string {
  return `${BRANDING_PREFIX}/${sanitizeFilename(filename)}`;
}

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

  const filename =
    sanitizeFilename(file.name) || `logo${extOf(file.type)}` || "logo";
  const buffer = Buffer.from(await file.arrayBuffer());
  const put = await putObject({
    path: pathFor(filename),
    buffer,
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (!put.ok) return { ok: false, error: put.error };

  return {
    ok: true,
    filename,
    mimeType: file.type || "application/octet-stream",
  };
}

export async function readLogoFile(filename: string): Promise<Buffer | null> {
  return getObject(pathFor(filename));
}

export async function clearLogoFiles(): Promise<void> {
  await removePrefix(BRANDING_PREFIX);
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
