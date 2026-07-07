import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { readPrestationDocument } from "@/lib/prestation-storage";

/**
 * Sert le document mensuel signé d'une prestation. Accès :
 *   - DIRECTION + DRH : tout document
 *   - AGENT (prestataire) : uniquement ses propres prestations
 *   - MANAGER : prestations des agents de son service
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentUser();
  const { id } = await params;

  const invoice = await prisma.prestationInvoice.findUnique({
    where: { id },
    select: {
      id: true,
      period: true,
      documentName: true,
      documentPath: true,
      agent: {
        select: {
          id: true,
          matricule: true,
          service: { select: { managerId: true } },
        },
      },
    },
  });
  if (!invoice || !invoice.documentPath) {
    return new Response("Document introuvable", { status: 404 });
  }

  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  const isOwner = me.role === Role.AGENT && me.agent?.id === invoice.agent.id;
  const isManagerOfService =
    me.role === Role.MANAGER &&
    me.agent?.id === invoice.agent.service.managerId;
  if (!isAdmin && !isOwner && !isManagerOfService) {
    return new Response("Accès refusé", { status: 403 });
  }

  const buffer = await readPrestationDocument(invoice.documentPath);
  if (!buffer) return new Response("Fichier manquant", { status: 404 });

  // Devine le type MIME à partir de l'extension du nom stocké.
  const name = invoice.documentName ?? "document";
  const ext = name.split(".").pop()?.toLowerCase();
  const isDocx = ext === "docx";
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : isDocx
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/pdf";

  const downloadName = `prestation-${invoice.agent.matricule}-${invoice.period}-${name}`;
  // Word ne s'affiche pas dans le navigateur → téléchargement ; le reste en aperçu.
  const disposition = isDocx ? "attachment" : "inline";

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${disposition}; filename="${downloadName}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
