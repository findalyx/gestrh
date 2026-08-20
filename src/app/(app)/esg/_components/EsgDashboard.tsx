import Link from "next/link";
import { ESG_METRICS, ESG_SECTION_LABEL } from "../_lib/registry";
import {
  ESG_KPI_GROUPS,
  ESG_TREND_KEYS,
  formatMetric,
  metricFor,
  metricValue,
  type AnswerMap,
} from "../_lib/kpi";
import {
  EsgDiversityBars,
  EsgGenderDonut,
  EsgSparkLine,
} from "./charts/EsgCharts";

export type EsgTrendReport = {
  id: string;
  period: string;
  label: string;
  finalised: boolean;
  answers: AnswerMap;
};

/** "2026-Q2" → "T2 2026" */
function shortPeriod(period: string): string {
  const m = period.match(/^(\d{4})-Q([1-4])$/);
  return m ? `T${m[2]} ${m[1]}` : period;
}

/**
 * Variation entre le trimestre courant et le précédent. Pour un pourcentage on
 * exprime l'écart en points ; sinon en pourcentage relatif.
 */
function delta(
  current: number | null,
  previous: number | null,
  isPercent: boolean,
): { text: string; up: boolean } | null {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (diff === 0) return null;
  const sign = diff > 0 ? "▲" : "▼";
  const abs = Math.abs(diff);
  if (isPercent) {
    return {
      text: `${sign} ${abs.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`,
      up: diff > 0,
    };
  }
  if (previous === 0) {
    return { text: `${sign} ${abs.toLocaleString("fr-FR")}`, up: diff > 0 };
  }
  const pct = Math.abs(Math.round((diff / Math.abs(previous)) * 1000) / 10);
  return {
    text: `${sign} ${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`,
    up: diff > 0,
  };
}

