import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getObject } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

/**
 * Sert le bulletin de paie individuel (PDF) d'un enregistrement de paie.
 * Accès : l'agent concerné (son propre bulletin) ou DRH / Direction.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const me = await getCurrentUser();

  const record = await prisma.payrollRecord.findUnique({
    where: { id },
    select: {
      agentId: true,
      period: true,
      pdfUrl: true,
      agent: { select: { matricule: true } },
    },
  });
  if (!record) return new Response("Bulletin introuvable", { status: 404 });

  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  const isOwn = me.agent?.id === record.agentId;
  if (!isAdmin && !isOwn) {
    return new Response("Accès refusé", { status: 403 });
  }
  if (!record.pdfUrl) {
    return new Response("Bulletin PDF non disponible", { status: 404 });
  }

  const buffer = await getObject(record.pdfUrl);
  if (!buffer) return new Response("Fichier manquant", { status: 404 });

  const name = `bulletin-${record.agent.matricule}-${record.period}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
