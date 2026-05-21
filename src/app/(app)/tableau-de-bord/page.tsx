import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { prisma } from "@/lib/prisma";
import {
  StaffCategory,
  LeaveStatus,
  JobStatus,
  EvaluationStatus,
} from "@prisma/client";

export const dynamic = "force-dynamic";

type KpiColor = "blue" | "purple" | "green" | "teal" | "danger";

const KPI_ICON_STYLE: Record<KpiColor, string> = {
  blue: "bg-sc-blue-light text-sc-blue",
  purple: "bg-sc-purple-light text-sc-purple",
  green: "bg-sc-green-light text-sc-green-dark",
  teal: "bg-sc-teal-light text-sc-teal-dark",
  danger: "bg-sc-danger-light text-sc-danger",
};

function KpiCard({
  color,
  icon,
  label,
  value,
  hint,
}: {
  color: KpiColor;
  icon: IconName;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(51,89,164,0.08)]">
      <div
        className={`flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full ${KPI_ICON_STYLE[color]}`}
      >
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium text-gray-500">
          {label}
        </div>
        <div className="text-[22px] font-bold leading-tight text-sc-blue-darker">
          {value}
        </div>
        <div className="text-[11px] text-gray-500">{hint}</div>
      </div>
    </div>
  );
}

const QUICK_MODULES: {
  href: string;
  icon: IconName;
  label: string;
  color: KpiColor;
}[] = [
  { href: "/personnel", icon: "users", label: "Personnel", color: "blue" },
  { href: "/paie", icon: "payroll", label: "Paie", color: "purple" },
  { href: "/conges", icon: "calendar", label: "Congés", color: "green" },
  { href: "/recrutement", icon: "recruitment", label: "Recrutement", color: "teal" },
  { href: "/formation", icon: "training", label: "Formation", color: "blue" },
  { href: "/evaluation", icon: "evaluation", label: "Évaluation", color: "purple" },
  { href: "/communication", icon: "communication", label: "Communication", color: "green" },
  { href: "/conformite", icon: "compliance", label: "Conformité", color: "teal" },
];

export default async function DashboardPage() {
  const today = new Date();

  const [
    totalAgents,
    perCount,
    patsCount,
    onLeaveToday,
    notifCount,
    pendingLeaves,
    openPostings,
    enrollments,
    evalsTotal,
    evalsDone,
    payrollThisPeriod,
  ] = await Promise.all([
    prisma.agent.count(),
    prisma.agent.count({ where: { category: StaffCategory.PER } }),
    prisma.agent.count({ where: { category: StaffCategory.PATS } }),
    prisma.leaveRequest.count({
      where: {
        status: LeaveStatus.APPROUVE,
        startDate: { lte: today },
        endDate: { gte: today },
      },
    }),
    prisma.notification.count(),
    prisma.leaveRequest.count({
      where: {
        status: {
          in: [LeaveStatus.EN_ATTENTE_MANAGER, LeaveStatus.EN_ATTENTE_DRH],
        },
      },
    }),
    prisma.jobPosting.count({ where: { status: JobStatus.OUVERT } }),
    prisma.trainingEnrollment.count(),
    prisma.evaluation.count(),
    prisma.evaluation.count({ where: { status: EvaluationStatus.TERMINEE } }),
    prisma.payrollRecord.count({ where: { period: "2026-05" } }),
  ]);

  const presenceRate =
    totalAgents > 0
      ? Math.round(((totalAgents - onLeaveToday) / totalAgents) * 100)
      : 0;
  const perPct = totalAgents > 0 ? ((perCount / totalAgents) * 100).toFixed(1) : "0";
  const patsPct = totalAgents > 0 ? ((patsCount / totalAgents) * 100).toFixed(1) : "0";
  const evalPct = evalsTotal > 0 ? Math.round((evalsDone / evalsTotal) * 100) : 0;

  const moduleStats: Record<string, string> = {
    "/personnel": `${totalAgents} dossiers`,
    "/paie": `${payrollThisPeriod} bulletins`,
    "/conges": `${pendingLeaves} en attente`,
    "/recrutement": `${openPostings} postes`,
    "/formation": `${enrollments} inscrits`,
    "/evaluation": `${evalPct}% réalisées`,
    "/communication": `${notifCount} alertes`,
    "/conformite": "Archives & RGPD",
  };

  return (
    <div className="space-y-6">
      {/* 5 KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          color="blue"
          icon="users"
          label="Effectif total"
          value={String(totalAgents)}
          hint="Agents enregistrés"
        />
        <KpiCard
          color="purple"
          icon="training"
          label="Personnel PER"
          value={String(perCount)}
          hint={`${perPct} % de l'effectif`}
        />
        <KpiCard
          color="green"
          icon="users"
          label="Personnel PATS"
          value={String(patsCount)}
          hint={`${patsPct} % de l'effectif`}
        />
        <KpiCard
          color="teal"
          icon="evaluation"
          label="Taux de présence"
          value={`${presenceRate}%`}
          hint={`${onLeaveToday} agent(s) en congé`}
        />
        <KpiCard
          color="danger"
          icon="alert"
          label="Alertes RH"
          value={String(notifCount)}
          hint="À traiter"
        />
      </div>

      {/* Note : graphiques analytiques à venir */}
      <div className="rounded-xl border border-dashed border-sc-border bg-sc-blue-bg p-6">
        <h3 className="flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-teal" />
          Graphiques analytiques
        </h3>
        <p className="mt-2 text-[13px] text-gray-600">
          Évolution de l&apos;effectif, pyramide des âges, masse salariale,
          heatmap de présence, pipeline de recrutement et radar de
          performance — prochaine étape de développement.
        </p>
      </div>

      {/* Modules — accès rapide */}
      <section>
        <h3 className="mb-4 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-teal" />
          Modules — accès rapide
        </h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          {QUICK_MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="rounded-xl border border-sc-border bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-sc-blue hover:shadow-[0_4px_12px_rgba(51,89,164,0.08)]"
            >
              <div
                className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full ${KPI_ICON_STYLE[m.color]}`}
              >
                <Icon name={m.icon} size={16} />
              </div>
              <h4 className="text-[11.5px] font-semibold text-sc-blue-darker">
                {m.label}
              </h4>
              <div className="mt-1 text-[11px] text-gray-500">
                {moduleStats[m.href]}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
