import { prisma } from "@/lib/prisma";
import { readLogoFile } from "@/lib/organization";

/**
 * Sert le logo de l'organisation. Accessible publiquement (utilisé sur la
 * page de connexion non authentifiée).
 *
 * On expose en cache court pour profiter du HTTP caching pendant la session.
 */
export async function GET() {
  const org = await prisma.organization.findFirst({
    select: { logoFilename: true, logoMimeType: true },
  });
  if (!org?.logoFilename) {
    return new Response("Aucun logo", { status: 404 });
  }

  const buffer = await readLogoFile(org.logoFilename);
  if (!buffer) {
    return new Response("Fichier introuvable", { status: 404 });
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": org.logoMimeType ?? "image/png",
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "public, max-age=60, must-revalidate",
    },
  });
}
