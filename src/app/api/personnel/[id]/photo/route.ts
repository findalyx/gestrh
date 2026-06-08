import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getObject } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

function contentTypeFor(path: string): string {
  const p = path.toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * Sert la photo d'un agent (bucket privé Supabase) via proxy authentifié.
 * Accessible à tout utilisateur connecté (avatars internes).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await getCurrentUser();

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { photoUrl: true },
    });
    if (!agent?.photoUrl) {
      return new Response("Aucune photo", { status: 404 });
    }

    const buffer = await getObject(agent.photoUrl);
    if (!buffer) return new Response("Fichier manquant", { status: 404 });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeFor(agent.photoUrl),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    console.error("[photo] échec:", e);
    return new Response("Erreur", { status: 500 });
  }
}
