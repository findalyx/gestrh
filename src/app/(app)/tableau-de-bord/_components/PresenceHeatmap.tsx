import { AgentStatus, LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HeatmapGrid, type HeatmapCellData, type HeatmapRow } from "./HeatmapGrid";

const WORKING_DAYS = 20;

/**
 * Génère les `count` derniers jours ouvrés (lundi-vendredi), du plus ancien
 * au plus récent.
 */
function lastWorkingDays(count: number, today: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  while (days.length < count) {
    const dow = cursor.getDay(); // 0 = dim, 6 = sam
    if (dow !== 0 && dow !== 6) {
      days.unshift(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}

/**
 * Heatmap de présence : pour chaque service, on calcule pour chaque jour
 * ouvré des 20 derniers jours le taux de présence (= 1 − absents / effectif).
 *
 * Server Component qui prépare les données et les passe à HeatmapGrid (client)
 * pour le rendu interactif avec hover.
 */
export async function PresenceHeatmap() {
  const today = new Date();
  const days = lastWorkingDays(WORKING_DAYS, today);
  const start = days[0];
  const end = days[days.length - 1];

  const [services, leaves] = await Promise.all([
    prisma.service.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { agents: { where: { status: AgentStatus.ACTIF } } } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.AUTORISE,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: {
        startDate: true,
        endDate: true,
        agent: {
          select: {
            serviceId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  // Pour chaque service, on construit le tableau des cellules par jour
  const rows: HeatmapRow[] = services
    .filter((s) => s._count.agents > 0)
    .map((s) => {
      const cells: HeatmapCellData[] = days.map((day) => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);
        const absentAgents: string[] = [];
        for (const l of leaves) {
          if (l.agent.serviceId !== s.id) continue;
          if (l.startDate <= dayEnd && l.endDate >= dayStart) {
            absentAgents.push(`${l.agent.lastName.toUpperCase()} ${l.agent.firstName}`);
          }
        }
        const total = s._count.agents;
        const absent = absentAgents.length;
        const present = Math.max(0, total - absent);
        const rate = total > 0 ? present / total : 0;
        return {
          dateISO: dayStart.toISOString(),
          present,
          absent,
          total,
          rate,
          absentNames: absentAgents.slice(0, 5),
        };
      });
      return { service: s.name, cells };
    });

  return (
    <HeatmapGrid
      rows={rows}
      daysISO={days.map((d) => d.toISOString())}
    />
  );
}
