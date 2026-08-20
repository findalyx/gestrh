import Link from "next/link";
import { Role, EsgReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { Icon } from "@/components/Icon";
import { NewReportForm } from "./_components/EsgActions";
import { EsgDashboard } from "./_components/EsgDashboard";
import { currentQuarter } from "./_lib/periods";
import type { AnswerMap } from "./_lib/kpi";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

type SearchParams = { vue?: string; p?: string };

export default async function EsgPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(Role.DIRECTION, Role.DRH, Role.DOYEN);
  const sp = await searchParams;
  const vue: "dashboard" | "rapports" =
    sp.vue === "rapports" ? "rapports" : "dashboard";

  const [reports, org, recent] = await Promise.all([
    prisma.esgReport.findMany({
      orderBy: { period: "desc" },
      include: { _count: { select: { answers: true } } },
    }),
    prisma.organization.findFirst({ select: { usdRate: true } }),
    // Historique récent : sert au tableau de bord (KPI + évolution).
    prisma.esgReport.findMany({
      orderBy: { period: "desc" },
      take: 8,
      select: {
        id: true,
        period: true,
        label: true,
        status: true,
        answers: { select: { metricKey: true, value: true, comment: true } },
      },
    }),
  ]);

  // Du plus ancien au plus récent pour la lecture de l'évolution.
  const history = [...recent].reverse().map((r) => {
    const answers: AnswerMap = {};
    for (const a of r.answers) {
      answers[a.metricKey] = { value: a.value, comment: a.comment };
    }
    return {
      id: r.id,
      period: r.period,
      label: r.label,
      finalised: r.status === EsgReportStatus.FINALISE,
      answers,
    };
  });

  // Trimestre affiché : celui demandé, sinon le plus récent. Le tableau de bord
  // reçoit ce trimestre et les quatre précédents.
  const selectedIndex = sp.p
    ? history.findIndex((r) => r.period === sp.p)
    : history.length - 1;
  const endIndex = selectedIndex >= 0 ? selectedIndex : history.length - 1;
  const trend = history.slice(Math.max(0, endIndex - 4), endIndex + 1);
  const selected = trend[trend.length - 1];

  const now = new Date();
  const { year, q } = currentQuarter(now);
  const years = [year + 1, year, year - 1, year - 2];

  return (
    <div className="space-y-6">
      {/* Onglets : le tableau de bord lit les rapports saisis dans l'autre onglet */}
      <nav className="flex w-fit gap-1 rounded-xl border border-sc-border bg-white p-1">
        <Link
          href="/esg"
          className={`rounded-lg px-4 py-1.5 text-[12.5px] font-medium transition ${
            vue === "dashboard"
              ? "bg-sc-blue text-white"
              : "text-gray-600 hover:bg-sc-blue-bg"
          }`}
        >
          Tableau de bord
        </Link>
        <Link
          href="/esg?vue=rapports"
          className={`rounded-lg px-4 py-1.5 text-[12.5px] font-medium transition ${
            vue === "rapports"
              ? "bg-sc-blue text-white"
              : "text-gray-600 hover:bg-sc-blue-bg"
          }`}
        >
          Rapports ({reports.length})
        </Link>
      </nav>

      {org?.usdRate == null && (
        <div className="flex items-start gap-2 rounded-xl border border-sc-warning/40 bg-sc-warning-light px-4 py-3 text-[12.5px] text-[#854f0b]">
          <Icon name="alert" size={16} />
          <span>
            Le taux de conversion USD n&apos;est pas défini. Les montants en USD
            (salaires) ne seront pas calculés tant que vous ne l&apos;aurez pas
            renseigné dans{" "}
            <Link href="/parametres" className="font-semibold underline">
              Paramètres
            </Link>
            .
          </span>
        </div>
      )}

      {vue === "dashboard" &&
        (selected ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <form method="get" className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="p"
                    className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
                  >
                    Trimestre
                  </label>
                  <select
                    id="p"
                    name="p"
                    defaultValue={selected.period}
                    className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
                  >
                    {[...history].reverse().map((r) => (
                      <option key={r.id} value={r.period}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="rounded-lg border border-sc-border bg-white px-3 py-[9px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Afficher
                </button>
                <span className="pb-2 text-[11.5px] text-gray-500">
                  {selected.finalised ? "Finalisé" : "Brouillon"}
                  {trend.length > 1 &&
                    ` · comparé au trimestre précédent`}
                </span>
              </form>
              <Link
                href={`/esg/${selected.id}`}
                className="pb-2 text-[12px] font-medium text-sc-blue hover:underline"
              >
                Ouvrir le rapport →
              </Link>
            </div>

            <EsgDashboard reports={trend} />
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center text-[12.5px] text-gray-500">
            Aucune donnée à afficher. Créez un rapport dans l&apos;onglet{" "}
            <Link
              href="/esg?vue=rapports"
              className="font-semibold text-sc-blue underline"
            >
              Rapports
            </Link>{" "}
            : les informations saisies alimentent ce tableau de bord.
          </p>
        ))}

      {vue === "rapports" && (
        <>
      <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <h3 className="mb-3 text-[13px] font-semibold text-sc-blue-darker">
          Nouveau rapport trimestriel
        </h3>
        <p className="mb-3 text-[11.5px] text-gray-500">
          Les données RH sont pré-remplies automatiquement ; le reste se saisit à
          la main. Ces réponses alimentent le tableau de bord.
        </p>
        <NewReportForm years={years} defaultYear={year} defaultQuarter={q} />
      </section>

      <section>
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gray-500">
          Rapports ({reports.length})
        </h3>
        {reports.length === 0 ? (
          <p className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center text-[12.5px] text-gray-500">
            Aucun rapport pour l&apos;instant. Créez le premier ci-dessus.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => (
              <Link
                key={r.id}
                href={`/esg/${r.id}`}
                className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)] transition hover:border-sc-blue hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-gray-400">
                    {r.period}
                  </span>
                  {r.status === EsgReportStatus.FINALISE ? (
                    <span className="rounded-full bg-sc-green-light px-2 py-[1px] text-[10px] font-semibold text-sc-green-dark">
                      Finalisé
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-[1px] text-[10px] font-semibold text-amber-700">
                      Brouillon
                    </span>
                  )}
                </div>
                <div className="mt-1 font-serif text-[15px] font-semibold text-sc-blue-darker">
                  {r.label}
                </div>
                <div className="mt-2 text-[11.5px] text-gray-500">
                  {r._count.answers} indicateurs renseignés · créé le{" "}
                  {formatDate(r.createdAt)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
