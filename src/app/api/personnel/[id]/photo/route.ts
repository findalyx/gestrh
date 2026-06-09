import { readSession } from "@/lib/session";
import { getObject } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

/** Chemin déterministe (indépendant du nom de fichier) : pas de requête DB. */
function photoPath(agentId: string): string {
  return `agents/${agentId}/photo`;
}

/** Détecte le type image depuis les octets d'en-tête (pas besoin de la DB). */
function sniffImageType(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return "image/jpeg";
}

/**
 * Sert la photo d'un agent (bucket privé Supabase) via proxy.
 * Auth = session JWT uniquement (AUCUNE requête base de données) afin de ne pas
 * saturer le pool de connexions quand de nombreux avatars se chargent.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await readSession();
    if (!session) return new Response("Non authentifié", { status: 401 });

    const { id } = await params;
    const buffer = await getObject(photoPath(id));
    if (!buffer) return new Response("Aucune photo", { status: 404 });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": sniffImageType(buffer),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("[photo] échec:", e);
    return new Response("Erreur", { status: 500 });
  }
}
