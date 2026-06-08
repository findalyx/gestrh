import { LeaveStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { buildLeaveAttestationDocx } from "@/lib/docx/leave-attestation";

export const dynamic = "force-dynamic";

// Génération de documents officiels réservée à la Direction et à la DRH.
const ADMIN_ROLES: Role[] = [Role.DIRECTION, Role.DRH];

/**
 * Attestation de congés (.docx) — disponible quand le congé est AUTORISÉ.
 * Accès : l'agent concerné (sa propre attestation) ou Direction / Recteur /
 * Doyen / DRH.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const me = await getCurrentUser();

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      agent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          matricule: true,
          gender: true,
          jobTitle: true,
        },
      },
    },
  });
  if (!leave) return new Response("Demande introuvable", { status: 404 });

  if (!ADMIN_ROLES.includes(me.role)) {
    return new Response("Accès refusé", { status: 403 });
  }
  if (leave.status !== LeaveStatus.AUTORISE) {
    return new Response("Attestation disponible une fois le congé autorisé.", {
      status: 409,
    });
  }

  const bytes = await buildLeaveAttestationDocx(leave, leave.agent);

  const fileName = `attestation-conges-${leave.agent.matricule}.docx`;
  return new Response(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
