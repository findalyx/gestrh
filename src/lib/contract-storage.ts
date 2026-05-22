import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "uploads", "contracts");

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (contrat scanné parfois lourd)

function sanitize(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 80) || "contrat.pdf"
  );
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

  // Nettoie l'éventuel ancien PDF (un seul PDF par contrat)
  await deleteContractFolder(contractId);

  const filename = sanitize(file.name);
  const dir = path.join(ROOT, contractId);
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

export async function readContractPdf(args: {
  contractId: string;
  filename: string;
}): Promise<Buffer | null> {
  const dest = path.join(ROOT, args.contractId, sanitize(args.filename));
  if (!existsSync(dest)) return null;
  const resolved = path.resolve(dest);
  if (!resolved.startsWith(path.resolve(ROOT))) return null;
  return readFile(resolved);
}

export async function deleteContractFolder(contractId: string): Promise<void> {
  const dir = path.join(ROOT, contractId);
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
}
