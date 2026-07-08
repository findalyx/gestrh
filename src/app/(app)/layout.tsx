import { AppShell } from "@/components/layout/AppShell";
import { type TopbarNotification } from "@/components/layout/Topbar";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { navSectionsFor } from "@/lib/navigation";
import { ensureMonthlyAccrualUpToDate } from "@/lib/leave-accrual";
import { getOrganization } from "@/lib/organization";
import { getAlertsForUser } from "@/lib/alerts";
import { LeaveStatus, JobStatus, Role, type Prisma } from "@prisma/client";

// Données partagées par toutes les pages : recalculées à chaque requête.
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  DIRECTION: "Direction générale",
  DRH: "DRH",
  MANAGER: "Manager",
  RECTEUR: "Recteur",
  DOYEN: "Doyen",
  AGENT: "Agent",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();
  const sections = navSectionsFor(currentUser.role);
  const organization = await getOrganization();

  // Déclenchement automatique du calcul mensuel des soldes (idempotent).
  // Ne s'exécute réellement que la première visite d'un nouveau mois.
  await ensureMonthlyAccrualUpToDate();

  // Badge sidebar « congés » : demandes en attente qui me concernent.
  // Chaîne configurable → validateur courant dénormalisé sur la demande.
  const pendingLeavesWhere = ((): Prisma.LeaveRequestWhereInput => {
    if (currentUser.role === Role.DIRECTION) {
      return { status: LeaveStatus.EN_ATTENTE };
    }
    if (currentUser.agent) {
      return {
        status: LeaveStatus.EN_ATTENTE,
        OR: [
          { currentApproverAgentId: currentUser.agent.id }, // à valider par moi
          { agentId: currentUser.agent.id }, // mes propres demandes en cours
        ],
      };
    }
    return { id: "__none__" };
  })();

  const [pendingLeaves, openPostings, alerts, dbNotifications] = await Promise.all([
    prisma.leaveRequest.count({ where: pendingLeavesWhere }),
    currentUser.role === Role.DIRECTION || currentUser.role === Role.DRH
      ? prisma.jobPosting.count({ where: { status: JobStatus.OUVERT } })
      : Promise.resolve(0),
    getAlertsForUser({
      id: currentUser.id,
      role: currentUser.role,
      agent: currentUser.agent ? { id: currentUser.agent.id } : null,
    }),
    // Notifications événementielles non lues (validations de congés, etc.)
    prisma.notification.findMany({
      where: { userId: currentUser.id, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const badges: Record<string, number> = {};
  if (pendingLeaves > 0) badges["/conges"] = pendingLeaves;
  if (openPostings > 0) badges["/recrutement"] = openPostings;

  // La cloche cumule : notifications événementielles (base) + alertes calculées.
  const NOTIF_VARIANT: Record<string, TopbarNotification["variant"]> = {
    ALERTE: "danger",
    RAPPEL: "warning",
    INFO: "info",
    VALIDATION: "info",
  };
  const topbarNotifications: TopbarNotification[] = [
    ...dbNotifications.map((n) => ({
      id: n.id,
      variant: NOTIF_VARIANT[n.type] ?? "info",
      title: n.title,
      message: n.message,
      link: n.link ?? "/tableau-de-bord",
    })),
    ...alerts.map((a) => ({
      id: a.id,
      variant: a.variant,
      title: a.title,
      message: a.message,
      link: a.link,
    })),
  ];

  const user = {
    name: currentUser.agent
      ? `${currentUser.agent.firstName} ${currentUser.agent.lastName}`
      : currentUser.email,
    role: ROLE_LABEL[currentUser.role],
    initials: currentUser.agent
      ? `${currentUser.agent.firstName[0]}${currentUser.agent.lastName[0]}`.toUpperCase()
      : currentUser.email.slice(0, 2).toUpperCase(),
    photoSrc:
      currentUser.agent && currentUser.agent.photoUrl?.startsWith("agents/")
        ? `/api/personnel/${currentUser.agent.id}/photo`
        : null,
  };

  // Recherche d'agent : utile uniquement pour ceux qui ont accès à /personnel
  const canSearch =
    currentUser.role === Role.DIRECTION ||
    currentUser.role === Role.DRH ||
    currentUser.role === Role.MANAGER;

  return (
    <AppShell
      sidebar={{
        sections,
        badges,
        organization: {
          name: organization.name,
          shortName: organization.shortName,
          tagline: organization.tagline,
          logoUrl: organization.logoFilename
            ? `/api/branding/logo?v=${encodeURIComponent(organization.updatedAt.toISOString())}`
            : null,
        },
      }}
      topbar={{
        notifications: topbarNotifications,
        user,
        showSearch: canSearch,
      }}
    >
      {children}
    </AppShell>
  );
}
