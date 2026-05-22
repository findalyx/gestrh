import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { readCvFile } from "@/lib/cv-storage";

/**
 * Sert le CV stocké pour une candidature donnée.
 * - Accès : DIRECTION + DRH uniquement (cf. matrice du module Recrutement)
 * - Force le téléchargement via `Content-Disposition: attachment`
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  await requireRole(Role.DIRECTION, Role.DRH);
  const { appId } = await params;

  const application = await prisma.application.findUnique({
    where: { id: appId },
    select: {
      cvFilename: true,
      cvMimeType: true,
      candidateName: true,
    },
  });
  if (!application || !application.cvFilename) {
    return new Response("CV introuvable", { status: 404 });
  }

  const buffer = await readCvFile({
    applicationId: appId,
    filename: application.cvFilename,
  });
  if (!buffer) {
    return new Response("Fichier introuvable sur le serveur", { status: 404 });
  }

  // Nom proposé au téléchargement : "Nom_Prenom-original.ext"
  const safeName = application.candidateName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const downloadName = `${safeName}-${application.cvFilename}`;

  // Construit un Uint8Array stable pour BodyInit (TypeScript strict).
  const body = new Uint8Array(buffer);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": application.cvMimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
