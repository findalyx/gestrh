import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { readAgentDocumentFile } from "@/lib/document-storage";

export const dynamic = "force-dynamic";

/**
 * Sert une pièce justificative d'agent depuis Supabase. Accessible à tout
 * utilisateur connecté (le bucket reste privé : ce proxy est le seul accès).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await verifySession();
  const { id } = await params;

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { fileName: true, mimeType: true },
  });
  if (!doc) return new Response("Document introuvable", { status: 404 });

  const buffer = await readAgentDocumentFile({
    documentId: id,
    filename: doc.fileName,
  });
  if (!buffer) return new Response("Fichier manquant", { status: 404 });

  const isImage = doc.mimeType.startsWith("image/");
  const disposition = isImage
    ? `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`
    : `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": disposition,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
