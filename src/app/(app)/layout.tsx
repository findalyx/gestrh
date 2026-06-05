import { AppShell } from "@/components/layout/AppShell";
import { type TopbarNotification } from "@/components/layout/Topbar";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { navSectionsFor } from "@/lib/navigation";
import { ensureMonthlyAccrualUpToDate } from "@/lib/leave-accrual";
import { getOrganization } from "@/lib/organization";
import { getAlertsForUser } from "@/lib/alerts";
import { LeaveStatus, JobStatus, Role } from "@prisma/client";

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

  // Filtre les compteurs en fonction du rôle (badges sidebar).
  const pendingLeavesWhere = (() => {
    const base = {
      status: {
        in: [LeaveStatus.EN_ATTENTE_CHEF, LeaveStatus.EN_ATTENTE_DOYEN, LeaveStatus.EN_ATTENTE_DG],
      },
    };
    if (currentUser.role === Role.MANAGER && currentUser.agent) {
      return {
        ...base,
        status: LeaveStatus.EN_ATTENTE_CHEF,
        agent: { service: { managerId: currentUser.agent.id } },
      };
    }
    if (currentUser.role === Role.AGENT && currentUser.agent) {
      return { ...base, agentId: currentUser.agent.id };
    }
    return base;
  })();

  const [pendingLeaves, openPostings, alerts] = await Promise.all([
    prisma.leaveRequest.count({ where: pendingLeavesWhere }),
    currentUser.role === Role.DIRECTION || currentUser.role === Role.DRH
      ? prisma.jobPosting.count({ where: { status: JobStatus.OUVERT } })
      : Promise.resolve(0),
    getAlertsForUser({
      id: currentUser.id,
      role: currentUser.role,
      agent: currentUser.agent ? { id: currentUser.agent.id } : null,
    }),
  ]);

  const badges: Record<string, number> = {};
  if (pendingLeaves > 0) badges["/conges"] = pendingLeaves;
  if (openPostings > 0) badges["/recrutement"] = openPostings;

  // Les notifications de la topbar sont désormais des alertes calculées en
  // temps réel, avec un lien pour aller régler le problème.
  const topbarNotifications: TopbarNotification[] = alerts.map((a) => ({
    id: a.id,
    variant: a.variant,
    title: a.title,
    message: a.message,
    link: a.link,
  }));

  const user = {
    name: currentUser.agent
      ? `${currentUser.agent.firstName} ${currentUser.agent.lastName}`
      : currentUser.email,
    role: ROLE_LABEL[currentUser.role],
    initials: currentUser.agent
      ? `${currentUser.agent.firstName[0]}${currentUser.agent.lastName[0]}`.toUpperCase()
      : currentUser.email.slice(0, 2).toUpperCase(),
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
