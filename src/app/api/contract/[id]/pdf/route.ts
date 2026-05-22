import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { readContractPdf } from "@/lib/contract-storage";

/**
 * Sert le PDF d'un contrat. Accès :
 *   - DIRECTION + DRH : tout contrat
 *   - AGENT : uniquement ses propres contrats
 *   - MANAGER : contrats des agents de son service
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentUser();
  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: {
      id: true,
      pdfFilename: true,
      pdfMimeType: true,
      reference: true,
      agent: {
        select: {
          id: true,
          service: { select: { managerId: true } },
        },
      },
    },
  });
  if (!contract || !contract.pdfFilename) {
    return new Response("PDF introuvable", { status: 404 });
  }

  // Contrôle d'accès
  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  const isOwner = me.role === Role.AGENT && me.agent?.id === contract.agent.id;
  const isManagerOfService =
    me.role === Role.MANAGER &&
    me.agent?.id === contract.agent.service.managerId;
  if (!isAdmin && !isOwner && !isManagerOfService) {
    return new Response("Accès refusé", { status: 403 });
  }

  const buffer = await readContractPdf({
    contractId: contract.id,
    filename: contract.pdfFilename,
  });
  if (!buffer) return new Response("Fichier manquant", { status: 404 });

  const downloadName = `${contract.reference}-${contract.pdfFilename}`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contract.pdfMimeType ?? "application/pdf",
      "Content-Disposition": `inline; filename="${downloadName}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
