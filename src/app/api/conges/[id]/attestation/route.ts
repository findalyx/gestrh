import { LeaveStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { buildLeaveAttestationDocx } from "@/lib/docx/leave-attestation";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: Role[] = [
  Role.DIRECTION,
  Role.RECTEUR,
  Role.DOYEN,
  Role.DRH,
];

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
          service: { select: { name: true } },
        },
      },
      approvals: {
        where: { decision: "FAVORABLE" },
        orderBy: { decidedAt: "asc" },
        select: { level: true, decidedAt: true },
      },
    },
  });
  if (!leave) return new Response("Demande introuvable", { status: 404 });

  const isAdmin = ADMIN_ROLES.includes(me.role);
  const isOwn = me.agent?.id === leave.agentId;
  if (!isAdmin && !isOwn) {
    return new Response("Accès refusé", { status: 403 });
  }
  if (leave.status !== LeaveStatus.AUTORISE) {
    return new Response("Attestation disponible une fois le congé autorisé.", {
      status: 409,
    });
  }

  const bytes = await buildLeaveAttestationDocx(
    leave,
    leave.agent,
    leave.agent.service,
    leave.approvals,
  );

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
