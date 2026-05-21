import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar, type TopbarNotification } from "@/components/layout/Topbar";
import { prisma } from "@/lib/prisma";
import { LeaveStatus, JobStatus, NotificationType } from "@prisma/client";

// Données partagées par toutes les pages : recalculées à chaque requête.
export const dynamic = "force-dynamic";

const VARIANT_BY_TYPE: Record<NotificationType, TopbarNotification["variant"]> = {
  ALERTE: "warning",
  RAPPEL: "danger",
  VALIDATION: "info",
  INFO: "info",
};

function relativeTime(date: Date): string {
  const diffH = Math.floor((Date.now() - date.getTime()) / 3_600_000);
  if (diffH < 1) return "À l'instant";
  if (diffH < 24) return `Il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return diffD === 1 ? "Hier" : `Il y a ${diffD} jours`;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pendingLeaves, openPostings, notifications] = await Promise.all([
    prisma.leaveRequest.count({
      where: {
        status: {
          in: [LeaveStatus.EN_ATTENTE_MANAGER, LeaveStatus.EN_ATTENTE_DRH],
        },
      },
    }),
    prisma.jobPosting.count({ where: { status: JobStatus.OUVERT } }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const badges: Record<string, number> = {
    "/conges": pendingLeaves,
    "/recrutement": openPostings,
  };

  const topbarNotifications: TopbarNotification[] = notifications.map((n) => ({
    id: n.id,
    variant: VARIANT_BY_TYPE[n.type],
    title: n.title,
    message: n.message,
    time: relativeTime(n.createdAt),
  }));

  // Profil affiché — sera remplacé par l'utilisateur connecté (module auth).
  const user = {
    name: "Pr. M. Diop",
    role: "Directeur général",
    initials: "MD",
  };

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr]">
      <Sidebar badges={badges} />
      <main className="min-w-0">
        <Topbar notifications={topbarNotifications} user={user} />
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
