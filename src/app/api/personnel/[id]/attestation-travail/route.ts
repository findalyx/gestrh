import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { buildWorkAttestationDocx } from "@/lib/docx/work-attestation";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: Role[] = [
  Role.DIRECTION,
  Role.RECTEUR,
  Role.DOYEN,
  Role.DRH,
];

/**
 * Attestation de travail (.docx) pour un agent.
 * Accès : l'agent concerné (sa propre attestation) ou Direction / Recteur /
 * Doyen / DRH.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const me = await getCurrentUser();

  const agent = await prisma.agent.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      matricule: true,
      gender: true,
      jobTitle: true,
      hireDate: true,
      contracts: {
        where: { status: "ACTIF" },
        orderBy: { startDate: "desc" },
        take: 1,
        select: { type: true, startDate: true },
      },
    },
  });
  if (!agent) return new Response("Agent introuvable", { status: 404 });

  const isAdmin = ADMIN_ROLES.includes(me.role);
  const isOwn = me.agent?.id === agent.id;
  if (!isAdmin && !isOwn) {
    return new Response("Accès refusé", { status: 403 });
  }

  const bytes = await buildWorkAttestationDocx(
    agent,
    agent.contracts[0] ?? null,
  );

  const fileName = `attestation-travail-${agent.matricule}.docx`;
  return new Response(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
