import "server-only";

import {
  ContractStatus,
  EvaluationStatus,
  JobStatus,
  LeaveStatus,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AlertVariant = "warning" | "danger" | "info";
export type AlertType = "ALERTE" | "RAPPEL" | "VALIDATION" | "INFO";

export type Alert = {
  id: string;
  variant: AlertVariant;
  type: AlertType;
  title: string;
  message: string;
  link: string;
};

type UserContext = {
  id: string;
  role: Role;
  agent: { id: string } | null;
};

const DAY = 24 * 3600 * 1000;

/**
 * Calcule les alertes système pertinentes pour l'utilisateur connecté.
 * Les alertes sont calculées en temps réel à partir de l'état actuel de la
 * base — pas de stockage. Chaque alerte porte un lien vers la page qui
 * permet d'agir.
 */
export async function getAlertsForUser(user: UserContext): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * DAY);

  if (user.role === Role.DIRECTION || user.role === Role.DRH) {
    const [pendingLeaves, lateEvals, expiringContracts, openPostingsNoApp] =
      await Promise.all([
        prisma.leaveRequest.count({
          where: {
            status: {
              in: [LeaveStatus.EN_ATTENTE_MANAGER, LeaveStatus.EN_ATTENTE_DRH],
            },
          },
        }),
        prisma.evaluation.count({
          where: {
            status: {
              in: [EvaluationStatus.PLANIFIEE, EvaluationStatus.EN_COURS],
            },
            dueDate: { lt: today },
          },
        }),
        prisma.contract.count({
          where: {
            status: ContractStatus.ACTIF,
            endDate: { gte: today, lte: in30Days },
          },
        }),
        prisma.jobPosting.count({
          where: {
            status: JobStatus.OUVERT,
            applications: { none: {} },
          },
        }),
      ]);

    if (pendingLeaves > 0) {
      alerts.push({
        id: "pending-leaves",
        type: "VALIDATION",
        variant: "info",
        title: `${pendingLeaves} demande${pendingLeaves > 1 ? "s" : ""} de congés à valider`,
        message: "Validation hiérarchique en attente.",
        link: "/conges",
      });
    }
    if (lateEvals > 0) {
      alerts.push({
        id: "late-evals",
        type: "RAPPEL",
        variant: "danger",
        title: `${lateEvals} évaluation${lateEvals > 1 ? "s" : ""} en retard`,
        message: "Échéances dépassées.",
        link: "/evaluation",
      });
    }
    if (expiringContracts > 0) {
      alerts.push({
        id: "expiring-contracts",
        type: "ALERTE",
        variant: "warning",
        title: `${expiringContracts} contrat${expiringContracts > 1 ? "s" : ""} expire${expiringContracts > 1 ? "nt" : ""} sous 30 jours`,
        message: "Vérifiez les renouvellements.",
        link: "/personnel",
      });
    }
    if (openPostingsNoApp > 0) {
      alerts.push({
        id: "postings-no-app",
        type: "INFO",
        variant: "info",
        title: `${openPostingsNoApp} offre${openPostingsNoApp > 1 ? "s" : ""} sans candidature`,
        message: "Offres d'emploi ouvertes sans candidat enregistré.",
        link: "/recrutement",
      });
    }
  }

  if (user.role === Role.MANAGER && user.agent) {
    const [teamPendingLeaves, evalsToDo] = await Promise.all([
      prisma.leaveRequest.count({
        where: {
          status: LeaveStatus.EN_ATTENTE_MANAGER,
          agent: { service: { managerId: user.agent.id } },
        },
      }),
      prisma.evaluation.count({
        where: {
          evaluatorId: user.agent.id,
          status: {
            in: [EvaluationStatus.PLANIFIEE, EvaluationStatus.EN_COURS],
          },
        },
      }),
    ]);

    if (teamPendingLeaves > 0) {
      alerts.push({
        id: "team-pending-leaves",
        type: "VALIDATION",
        variant: "info",
        title: `${teamPendingLeaves} demande${teamPendingLeaves > 1 ? "s" : ""} de votre équipe à valider`,
        message: "Décision en attente de votre part.",
        link: "/conges",
      });
    }
    if (evalsToDo > 0) {
      alerts.push({
        id: "evals-to-do",
        type: "RAPPEL",
        variant: "warning",
        title: `${evalsToDo} évaluation${evalsToDo > 1 ? "s" : ""} à remplir`,
        message: "Entretiens annuels en attente.",
        link: "/evaluation",
      });
    }
  }

  if (user.role === Role.AGENT && user.agent) {
    const [ownPending, ownEval, upcomingTraining] = await Promise.all([
      prisma.leaveRequest.findFirst({
        where: {
          agentId: user.agent.id,
          status: {
            in: [LeaveStatus.EN_ATTENTE_MANAGER, LeaveStatus.EN_ATTENTE_DRH],
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.evaluation.findFirst({
        where: {
          agentId: user.agent.id,
          status: { in: [EvaluationStatus.PLANIFIEE, EvaluationStatus.EN_COURS] },
        },
      }),
      prisma.trainingEnrollment.findFirst({
        where: {
          agentId: user.agent.id,
          status: { in: ["INSCRIT", "CONFIRME"] },
          session: { startDate: { gte: today, lte: in30Days } },
        },
        include: { session: { include: { course: true } } },
      }),
    ]);

    if (ownPending) {
      alerts.push({
        id: `own-leave-${ownPending.id}`,
        type: "INFO",
        variant: "info",
        title: "Votre demande de congé est en attente",
        message: "En attente de validation hiérarchique.",
        link: "/conges",
      });
    }
    if (ownEval) {
      alerts.push({
        id: `own-eval-${ownEval.id}`,
        type: "INFO",
        variant: "info",
        title: "Évaluation annuelle en cours",
        message: "Échangez avec votre responsable.",
        link: `/evaluation/${ownEval.id}`,
      });
    }
    if (upcomingTraining) {
      alerts.push({
        id: `training-${upcomingTraining.id}`,
        type: "RAPPEL",
        variant: "warning",
        title: `Formation à venir : ${upcomingTraining.session.course.title}`,
        message: "Vérifiez les détails de la session.",
        link: `/formation/${upcomingTraining.session.courseId}`,
      });
    }
  }

  return alerts;
}

/**
 * Compte le nombre d'alertes actives pour l'utilisateur (utile pour le
 * badge de la cloche).
 */
export async function getAlertCount(user: UserContext): Promise<number> {
  const alerts = await getAlertsForUser(user);
  return alerts.length;
}
