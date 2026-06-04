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
  const r = await prisma.resignation.findUnique({
    where: { id },
    select: { signedFileName: true, signedMimeType: true },
  });
  if (!r || !r.signedFileName) {
    return new Response("Lettre signée non déposée.", { status: 404 });
  }

  const buffer = await readSignedFile(
    `resignations/${id}/signed`,
    r.signedFileName,
  );
  if (!buffer) return new Response("Fichier manquant.", { status: 404 });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": r.signedMimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(r.signedFileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
