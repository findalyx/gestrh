import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { readSignedFile } from "@/lib/signed-storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await verifySession();
  const { id } = await params;
  const a = await prisma.contractAmendment.findUnique({
    where: { id },
    select: { signedFileName: true, signedMimeType: true },
  });
  if (!a || !a.signedFileName) {
    return new Response("Avenant signé non déposé.", { status: 404 });
  }

  const buffer = await readSignedFile(
    `amendments/${id}/signed`,
    a.signedFileName,
  );
  if (!buffer) return new Response("Fichier manquant.", { status: 404 });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": a.signedMimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.signedFileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
