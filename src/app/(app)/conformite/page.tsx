import Link from "next/link";
import {
  AgentStatus,
  ContractStatus,
  EvaluationStatus,
  Role,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { Icon } from "@/components/Icon";
import { KpiCard } from "@/components/KpiCard";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

const DOC_TYPE_LABEL: Record<string, string> = {
  CONTRAT: "Contrat",
  DIPLOME: "Diplôme",
  CERTIFICATION: "Certification",
  BULLETIN_PAIE: "Bulletin de paie",
  JUSTIFICATIF: "Justificatif",
  AUTRE: "Autre",
};

const DOC_TYPE_STYLE: Record<string, string> = {
  CONTRAT: "bg-sc-blue-light text-sc-blue",
  DIPLOME: "bg-sc-purple-light text-sc-purple",
  CERTIFICATION: "bg-sc-teal-light text-sc-teal-dark",
  BULLETIN_PAIE: "bg-sc-green-light text-sc-green-dark",
  JUSTIFICATIF: "bg-sc-warning-light text-[#854f0b]",
  AUTRE: "bg-gray-100 text-gray-600",
};

type SearchParams = {
  action?: string;
  entity?: string;
  user?: string;
  days?: string;
};

export default async function ConformitePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(Role.DIRECTION, Role.DRH);
  const sp = await searchParams;

  const days = Math.max(1, Math.min(365, Number.parseInt(sp.days ?? "30", 10) || 30));
  const since = new Date();
  since.setDate(since.getDate() - days);

  const auditWhere: Prisma.AuditLogWhereInput = { createdAt: { gte: since } };
  if (sp.action) auditWhere.action = { contains: sp.action.toUpperCase() };
  if (sp.entity) auditWhere.entity = sp.entity;
  if (sp.user) auditWhere.user = { email: { contains: sp.user, mode: "insensitive" } };

  const [
    auditLogs,
    auditCount,
    distinctActions,
    distinctEntities,
    distinctUsers,
    documents,
    docCount,
    docByType,
    activeAgents,
    activeContracts,
    expiringContracts,
    evalCompletedPct,
  ] = await Promise.all([
    prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, role: true } } },
      take: 100,
    }),
    prisma.auditLog.count({ where: auditWhere }),
    prisma.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      select: { entity: true },
      distinct: ["entity"],
      orderBy: { entity: "asc" },
    }),
    prisma.user.findMany({
      select: { email: true },
      orderBy: { email: "asc" },
    }),
    prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        agent: {
          select: { firstName: true, lastName: true, matricule: true },
        },
      },
      take: 100,
    }),
    prisma.document.count(),
    prisma.document.groupBy({
      by: ["type"],
      _count: { _all: true },
    }),
    prisma.agent.count({ where: { status: AgentStatus.ACTIF } }),
    prisma.contract.count({ where: { status: ContractStatus.ACTIF } }),
    prisma.contract.count({
      where: {
        status: ContractStatus.ACTIF,
        endDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 60 * 24 * 3600 * 1000),
        },
      },
    }),
    (async () => {
      const total = await prisma.evaluation.count();
      const done = await prisma.evaluation.count({
        where: { status: EvaluationStatus.TERMINEE },
      });
      return total > 0 ? Math.round((done / total) * 100) : 0;
    })(),
  ]);

  const conformContractsPct =
    activeAgents > 0 ? Math.round((activeContracts / activeAgents) * 100) : 0;

  return (
    <div className="space-y-6">
      <p className="text-[12.5px] text-gray-600">
        Indicateurs de conformité, journal d&apos;audit et archivage des documents
        RH (Code du travail sénégalais, RGPD).
      </p>

      {/* Tuiles indicateurs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          color="blue"
          icon="compliance"
          label="Conformité contrats"
          value={`${conformContractsPct}%`}
          hint={`${activeContracts} / ${activeAgents} actifs avec contrat`}
        />
        <KpiCard
          color="warning"
          icon="alert"
          label="Contrats à échéance"
          value={String(expiringContracts)}
          hint="Sous 60 jours"
        />
        <KpiCard
          color="purple"
          icon="evaluation"
          label="Évaluations finalisées"
          value={`${evalCompletedPct}%`}
          hint="Toutes campagnes"
        />
        <KpiCard
          color="teal"
          icon="export"
          label="Documents archivés"
          value={String(docCount)}
          hint="Toutes catégories"
        />
      </div>

      {/* Journal d'audit */}
      <section className="space-y-3">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-blue" />
            Journal d&apos;audit ({auditCount} action{auditCount > 1 ? "s" : ""} sur {days} j)
          </h3>
          <p className="text-[11.5px] text-gray-500">
            Toutes les actions sensibles sont tracées · §5.9 conformité
          </p>
        </header>

        {/* Filtres */}
        <form
          method="get"
          className="flex flex-wrap items-end gap-2 rounded-xl border border-sc-border bg-white p-3 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
        >
          <FilterSelect name="days" label="Période" defaultValue={String(days)}>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
            <option value="365">Année</option>
          </FilterSelect>
          <FilterSelect name="action" label="Action" defaultValue={sp.action ?? ""}>
            <option value="">Toutes</option>
            {distinctActions.map((a) => (
              <option key={a.action} value={a.action}>
                {a.action}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect name="entity" label="Entité" defaultValue={sp.entity ?? ""}>
            <option value="">Toutes</option>
            {distinctEntities.map((e) => (
              <option key={e.entity} value={e.entity}>
                {e.entity}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect name="user" label="Utilisateur" defaultValue={sp.user ?? ""}>
            <option value="">Tous</option>
            {distinctUsers.map((u) => (
              <option key={u.email} value={u.email}>
                {u.email}
              </option>
            ))}
          </FilterSelect>
          <button
            type="submit"
            className="rounded-lg border border-sc-border bg-white px-3 py-[8px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Filtrer
          </button>
          {(sp.action || sp.entity || sp.user || days !== 30) && (
            <Link
              href="/conformite"
              className="rounded-lg border border-sc-border bg-white px-3 py-[8px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Réinitialiser
            </Link>
          )}
        </form>

        <div className="overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Icon name="compliance" size={20} className="mx-auto text-gray-300" />
              <p className="mt-2 text-[13px] text-gray-500">
                Aucune action enregistrée pour ces critères.
              </p>
            </div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="bg-sc-blue-bg text-left">
                <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Utilisateur</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Entité</th>
                  <th className="px-4 py-2.5">Détails</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((l) => (
                  <tr key={l.id} className="border-t border-sc-border">
                    <td className="px-4 py-2 text-[11.5px] text-gray-600 whitespace-nowrap">
                      {formatDateTime(l.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      {l.user ? (
                        <>
                          <span className="font-mono text-[11.5px] text-gray-700">
                            {l.user.email}
                          </span>
                          <span className="ml-1 rounded-full bg-sc-blue-light px-1.5 py-[1px] text-[9.5px] font-semibold uppercase text-sc-blue">
                            {l.user.role}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">système</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-sc-blue-darker">
                      {l.action}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{l.entity}</td>
                    <td className="px-4 py-2 text-[11.5px] text-gray-600">
                      {l.details ? (
                        <span className="line-clamp-2" title={l.details}>
                          {l.details}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Documents archivés */}
      <section className="space-y-3">
        <header>
          <h3 className="flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-teal" />
            Documents archivés
          </h3>
          <p className="mt-1 text-[11.5px] text-gray-500">
            Conservation conforme au Code du travail sénégalais
          </p>
        </header>

        {/* Répartition par type */}
        {docByType.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {docByType.map((d) => (
              <div
                key={d.type}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11.5px] ${DOC_TYPE_STYLE[d.type] ?? "bg-gray-100 text-gray-600"}`}
              >
                <span className="font-medium">{DOC_TYPE_LABEL[d.type] ?? d.type}</span>
                <span className="font-mono">{d._count._all}</span>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          {documents.length === 0 ? (
            <div className="p-8 text-center">
              <Icon name="compliance" size={20} className="mx-auto text-gray-300" />
              <p className="mt-2 text-[13px] text-gray-500">
                Aucun document archivé pour le moment.
              </p>
              <p className="mt-1 text-[11.5px] text-gray-400">
                L&apos;upload de documents sera ajouté dans une prochaine version.
              </p>
            </div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="bg-sc-blue-bg text-left">
                <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Titre</th>
                  <th className="px-4 py-2.5">Agent concerné</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5 text-right">Lien</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-t border-sc-border">
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider ${DOC_TYPE_STYLE[d.type] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {DOC_TYPE_LABEL[d.type] ?? d.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-800">{d.title}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {d.agent ? (
                        <>
                          {d.agent.lastName.toUpperCase()} {d.agent.firstName}
                          <span className="ml-1 font-mono text-[10.5px] text-gray-500">
                            · {d.agent.matricule}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[11.5px] text-gray-600">
                      {formatDateTime(d.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11.5px] font-medium text-sc-blue hover:underline"
                      >
                        Ouvrir ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={name}
        className="text-[10.5px] font-medium uppercase tracking-wide text-gray-500"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="rounded-lg border border-sc-border bg-gray-50 px-2.5 py-[7px] text-[12.5px] outline-none focus:border-sc-blue focus:bg-white"
      >
        {children}
      </select>
    </div>
  );
}
