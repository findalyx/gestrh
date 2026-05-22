import { LeaveStatus, LeaveType, Role } from "@prisma/client";

/**
 * Détermine le statut initial d'une demande à la création.
 * Si l'agent a un manager désigné dans son service, la demande va d'abord
 * vers le manager. Sinon, elle remonte directement à la DRH.
 *
 * Cas particuliers :
 * - MATERNITE / PATERNITE / SANS_SOLDE : DRH directement (décision RH)
 */
export function initialStatus(args: {
  type: LeaveType;
  agentServiceManagerId: string | null;
  agentIsSelf: boolean;
}): LeaveStatus {
  // Si l'agent qui crée la demande EST le manager du service, on saute son
  // propre niveau et on va directement en DRH.
  if (args.agentIsSelf) {
    return LeaveStatus.EN_ATTENTE_DRH;
  }

  // Types qui relèvent toujours de la DRH
  if (
    args.type === LeaveType.MATERNITE ||
    args.type === LeaveType.PATERNITE ||
    args.type === LeaveType.SANS_SOLDE
  ) {
    return LeaveStatus.EN_ATTENTE_DRH;
  }

  return args.agentServiceManagerId
    ? LeaveStatus.EN_ATTENTE_MANAGER
    : LeaveStatus.EN_ATTENTE_DRH;
}

/**
 * Détermine si l'utilisateur courant peut approuver/refuser une demande
 * dans son état actuel.
 */
export function canDecide(args: {
  status: LeaveStatus;
  userRole: Role;
  userAgentId: string | null;
  agentServiceManagerId: string | null;
}): boolean {
  if (args.status === LeaveStatus.EN_ATTENTE_MANAGER) {
    // Le manager du service peut décider, ou la DRH/Direction en override
    return (
      (args.userRole === Role.MANAGER &&
        args.userAgentId === args.agentServiceManagerId) ||
      args.userRole === Role.DRH ||
      args.userRole === Role.DIRECTION
    );
  }
  if (args.status === LeaveStatus.EN_ATTENTE_DRH) {
    return args.userRole === Role.DRH || args.userRole === Role.DIRECTION;
  }
  return false;
}

/**
 * Statut suivant après approbation. Pour la v1, on simplifie : tout passe
 * directement en APPROUVE après une approbation, qu'elle vienne du manager
 * ou de la DRH.
 */
export function nextStatusAfterApproval(): LeaveStatus {
  return LeaveStatus.APPROUVE;
}
