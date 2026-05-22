import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { readAnnouncementAttachment } from "@/lib/attachment-storage";

/**
 * Sert une pièce jointe d'annonce. Accessible à tout utilisateur connecté.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await verifySession();
  const { id } = await params;

  const att = await prisma.announcementAttachment.findUnique({
    where: { id },
    select: {
      filename: true,
      mimeType: true,
      announcementId: true,
    },
  });
  if (!att) return new Response("Introuvable", { status: 404 });

  const buffer = await readAnnouncementAttachment({
    announcementId: att.announcementId,
    filename: att.filename,
  });
  if (!buffer) return new Response("Fichier manquant", { status: 404 });

  // Pour les images on inline, pour les autres on force le téléchargement
  const isImage = att.mimeType.startsWith("image/");
  const disposition = isImage
    ? `inline; filename="${att.filename}"`
    : `attachment; filename="${att.filename}"`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": att.mimeType || "application/octet-stream",
      "Content-Disposition": disposition,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, max-age=60",
    },
  });
}
