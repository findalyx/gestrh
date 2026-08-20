import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { prisma } from "@/lib/prisma";
import {
  StaffCategory,
  LeaveStatus,
  JobStatus,
  EvaluationStatus,
  ApplicationStage,
  ContractStatus,
  ContractType,
  Gender,
  AgentStatus,
  type Prisma,
} from "@prisma/client";
import { KpiCard, KPI_ICON_STYLE, type KpiColor } from "./KpiCard";
import { CategoryDonut } from "./charts/CategoryDonut";
import { ServiceBarChart } from "./charts/ServiceBarChart";
import { AgePyramidChart } from "./charts/AgePyramidChart";
import { RecruitmentFunnel } from "./charts/RecruitmentFunnel";
import { PayrollEvolution } from "./charts/PayrollEvolution";
import { PayrollByGenderDonut } from "./charts/PayrollByGenderDonut";
import { GenderDonut } from "./charts/GenderDonut";
import { PresenceHeatmap } from "./PresenceHeatmap";

// Effectif « présent » : on exclut les partants (INACTIF, RETRAITE) des stats.
const ACTIVE_AGENT_WHERE: Prisma.AgentWhereInput = {
  status: { in: [AgentStatus.ACTIF, AgentStatus.SUSPENDU] },
};

// Effectif « salarié » : PER + PATS présents, hors prestataires (un prestataire
// n'est pas une embauche). Base de l'effectif, des entrées et des départs.
const EMPLOYEE_AGENT_WHERE: Prisma.AgentWhereInput = {
  status: { in: [AgentStatus.ACTIF, AgentStatus.SUSPENDU] },
  category: { in: [StaffCategory.PER, StaffCategory.PATS] },
};

// Entrees : seuls les contrats salaries comptent (ni stage, ni prestation).
const HIRE_CONTRACT_TYPES: ContractType[] = [
  ContractType.CDI,
  ContractType.CDD,
];

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

const AGE_BUCKETS = [
  { label: "20-29", min: 20, max: 29 },
  { label: "30-39", min: 30, max: 39 },
  { label: "40-49", min: 40, max: 49 },
  { label: "50-59", min: 50, max: 59 },
  { label: "60+", min: 60, max: 130 },
];

const APPLICATION_PIPELINE: ApplicationStage[] = [
  ApplicationStage.CANDIDATURE,
  ApplicationStage.PRESELECTION,
  ApplicationStage.ENTRETIEN,
  ApplicationStage.FINALISTE,
  ApplicationStage.RECRUTE,
];

const APPLICATION_LABEL: Record<ApplicationStage, string> = {
  CANDIDATURE: "Candidatures",
  PRESELECTION: "Présélection",
  ENTRETIEN: "Entretiens",
  FINALISTE: "Finalistes",
  RECRUTE: "Recrutés",
  REJETE: "Rejetés",
};