/** Barre de progression d'un pourcentage (0-100). */
function Gauge({ value, color }: { value: number | null; color: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const num = (r: EsgTrendReport, key: string): number | null => {
  const m = metricFor(key);
  return m ? metricValue(m, r.answers) : null;
};

/**
 * Tableau de bord ESG du trimestre sélectionné : complétion du questionnaire,
 * chiffres phares par pilier E/S/G, diversité, tendances, puis le détail par
 * groupe d'indicateurs. Les rapports arrivent du plus ancien au plus récent.
 */
export function EsgDashboard({ reports }: { reports: EsgTrendReport[] }) {
  const current = reports[reports.length - 1];
  const previous = reports.length > 1 ? reports[reports.length - 2] : null;
  const labels = reports.map((r) => shortPeriod(r.period));

  // --- Complétion du questionnaire -------------------------------------
  // Les pourcentages dérivés se calculent seuls : ils ne comptent pas comme
  // des questions à remplir.
  const fillable = ESG_METRICS.filter((m) => !m.derived);
  const answered = fillable.filter(
    (m) => (current.answers[m.key]?.value ?? "").trim() !== "",
  );
  const completion = Math.round((answered.length / fillable.length) * 100);
  const missingBySection = new Map<string, number>();
  for (const m of fillable) {
    if ((current.answers[m.key]?.value ?? "").trim() !== "") continue;
    missingBySection.set(
      m.section,
      (missingBySection.get(m.section) ?? 0) + 1,
    );
  }

  // --- Chiffres phares --------------------------------------------------
  const totalFte = num(current, "dp_total_fte");
  const femaleFte = num(current, "dp_female_fte");
  const pctFemale = num(current, "dp_pct_female_fte");
  const pctYouth = num(current, "dp_pct_youth_fte");
  const pctFemaleSenior = num(current, "dp_pct_female_senior");
  const pctFemaleBoard = num(current, "dp_pct_female_board");
  const pctIndependent = num(current, "dp_pct_independent_board");
  const pctRenewable = num(current, "dp_electricity_renewable_pct");
  const electricity = num(current, "dp_electricity_kwh");

  const diversity = [
    { label: "Femmes (effectif)", value: pctFemale },
    { label: "Femmes cadres", value: pctFemaleSenior },
    { label: "Femmes au conseil", value: pctFemaleBoard },
    { label: "Jeunes 16-25", value: pctYouth },
    { label: "Conseil indépendant", value: pctIndependent },
  ].filter((d): d is { label: string; value: number } => d.value != null);

  const hero: {
    pillar: string;
    accent: string;
    bar: string;
    value: string;
    label: string;
    gauge: number | null;
    caption: string;
  }[] = [
    {
      pillar: "Environnement",
      accent: "text-sc-green-dark",
      bar: "bg-sc-green",
      value: electricity == null ? "—" : `${electricity.toLocaleString("fr-FR")} kWh`,
      label: "Électricité consommée",
      gauge: pctRenewable,
      caption:
        pctRenewable == null
          ? "Part renouvelable non renseignée"
          : `${pctRenewable.toLocaleString("fr-FR")} % d'origine renouvelable`,
    },
    {
      pillar: "Social",
      accent: "text-sc-blue",
      bar: "bg-sc-blue",
      value: totalFte == null ? "—" : totalFte.toLocaleString("fr-FR"),
      label: "Effectif (ETP)",
      gauge: pctFemale,
      caption:
        pctFemale == null
          ? "Part de femmes non renseignée"
          : `${pctFemale.toLocaleString("fr-FR")} % de femmes`,
    },
    {
      pillar: "Gouvernance",
      accent: "text-sc-purple",
      bar: "bg-sc-purple",
      value:
        pctFemaleBoard == null
          ? "—"
          : `${pctFemaleBoard.toLocaleString("fr-FR")} %`,
      label: "Femmes au conseil",
      gauge: pctIndependent,
      caption:
        pctIndependent == null
          ? "Indépendance du conseil non renseignée"
          : `${pctIndependent.toLocaleString("fr-FR")} % de membres indépendants`,
    },
  ];

  return (
    <section className="space-y-4">
      {/* Complétion du questionnaire */}
      <div className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              Complétion du questionnaire
            </p>
            <p className="mt-0.5 font-serif text-xl font-semibold text-sc-blue-darker">
              {completion} %{" "}
              <span className="text-[13px] font-normal text-gray-500">
                · {answered.length} / {fillable.length} indicateurs renseignés
              </span>
            </p>
          </div>
          {missingBySection.size > 0 && (
            <p className="text-[11.5px] text-gray-500">
              Reste à saisir :{" "}
              {[...missingBySection.entries()]
                .map(
                  ([section, n]) =>
                    `${ESG_SECTION_LABEL[section as keyof typeof ESG_SECTION_LABEL]} (${n})`,
                )
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-sc-blue"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      {/* Chiffres phares E / S / G */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {hero.map((h) => (
          <div
            key={h.pillar}
            className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-wider ${h.accent}`}
            >
              {h.pillar}
            </p>
            <p className="mt-1 font-serif text-2xl font-semibold text-sc-blue-darker">
              {h.value}
            </p>
            <p className="text-[11.5px] text-gray-500">{h.label}</p>
            <Gauge value={h.gauge} color={h.bar} />
            <p className="mt-1 text-[11px] text-gray-500">{h.caption}</p>
          </div>
        ))}
      </div>

      {/* Diversité + répartition H/F */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <h4 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500">
            <span className="h-[14px] w-1 rounded bg-sc-purple" />
            Diversité & inclusion
          </h4>
          {diversity.length > 0 ? (
            <EsgDiversityBars items={diversity} />
          ) : (
            <p className="py-10 text-center text-[12px] text-gray-400">
              Aucun indicateur de diversité renseigné pour ce trimestre.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <h4 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500">
            <span className="h-[14px] w-1 rounded bg-sc-blue" />
            Effectif par sexe
          </h4>
          {totalFte != null && femaleFte != null && totalFte >= femaleFte ? (
            <EsgGenderDonut women={femaleFte} men={totalFte - femaleFte} />
          ) : (
            <p className="py-10 text-center text-[12px] text-gray-400">
              Effectif non renseigné.
            </p>
          )}
        </div>
      </div>

      {/* Tendances sur les derniers trimestres */}
      {reports.length > 1 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { key: "dp_total_fte", title: "Effectif (ETP)", color: "blue" as const },
            {
              key: "dp_pct_turnover",
              title: "Turnover (%)",
              color: "teal" as const,
              unit: "%",
            },
            {
              key: "dp_new_students",
              title: "Nouveaux étudiants",
              color: "green" as const,
            },
            {
              key: "dp_total_wages_usd",
              title: "Salaires versés (USD)",
              color: "purple" as const,
              unit: "USD",
            },
          ].map((t) => {
            const values = reports.map((r) => num(r, t.key));
            const hasData = values.some((v) => v != null);
            return (
              <div
                key={t.key}
                className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
              >
                <p className="mb-1 text-[11.5px] font-medium text-sc-blue-darker">
                  {t.title}
                </p>
                {hasData ? (
                  <EsgSparkLine
                    labels={labels}
                    values={values}
                    color={t.color}
                    unit={t.unit}
                  />
                ) : (
                  <p className="py-10 text-center text-[11.5px] text-gray-400">
                    Non renseigné
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Détail par groupe d'indicateurs */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {ESG_KPI_GROUPS.map((group) => (
          <div
            key={group.title}
            className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
          >
            <h4 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500">
              <span className={`h-[14px] w-1 rounded ${group.accent}`} />
              {group.title}
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {group.items.map((item) => {
                const metric = metricFor(item.key);
                const value = metric ? metricValue(metric, current.answers) : null;
                const prev =
                  metric && previous ? metricValue(metric, previous.answers) : null;
                const d = delta(value, prev, metric?.type === "percent");
                return (
                  <div key={item.key}>
                    <p
                      className="text-[10.5px] uppercase leading-tight tracking-wide text-gray-500"
                      title={metric?.labelFr ?? metric?.label ?? item.label}
                    >
                      {item.label}
                    </p>
                    <p className="mt-0.5 font-mono text-[15px] font-semibold text-sc-blue-darker">
                      {formatMetric(metric, value)}
                    </p>
                    {metric?.type === "percent" && (
                      <Gauge value={value} color={group.accent} />
                    )}
                    {d && (
                      <p
                        className={`mt-0.5 text-[10.5px] font-medium ${
                          d.up ? "text-sc-green-dark" : "text-sc-danger"
                        }`}
                      >
                        {d.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Évolution détaillée — repliée pour ne pas alourdir la page */}
      {reports.length > 1 && (
        <details className="rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold text-sc-blue-darker">
            Évolution trimestrielle détaillée
          </summary>
          <div className="overflow-x-auto border-t border-sc-border">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="bg-sc-blue-bg text-left">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                  <th className="px-4 py-3">Indicateur</th>
                  {reports.map((r) => (
                    <th key={r.id} className="px-4 py-3 text-right">
                      {shortPeriod(r.period)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ESG_TREND_KEYS.map((key) => {
                  const metric = metricFor(key);
                  if (!metric) return null;
                  return (
                    <tr key={key} className="border-t border-sc-border">
                      <td className="px-4 py-2.5 text-gray-700" title={metric.label}>
                        {metric.labelFr ?? metric.label}
                      </td>
                      {reports.map((r) => (
                        <td
                          key={r.id}
                          className="px-4 py-2.5 text-right font-mono text-gray-700"
                        >
                          {formatMetric(metric, metricValue(metric, r.answers))}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Rappel : d'où viennent les chiffres */}
      <p className="text-[11.5px] text-gray-500">
        Les indicateurs proviennent du rapport{" "}
        <Link
          href={`/esg/${current.id}`}
          className="font-medium text-sc-blue hover:underline"
        >
          {current.label}
        </Link>{" "}
        — un « — » signale une donnée non encore saisie, jamais une valeur nulle.
      </p>
    </section>
  );
}
