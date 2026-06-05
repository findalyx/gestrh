import Link from "next/link";
import { EvaluationStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import {
  getEvaluationScopeWhere,
  getMyPendingEvaluationsWhere,
} from "@/lib/evaluation-access";
import { Icon } from "@/components/Icon";
import {
  formatScore,
  perfCategory,
  PERF_LABEL,
  PERF_ORDER,
  PERF_STYLE,
  type PerfCategory,
} from "@/lib/performance";
import { EvaluationStatusBadge } from "./_components/EvaluationBadge";
import { LaunchCampaignForm } from "./_components/LaunchCampaignForm";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

type SearchParams = { period?: string; perf?: string };

export default async function EvaluationListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const me = await getCurrentUser();
  const sp = await searchParams;
  const { where: scopeWhere, scope } = await getEvaluationScopeWhere();
  const { where: pendingWhere, canEvaluate } = await getMyPendingEvaluationsWhere();

  // Liste des périodes existantes
  const periods = await prisma.evaluation.findMany({
    where: scopeWhere,
    select: { period: true },
    distinct: ["period"],
    orderBy: { period: "desc" },
  });

  const selectedPeriod = sp.period?.trim() || periods[0]?.period;

  const listWhere = selectedPeriod
    ? { AND: [scopeWhere, { period: selectedPeriod }] }
    : scopeWhere;

  const [todo, all, stats] = await Promise.all([
    canEvaluate
      ? prisma.evaluation.findMany({
          where: pendingWhere,
          orderBy: { dueDate: "asc" },
          include: {
            agent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                matricule: true,
                service: { select: { name: true } },
              },
            },
          },
          take: 50,
        })
      : Promise.resolve([]),
    prisma.evaluation.findMany({
      where: listWhere,
      orderBy: [{ period: "desc" }, { agent: { lastName: "asc" } }],
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            service: { select: { name: true } },
          },
        },
        evaluator: {
          select: { firstName: true, lastName: true },
        },
      },
      take: 500,
    }),
    selectedPeriod
      ? Promise.all([
          prisma.evaluation.count({
            where: { period: selectedPeriod },
          }),
          prisma.evaluation.count({
            where: { period: selectedPeriod, status: EvaluationStatus.TERMINEE },
          }),
        ])
      : Promise.resolve([0, 0]),
  ]);

  const [totalForPeriod, doneForPeriod] = stats as [number, number];
  const completionPct =
    totalForPeriod > 0 ? Math.round((doneForPeriod / totalForPeriod) * 100) : 0;

  // Répartition par catégorie de performance (sur les notes saisies)
  const scored = all.filter((e) => e.overallScore !== null);
  const perfCounts: Record<PerfCategory, number> = {
    EXCELLENT: 0,
    BON: 0,
    MOYEN: 0,
    FAIBLE: 0,
  };
  for (const e of scored) perfCounts[perfCategory(e.overallScore as number)]++;
  const avgScore =
    scored.length > 0
      ? scored.reduce((s, e) => s + (e.overallScore as number), 0) /
        scored.length
      : 0;

  // Filtre par catégorie de performance (appliqué au tableau, pas aux stats)
  const perfFilter = PERF_ORDER.includes(sp.perf as PerfCategory)
    ? (sp.perf as PerfCategory)
    : undefined;
  const displayed = perfFilter
    ? all.filter(
        (e) =>
          e.overallScore !== null &&
          perfCategory(e.overallScore) === perfFilter,
      )
    : all;

  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  const now = new Date();
  const defaultYear = String(now.getFullYear());

  // Filtres actifs (pour proposer la réinitialisation)
  const filtersActive = Boolean(perfFilter || sp.period);

  return (
    <div className="space-y-6">
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {periods.length > 0 && (
            <form method="get" className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="period"
                  className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
                >
                  Période
                </label>
                <select
                  id="period"
                  name="period"
                  defaultValue={selectedPeriod ?? ""}
                  className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
                >
                  {periods.map((p) => (
                    <option key={p.period} value={p.period}>
                      Campagne {p.period}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="perf"
                  className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
                >
                  Performance
                </label>
                <select
                  id="perf"
                  name="perf"
                  defaultValue={perfFilter ?? ""}
                  className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
                >
                  <option value="">Toutes</option>
                  {PERF_ORDER.map((cat) => (
                    <option key={cat} value={cat}>
                      {PERF_LABEL[cat]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-lg border border-sc-border bg-white px-3 py-[9px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Filtrer
              </button>
              {filtersActive && (
                <Link
                  href="/evaluation"
                  className="rounded-lg px-3 py-[9px] text-[12.5px] font-medium text-gray-500 transition hover:text-sc-danger"
                >
                  Réinitialiser
                </Link>
              )}
            </form>
          )}
        </div>

        {isAdmin && (
          <details className="rounded-xl border border-sc-border bg-white p-4">
            <summary className="cursor-pointer text-[12.5px] font-semibold text-sc-blue-darker">
              + Lancer une campagne
            </summary>
            <div className="mt-3">
              <LaunchCampaignForm defaultYear={defaultYear} />
            </div>
          </details>
        )}
      </div>

      {/* Statistiques de campagne pour la période sélectionnée */}
      {isAdmin && selectedPeriod && totalForPeriod > 0 && (
        <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-serif text-base font-semibold text-sc-blue-darker">
              Campagne {selectedPeriod}
            </h3>
            <p className="text-[12.5px] text-gray-600">
              <span className="font-semibold text-sc-blue-darker">
                {doneForPeriod}
              </span>{" "}
              / {totalForPeriod} évaluations finalisées
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full transition-all ${
                completionPct === 100 ? "bg-sc-green" : "bg-sc-blue"
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11.5px] text-gray-500">
            {completionPct}% de la campagne réalisée
          </p>
        </div>
      )}

      {/* Statistiques de performance (notes saisies) */}
      {scored.length > 0 && (
        <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-serif text-base font-semibold text-sc-blue-darker">
              Répartition des performances
            </h3>
            <p className="text-[12.5px] text-gray-600">
              Moyenne&nbsp;:{" "}
              <span className="font-semibold text-sc-blue-darker">
                {formatScore(avgScore)}
              </span>
              <span className="text-gray-400">/20</span> · {scored.length} note
              {scored.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PERF_ORDER.map((cat) => {
              const n = perfCounts[cat];
              const pct =
                scored.length > 0 ? Math.round((n / scored.length) * 100) : 0;
              return (
                <div
                  key={cat}
                  className="rounded-lg border border-sc-border bg-gray-50/60 p-3"
                >
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${PERF_STYLE[cat]}`}
                  >
                    {PERF_LABEL[cat]}
                  </span>
                  <p className="mt-2 text-xl font-semibold text-sc-blue-darker">
                    {n}
                  </p>
                  <p className="text-[11.5px] text-gray-500">{pct}%</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-gray-400">
            Seuils (sur 20)&nbsp;: Excellent ≥ 16 · Bon ≥ 12 · Moyen ≥ 10 ·
            Faible &lt; 10.
          </p>
        </div>
      )}

      {/* À évaluer (manager) */}
      {canEvaluate && todo.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-warning" />
            À évaluer ({todo.length})
          </h3>
          <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="bg-sc-blue-bg text-left">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Période</th>
                  <th className="px-4 py-3">Échéance</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {todo.map((e) => (
                  <tr key={e.id} className="border-t border-sc-border">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-sc-blue-darker">
                        {e.agent.lastName.toUpperCase()} {e.agent.firstName}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {e.agent.service.name} · {e.agent.matricule}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{e.period}</td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {formatDate(e.dueDate)}
                    </td>
                    <td className="px-4 py-2.5">
                      <EvaluationStatusBadge
                        status={e.status}
                        dueDate={e.dueDate}
                        completedAt={e.completedAt}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/evaluation/${e.id}`}
                        className="rounded-lg bg-sc-blue px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-sc-blue-dark"
                      >
                        Évaluer →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Liste complète (filtrée par scope + période) */}
      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-teal" />
          {scope === "SELF"
            ? "Mes évaluations"
            : scope === "TEAM"
              ? "Évaluations de l'équipe"
              : "Toutes les évaluations"}{" "}
          ({displayed.length}
          {perfFilter ? ` / ${all.length}` : ""})
          {perfFilter && (
            <span
              className={`ml-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${PERF_STYLE[perfFilter]}`}
            >
              {PERF_LABEL[perfFilter]}
            </span>
          )}
        </h3>

        {displayed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center">
            <Icon name="evaluation" size={20} className="mx-auto text-gray-300" />
            <p className="mt-2 text-[13px] text-gray-500">
              {perfFilter
                ? `Aucune évaluation « ${PERF_LABEL[perfFilter]} » pour cette période.`
                : "Aucune évaluation pour cette période."}
            </p>
            {isAdmin && !perfFilter && (
              <p className="mt-2 text-[12px] text-gray-500">
                Lancez une campagne via le bouton « + Lancer une campagne » ci-dessus.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="bg-sc-blue-bg text-left">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                  {scope !== "SELF" && <th className="px-4 py-3">Agent</th>}
                  <th className="px-4 py-3">Période</th>
                  <th className="px-4 py-3">Évaluateur</th>
                  <th className="px-4 py-3">Échéance</th>
                  <th className="px-4 py-3 text-center">Note</th>
                  <th className="px-4 py-3">Catégorie performance</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((e) => (
                  <tr key={e.id} className="border-t border-sc-border">
                    {scope !== "SELF" && (
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/personnel/${e.agent.id}`}
                          className="font-medium text-sc-blue-darker hover:underline"
                        >
                          {e.agent.lastName.toUpperCase()} {e.agent.firstName}
                        </Link>
                        <p className="text-[11px] text-gray-500">
                          {e.agent.service.name}
                        </p>
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-gray-700">{e.period}</td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-600">
                      {e.evaluator
                        ? `${e.evaluator.firstName} ${e.evaluator.lastName.charAt(0)}.`
                        : <span className="text-gray-400">non désigné</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {formatDate(e.dueDate)}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono">
                      {e.overallScore !== null ? (
                        <>
                          {formatScore(e.overallScore)}
                          <span className="text-[11px] text-gray-400">/20</span>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.overallScore !== null ? (
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            PERF_STYLE[perfCategory(e.overallScore)]
                          }`}
                        >
                          {PERF_LABEL[perfCategory(e.overallScore)]}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <EvaluationStatusBadge
                        status={e.status}
                        dueDate={e.dueDate}
                        completedAt={e.completedAt}
                      />
                      {e.highPotential && (
                        <span className="ml-1.5 inline-flex rounded-full bg-sc-purple-light px-1.5 py-[1px] text-[9.5px] font-semibold uppercase text-sc-purple">
                          ★ HP
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/evaluation/${e.id}`}
                        className="text-[12px] font-medium text-sc-blue hover:underline"
                      >
                        Voir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
