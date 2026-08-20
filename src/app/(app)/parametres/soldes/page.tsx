import Link from "next/link";
import { AgentStatus, LeaveType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { getLastAccrualYYMM } from "@/lib/leave-accrual";
import { Icon } from "@/components/Icon";
import {
  LeaveBalanceEditor,
  type BalanceRow,
} from "../_components/LeaveBalanceEditor";

export const dynamic = "force-dynamic";

export default async function SoldesCongesPage() {
  await requireRole(Role.DIRECTION, Role.DRH);

  const now = new Date();
  const lastAccrual = await getLastAccrualYYMM();
  // Par défaut on propose le mois du dernier arrêté connu, sinon le mois courant.
  const defaultCutoff =
    lastAccrual ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const year = Number(defaultCutoff.slice(0, 4));

  const agents = await prisma.agent.findMany({
    where: { status: { in: [AgentStatus.ACTIF, AgentStatus.SUSPENDU] } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      matricule: true,
      service: { select: { name: true } },
      leaveBalances: {
        where: { year, type: LeaveType.ANNUEL },
        select: { totalDays: true, usedDays: true },
        take: 1,
      },
    },
  });

  const rows: BalanceRow[] = agents.map((a) => ({
    agentId: a.id,
    name: `${a.lastName.toUpperCase()} ${a.firstName}`,
    matricule: a.matricule,
    serviceName: a.service.name,
    totalDays: a.leaveBalances[0]?.totalDays ?? null,
    usedDays: a.leaveBalances[0]?.usedDays ?? null,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/parametres" className="hover:text-sc-blue">
          Paramètres
        </Link>
        <span>›</span>
        <span className="text-sc-blue-darker">Soldes de congés</span>
      </div>

      <div className="rounded-xl border border-sc-border bg-sc-blue-bg/40 p-4 text-[12.5px] text-gray-700">
        <p className="flex items-center gap-2 font-medium text-sc-blue-darker">
          <Icon name="info" size={14} />
          Reprise des soldes existants
        </p>
        <p className="mt-1.5">
          Saisissez les jours <strong>acquis</strong> et <strong>pris</strong> de
          chaque agent tels qu&apos;ils sont à la fin du mois choisi. À partir du
          mois suivant, l&apos;application prend le relais et ajoute
          automatiquement <strong>2 jours par mois</strong> (plafond annuel :
          24 jours acquis).
        </p>
        <p className="mt-1.5 text-[11.5px] text-gray-500">
          Dernier arrêté enregistré :{" "}
          <span className="font-mono">{lastAccrual ?? "aucun"}</span>. Les soldes
          affichés sont ceux de l&apos;année {year}.
        </p>
      </div>

      <LeaveBalanceEditor rows={rows} defaultCutoff={defaultCutoff} />
    </div>
  );
}
