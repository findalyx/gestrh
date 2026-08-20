import Link from "next/link";
import {
  ESG_KPI_GROUPS,
  ESG_TREND_KEYS,
  formatMetric,
  metricFor,
  metricValue,
  type AnswerMap,
} from "../_lib/kpi";

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
): { text: string; positive: boolean } | null {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (diff === 0) return null;
  const sign = diff > 0 ? "+" : "−";
  const abs = Math.abs(diff);
  if (isPercent) {
    return {
      text: `${sign}${abs.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`,
      positive: diff > 0,
    };
  }
  if (previous === 0) {
    return { text: `${sign}${abs.toLocaleString("fr-FR")}`, positive: diff > 0 };
  }
  const pct = Math.round((diff / Math.abs(previous)) * 1000) / 10;
  return {
    text: `${sign}${Math.abs(pct).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`,
    positive: diff > 0,
  };
}

/**
 * Tableau de bord ESG : indicateurs clés du dernier trimestre renseigné,
 * comparés au trimestre précédent, puis évolution sur les derniers trimestres.
 * Les rapports sont fournis du plus ancien au plus récent.
 */
export function EsgDashboard({ reports }: { reports: EsgTrendReport[] }) {
  const current = reports[reports.length - 1];
  const previous = reports.length > 1 ? reports[reports.length - 2] : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-serif text-[15px] font-semibold text-sc-blue-darker">
            Tableau de bord ESG
          </h3>
          <p className="text-[11.5px] text-gray-500">
            {current.label} · {current.finalised ? "finalisé" : "brouillon"}
            {previous && ` · comparé à ${shortPeriod(previous.period)}`}
          </p>
        </div>
        <Link
          href={`/esg/${current.id}`}
          className="text-[12px] font-medium text-sc-blue hover:underline"
        >
          Ouvrir le rapport →
        </Link>
      </div>

      {/* Cartes par pilier */}
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
                      className="truncate text-[10.5px] uppercase tracking-wide text-gray-500"
                      title={metric?.labelFr ?? metric?.label ?? item.label}
                    >
                      {item.label}
                    </p>
                    <p className="mt-0.5 font-mono text-[15px] font-semibold text-sc-blue-darker">
                      {formatMetric(metric, value)}
                    </p>
                    {d && (
                      <p
                        className={`text-[10.5px] font-medium ${
                          d.positive ? "text-sc-green-dark" : "text-sc-danger"
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

      {/* Évolution trimestrielle */}
      {reports.length > 1 && (
        <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
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
                    <td
                      className="px-4 py-2.5 text-gray-700"
                      title={metric.label}
                    >
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
      )}
    </section>
  );
}