export async function DirectionDashboard() {
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);

  // Dernière période disposant réellement de bulletins : on prend le mois le
  // plus récent dont au moins un bulletin a un net > 0. Les bulletins se font
  // en fin de mois, donc le mois courant (ex. brouillons à 0) est ignoré tant
  // qu'aucune paie réelle n'y est saisie — le dashboard affiche donc M-1.
  const latestPeriod = await prisma.payrollRecord.findFirst({
    where: { netSalary: { gt: 0 } },
    orderBy: { period: "desc" },
    select: { period: true },
  });

  const [
    totalAgents,
    employeeCount,
    perCount,
    patsCount,
    prestataireCount,
    onLeaveToday,
    employeesForContracts,
    pendingLeaves,
    openPostings,
    enrollments,
    evalsTotal,
    evalsDone,
    payrollThisPeriod,
    massLatestPeriod,
    hireRows,
    departuresThisYear,
    services,
    agentsForAgePyramid,
    appByStage,
    payrollsByPeriod,
    agentsByGender,
    payrollByGender,
  ] = await Promise.all([
    prisma.agent.count({ where: ACTIVE_AGENT_WHERE }),
    prisma.agent.count({ where: EMPLOYEE_AGENT_WHERE }),
    prisma.agent.count({ where: { ...ACTIVE_AGENT_WHERE, category: StaffCategory.PER } }),
    prisma.agent.count({ where: { ...ACTIVE_AGENT_WHERE, category: StaffCategory.PATS } }),
    prisma.agent.count({ where: { ...ACTIVE_AGENT_WHERE, category: StaffCategory.PRESTATAIRE } }),
    prisma.leaveRequest.count({
      where: {
        status: LeaveStatus.AUTORISE,
        startDate: { lte: today },
        endDate: { gte: today },
      },
    }),
    // Repartition CDI / CDD : on compte des PERSONNES, un agent = un seul
    // contrat courant (l'actif le plus recent). Compter les lignes de contrat
    // gonflait le chiffre des qu'un renouvellement etait saisi sans cloturer
    // le precedent.
    prisma.agent.findMany({
      where: EMPLOYEE_AGENT_WHERE,
      select: {
        contracts: {
          where: { status: ContractStatus.ACTIF },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { type: true },
        },
      },
    }),
    prisma.leaveRequest.count({
      where: {
        status: {
          in: [LeaveStatus.EN_ATTENTE],
        },
      },
    }),
    prisma.jobPosting.count({ where: { status: JobStatus.OUVERT } }),
    prisma.trainingEnrollment.count(),
    prisma.evaluation.count(),
    prisma.evaluation.count({ where: { status: EvaluationStatus.TERMINEE } }),
    prisma.payrollRecord.count({ where: { period: latestPeriod?.period ?? "" } }),
    // Coût employeur de la dernière période (brut + charges patronales)
    latestPeriod
      ? prisma.payrollRecord.aggregate({
          where: { period: latestPeriod.period },
          _sum: {
            baseSalary: true,
            bonuses: true,
            allowances: true,
            chargesPatronales: true,
          },
        })
      : Promise.resolve({
          _sum: {
            baseSalary: 0,
            bonuses: 0,
            allowances: 0,
            chargesPatronales: 0,
          },
        }),
    // Entrees de l'annee : salaries PER + PATS (prestataires exclus), dates par
    // la date d'entree de la fiche — la meme que le filtre « Entree a partir
    // du » de la liste du personnel, pour que les deux ecrans concordent. Un
    // agent dont les seuls contrats sont un stage ou une prestation est exclu.
    prisma.agent.findMany({
      where: { category: { in: [StaffCategory.PER, StaffCategory.PATS] } },
      select: {
        hireDate: true,
        contracts: { select: { type: true } },
      },
    }),
    // Sorties de l'annee : les personnes parties (Inactif / Retraite) dont la
    // date de depart tombe dans l'annee — la meme population que le bouton
    // « Personnes parties » de la liste du personnel.
    prisma.agent.count({
      where: {
        status: { in: [AgentStatus.INACTIF, AgentStatus.RETRAITE] },
        departureDate: { gte: yearStart, lte: today },
      },
    }),
    // Services + count d'agents (présents uniquement)
    prisma.service.findMany({
      orderBy: { name: "asc" },
      select: {
        name: true,
        _count: { select: { agents: { where: ACTIVE_AGENT_WHERE } } },
      },
    }),
    // Agents avec birthDate + gender pour la pyramide des âges
    prisma.agent.findMany({
      where: {
        status: { in: [AgentStatus.ACTIF, AgentStatus.SUSPENDU] },
        birthDate: { not: null },
      },
      select: { birthDate: true, gender: true },
    }),
    // Candidatures par étape
    prisma.application.groupBy({
      by: ["stage"],
      _count: { _all: true },
    }),
    // Coût employeur par période (12 dernières périodes réelles)
    prisma.payrollRecord.groupBy({
      by: ["period"],
      where: { netSalary: { gt: 0 } },
      _sum: {
        baseSalary: true,
        bonuses: true,
        allowances: true,
        chargesPatronales: true,
      },
      orderBy: { period: "asc" },
      take: 12,
    }),
    // Effectif par sexe (répartition genre, présents uniquement)
    prisma.agent.groupBy({
      by: ["gender"],
      where: ACTIVE_AGENT_WHERE,
      _count: { _all: true },
    }),
    // Coût employeur par sexe — agrégé en mémoire après (groupBy ne supporte
    // pas de join direct sur le genre de l'agent).
    prisma.payrollRecord.findMany({
      where: { period: latestPeriod?.period ?? "" },
      select: {
        baseSalary: true,
        bonuses: true,
        allowances: true,
        chargesPatronales: true,
        agent: { select: { gender: true } },
      },
    }),
  ]);

  // Compteur pour le module Communication (annonces actives)
  const announcementCount = await prisma.announcement.count();

  // Entrees de l'annee (voir requete ci-dessus).
  let hiresThisYear = 0;
  for (const a of hireRows) {
    // Contrats saisis mais aucun CDI/CDD (stage, prestation) → pas une entree.
    const hasSalariedContract = a.contracts.some((c) =>
      HIRE_CONTRACT_TYPES.includes(c.type),
    );
    if (!hasSalariedContract && a.contracts.length > 0) continue;
    if (a.hireDate >= yearStart && a.hireDate <= today) hiresThisYear++;
  }

  // Repartition par contrat courant (voir requete ci-dessus).
  let cdiCount = 0;
  let cddCount = 0;
  let noContractCount = 0;
  for (const a of employeesForContracts) {
    const current = a.contracts[0];
    if (!current) noContractCount++;
    else if (current.type === ContractType.CDI) cdiCount++;
    else if (current.type === ContractType.CDD) cddCount++;
  }

  const presenceRate =
    employeeCount > 0
      ? Math.round(((employeeCount - onLeaveToday) / employeeCount) * 100)
      : 0;
  const perPct = totalAgents > 0 ? ((perCount / totalAgents) * 100).toFixed(1) : "0";
  const patsPct = totalAgents > 0 ? ((patsCount / totalAgents) * 100).toFixed(1) : "0";
  const evalPct = evalsTotal > 0 ? Math.round((evalsDone / evalsTotal) * 100) : 0;

  // Pyramide des âges : calculée en mémoire à partir des birthDate
  const pyramidData = AGE_BUCKETS.map((b) => {
    let men = 0;
    let women = 0;
    for (const a of agentsForAgePyramid) {
      if (!a.birthDate) continue;
      const age =
        (today.getTime() - a.birthDate.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age >= b.min && age <= b.max) {
        if (a.gender === Gender.HOMME) men++;
        else women++;
      }
    }
    return { range: b.label, men, women };
  });

  // Funnel : on garde l'ordre du pipeline, exclut REJETE
  const stageCount = new Map<ApplicationStage, number>();
  for (const a of appByStage) stageCount.set(a.stage, a._count._all);
  const funnelData = APPLICATION_PIPELINE.map((s) => ({
    stage: APPLICATION_LABEL[s],
    count: stageCount.get(s) ?? 0,
  }));

  // Coût employeur par période (brut + charges patronales)
  const payrollData = payrollsByPeriod.map((p) => ({
    period: p.period,
    total:
      (p._sum.baseSalary ?? 0) +
      (p._sum.bonuses ?? 0) +
      (p._sum.allowances ?? 0) +
      (p._sum.chargesPatronales ?? 0),
  }));

  // Coût employeur par sexe (période courante)
  let menPayroll = 0;
  let womenPayroll = 0;
  for (const r of payrollByGender) {
    const cout =
      r.baseSalary + r.bonuses + r.allowances + r.chargesPatronales;
    if (r.agent.gender === Gender.HOMME) menPayroll += cout;
    else womenPayroll += cout;
  }

  // Répartition par sexe (effectif)
  let menCount = 0;
  let womenCount = 0;
  for (const g of agentsByGender) {
    if (g.gender === Gender.HOMME) menCount += g._count._all;
    else womenCount += g._count._all;
  }

  // Services pour le bar chart
  const serviceData = services.map((s) => ({
    service: s.name,
    count: s._count.agents,
  }));

  // Mise en forme compacte FCFA
  const FCFA = new Intl.NumberFormat("fr-FR");
  const massCout =
    (massLatestPeriod._sum.baseSalary ?? 0) +
    (massLatestPeriod._sum.bonuses ?? 0) +
    (massLatestPeriod._sum.allowances ?? 0) +
    (massLatestPeriod._sum.chargesPatronales ?? 0);
  const compactFcfa = (n: number): string => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Md`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)} K`;
    return FCFA.format(n);
  };
  const periodLabel = (() => {
    if (!latestPeriod) return "—";
    const [y, m] = latestPeriod.period.split("-").map(Number);
    if (!y || !m) return latestPeriod.period;
    const label = new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(new Date(y, m - 1, 1));
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  const moduleStats: Record<string, string> = {
    "/personnel": `${totalAgents} dossiers`,
    "/paie": `${payrollThisPeriod} bulletins`,
    "/conges": `${pendingLeaves} en attente`,
    "/recrutement": `${openPostings} postes`,
    "/formation": `${enrollments} inscrits`,
    "/evaluation": `${evalPct}% réalisées`,
    "/communication": `${announcementCount} annonces`,
    "/conformite": "Archives & RGPD",
  };

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          color="blue"
          icon="users"
          label="Effectif total"
          value={String(totalAgents)}
          hint="Agents présents"
        />
        <KpiCard
          color="purple"
          icon="payroll"
          label="CDI / CDD"
          value={`${cdiCount} / ${cddCount}`}
          hint={`+ ${prestataireCount} prestataire${prestataireCount > 1 ? "s" : ""}${noContractCount > 0 ? ` · ${noContractCount} sans contrat` : ""}`}
        />
        <KpiCard
          color="green"
          icon="payroll"
          label="Coût employeur"
          value={compactFcfa(massCout)}
          hint={`Chargé · ${periodLabel}`}
        />
        <KpiCard
          color="teal"
          icon="evaluation"
          label="Taux de présence"
          value={`${presenceRate}%`}
          hint={`${onLeaveToday} agent(s) en congé`}
        />
        <KpiCard
          color="warning"
          icon="recruitment"
          label={`Entrées ${today.getFullYear()}`}
          value={String(hiresThisYear)}
          hint={`vs ${departuresThisYear} départ${departuresThisYear > 1 ? "s" : ""}`}
        />
      </div>

      {/* Première ligne de graphiques : répartition + services */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Répartition du personnel"
          subtitle="PER · PATS · Prestataires"
        >
          <CategoryDonut
            per={perCount}
            pats={patsCount}
            prestataire={prestataireCount}
          />
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard
            title="Effectif par service"
            subtitle={`Répartition des agents dans les ${serviceData.length} services`}
          >
            <ServiceBarChart data={serviceData} />
          </ChartCard>
        </div>
      </div>

      {/* Deuxième ligne : pyramide + évaluations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Pyramide des âges"
            subtitle="Répartition par tranche d'âge et par sexe"
          >
            <AgePyramidChart buckets={pyramidData} />
          </ChartCard>
        </div>

        <ChartCard
          title="Répartition par sexe"
          subtitle="Effectif hommes / femmes"
        >
          <GenderDonut men={menCount} women={womenCount} />
        </ChartCard>
      </div>

      {/* Troisième ligne : heatmap présence + pipeline recrutement */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Calendrier de présence par service"
            subtitle="20 derniers jours ouvrés"
          >
            <PresenceHeatmap />
          </ChartCard>
        </div>

        <ChartCard
          title="Pipeline de recrutement"
          subtitle="Candidatures par étape"
        >
          {funnelData.some((d) => d.count > 0) ? (
            <RecruitmentFunnel data={funnelData} />
          ) : (
            <ChartEmpty text="Aucune candidature enregistrée." />
          )}
        </ChartCard>
      </div>

      {/* Quatrième ligne : masse salariale (2/3) + répartition par sexe (1/3) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Coût employeur (chargé)"
            subtitle="Évolution mensuelle (FCFA)"
          >
            {payrollData.length >= 2 ? (
              <PayrollEvolution data={payrollData} />
            ) : payrollData.length === 1 ? (
              <ChartEmpty text="Au moins 2 périodes nécessaires pour visualiser l'évolution. Une seule période disponible pour l'instant." />
            ) : (
              <ChartEmpty text="Aucun bulletin de paie généré." />
            )}
          </ChartCard>
        </div>

        <ChartCard
          title="Coût employeur par sexe"
          subtitle="Répartition (période courante)"
        >
          <PayrollByGenderDonut men={menPayroll} women={womenPayroll} />
        </ChartCard>
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

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
      <header className="mb-4">
        <h3 className="font-serif text-[15px] font-semibold text-sc-blue-darker">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11.5px] text-gray-500">{subtitle}</p>
        )}
      </header>
      {children}
    </div>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center px-6 text-center text-[12.5px] text-gray-400">
      {text}
    </div>
  );
}
