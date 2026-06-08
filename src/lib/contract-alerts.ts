import { prisma } from "@/lib/prisma";
import {
  ContractStatus,
  ContractType,
  NotificationType,
  Role,
} from "@prisma/client";
import {
  CddAlertLevel,
  cddAlertLevel,
  daysUntil,
  retirementInfo,
} from "@/lib/contract-utils";
import { listUpcomingBirthdays } from "@/lib/wellbeing";

// ---------------------------------------------------------------
//  Lecture : alertes contractuelles & retraites
// ---------------------------------------------------------------

export type CddAlertItem = {
  contractId: string;
  reference: string;
  agentId: string;
  agentFullName: string;
  serviceName: string;
  endDate: Date;
  daysRemaining: number;
  level: Exclude<CddAlertLevel, "normal">;
};

export type RetirementAlertItem = {
  agentId: string;
  agentFullName: string;
  serviceName: string;
  retirementDate: Date;
  yearsRemaining: number;
  monthsRemaining: number;
  totalMonthsRemaining: number;
  alertWindow: 24 | 12 | 6 | 3 | null;
};

export async function listCddAlerts(now: Date = new Date()): Promise<CddAlertItem[]> {
  const horizonMs = 95 * 86_400_000;
  const horizonEnd = new Date(now.getTime() + horizonMs);

  const contracts = await prisma.contract.findMany({
    where: {
      type: ContractType.CDD,
      status: ContractStatus.ACTIF,
      endDate: { lte: horizonEnd },
    },
    select: {
      id: true,
      reference: true,
      endDate: true,
      agent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          service: { select: { name: true } },
        },
      },
    },
  });

  const items: CddAlertItem[] = [];
  for (const c of contracts) {
    if (!c.endDate) continue;
    const d = daysUntil(c.endDate, now);
    if (d === null) continue;
    const level = cddAlertLevel(d);
    if (level === "normal") continue;
    items.push({
      contractId: c.id,
      reference: c.reference,
      agentId: c.agent.id,
      agentFullName: `${c.agent.lastName.toUpperCase()} ${c.agent.firstName}`,
      serviceName: c.agent.service.name,
      endDate: c.endDate,
      daysRemaining: d,
      level,
    });
  }
  items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return items;
}

export async function listRetirementAlerts(
  now: Date = new Date(),
  horizonMonths = 60,
): Promise<RetirementAlertItem[]> {
  // On regarde les CDI actifs uniquement (les CDD/STAGE/VACATAIRE
  // partent à leur terme, pas en retraite).
  const agents = await prisma.agent.findMany({
    where: {
      contracts: {
        some: {
          type: ContractType.CDI,
          status: ContractStatus.ACTIF,
        },
      },
      birthDate: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      category: true,
      service: { select: { name: true } },
    },
  });

  const items: RetirementAlertItem[] = [];
  for (const a of agents) {
    const r = retirementInfo(a, now);
    if (!r) continue;
    if (r.totalMonthsRemaining > horizonMonths) continue;
    if (r.totalMonthsRemaining < -12) continue; // ignore les départs trop anciens
    items.push({
      agentId: a.id,
      agentFullName: `${a.lastName.toUpperCase()} ${a.firstName}`,
      serviceName: a.service.name,
      retirementDate: r.retirementDate,
      yearsRemaining: r.yearsRemaining,
      monthsRemaining: r.monthsRemaining,
      totalMonthsRemaining: r.totalMonthsRemaining,
      alertWindow: r.alertWindow,
    });
  }
  items.sort((a, b) => a.totalMonthsRemaining - b.totalMonthsRemaining);
  return items;
}

// ---------------------------------------------------------------
//  Écriture : matérialisation en notifications utilisateur
// ---------------------------------------------------------------

const DEDUPE_WINDOW_MS = 20 * 3_600_000; // 20h : un message identique n'est posté qu'une fois par jour

async function recipientsForGlobalAlerts(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: { in: [Role.DIRECTION, Role.DRH] }, isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function alreadyNotified(userId: string, title: string): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const n = await prisma.notification.findFirst({
    where: { userId, title, createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(n);
}

export type AlertRunReport = {
  cddCreated: number;
  retirementCreated: number;
  recipients: number;
};

export async function materializeAlerts(now: Date = new Date()): Promise<AlertRunReport> {
  const [cdd, retirement, recipients] = await Promise.all([
    listCddAlerts(now),
    listRetirementAlerts(now),
    recipientsForGlobalAlerts(),
  ]);

  let cddCreated = 0;
  let retirementCreated = 0;

  for (const item of cdd) {
    if (item.level === "anticipe") continue; // J−60/90 : visible dans l'UI sans notif

    const variant =
      item.level === "expire"
        ? NotificationType.ALERTE
        : item.level === "imminent"
          ? NotificationType.ALERTE
          : NotificationType.RAPPEL;
    const title =
      item.level === "expire"
        ? `CDD expiré · ${item.agentFullName}`
        : `CDD à échéance · ${item.agentFullName} (J−${item.daysRemaining})`;
    const message = `Contrat ${item.reference} · ${item.serviceName}. Échéance le ${item.endDate.toLocaleDateString("fr-FR")}.`;

    for (const userId of recipients) {
      if (await alreadyNotified(userId, title)) continue;
      await prisma.notification.create({
        data: {
          userId,
          type: variant,
          title,
          message,
          link: `/personnel/${item.agentId}/renouvellement`,
        },
      });
      cddCreated++;
    }
  }

  for (const item of retirement) {
    if (item.alertWindow === null) continue; // hors fenêtre 24/12/6/3 mois

    const variant =
      item.alertWindow <= 6 ? NotificationType.ALERTE : NotificationType.RAPPEL;
    const title = `Départ retraite à anticiper · ${item.agentFullName}`;
    const dateLabel = item.retirementDate.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
    });
    const message =
      item.totalMonthsRemaining <= 0
        ? `${item.serviceName} · Départ effectif ${dateLabel}.`
        : `${item.serviceName} · Départ prévu ${dateLabel} (${item.totalMonthsRemaining} mois restants).`;

    for (const userId of recipients) {
      if (await alreadyNotified(userId, title)) continue;
      await prisma.notification.create({
        data: {
          userId,
          type: variant,
          title,
          message,
          link: `/personnel/${item.agentId}`,
        },
      });
      retirementCreated++;
    }
  }

  return { cddCreated, retirementCreated, recipients: recipients.length };
}

/**
 * Notifications pour les anniversaires DU JOUR → Direction/DRH (pour penser à
 * les célébrer). Les anniversaires restent visibles par tous dans l'Espace de
 * vie ; ici on se contente d'un rappel quotidien aux responsables.
 */
export async function materializeBirthdayAlerts(
  now: Date = new Date(),
): Promise<number> {
  const today = (await listUpcomingBirthdays(now, 0)).filter((b) => b.isToday);
  if (today.length === 0) return 0;

  const recipients = await recipientsForGlobalAlerts();
  let created = 0;

  for (const b of today) {
    const title = `Anniversaire aujourd'hui · ${b.fullName}`;
    const message = `${b.serviceName}${b.age ? ` · ${b.age} ans` : ""}. Pensez à lui souhaiter un joyeux anniversaire !`;
    for (const userId of recipients) {
      if (await alreadyNotified(userId, title)) continue;
      await prisma.notification.create({
        data: {
          userId,
          type: NotificationType.INFO,
          title,
          message,
          link: "/bien-etre",
        },
      });
      created++;
    }
  }
  return created;
}
