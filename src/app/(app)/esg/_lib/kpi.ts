import { ESG_METRIC_BY_KEY, type EsgMetric } from "./registry";

export type AnswerMap = Record<string, { value: string; comment: string }>;

/** Convertit une réponse en nombre (virgule décimale tolérée). */
export function numericAnswer(
  answers: AnswerMap,
  key: string,
): number | null {
  const raw = answers[key]?.value;
  if (raw == null) return null;
  const n = Number.parseFloat(String(raw).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Valeur numérique d'un indicateur : les pourcentages « dérivés » sont
 * recalculés depuis leur numérateur et leur dénominateur, comme dans
 * l'éditeur et dans l'export.
 */
export function metricValue(
  metric: EsgMetric,
  answers: AnswerMap,
): number | null {
  if (metric.derived) {
    const num = numericAnswer(answers, metric.derived.num);
    const den = numericAnswer(answers, metric.derived.den);
    if (num == null || den == null || den <= 0) return null;
    return Math.round((num / den) * 1000) / 10;
  }
  return numericAnswer(answers, metric.key);
}

/** Formatage d'affichage d'un indicateur (avec son unité). */
export function formatMetric(
  metric: EsgMetric | undefined,
  value: number | null,
): string {
  if (value == null || !metric) return "—";
  if (metric.type === "percent") {
    return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
  }
  const n = value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return metric.unit ? `${n} ${metric.unit}` : n;
}

export type KpiSpec = {
  key: string;
  /** Libellé court pour la carte (le registre garde la question complète). */
  label: string;
};

export type KpiGroup = {
  title: string;
  accent: string; // classe de couleur de la pastille
  items: KpiSpec[];
};

/**
 * Sélection des indicateurs mis en avant sur le tableau de bord, regroupés par
 * pilier. Tous existent dans le registre : la carte affiche « — » tant que la
 * réponse n'est pas saisie.
 */
export const ESG_KPI_GROUPS: KpiGroup[] = [
  {
    title: "Effectif & diversité",
    accent: "bg-sc-blue",
    items: [
      { key: "dp_total_fte", label: "Effectif (ETP)" },
      { key: "dp_pct_female_fte", label: "Femmes" },
      { key: "dp_pct_youth_fte", label: "Jeunes (16-25)" },
      { key: "dp_pct_female_senior", label: "Femmes cadres" },
    ],
  },
  {
    title: "Gouvernance",
    accent: "bg-sc-purple",
    items: [
      { key: "dp_board_members", label: "Membres du conseil" },
      { key: "dp_pct_female_board", label: "Femmes au conseil" },
      { key: "dp_pct_independent_board", label: "Membres indépendants" },
      { key: "dp_board_meetings", label: "Réunions du conseil" },
    ],
  },
  {
    title: "Emploi & rémunération",
    accent: "bg-sc-teal",
    items: [
      { key: "dp_pct_turnover", label: "Turnover" },
      { key: "dp_new_jobs", label: "Postes créés" },
      { key: "dp_gender_pay_gap", label: "Écart salarial H/F" },
      { key: "dp_pct_above_min_wage", label: "Au-dessus du SMIG" },
    ],
  },
  {
    title: "Environnement",
    accent: "bg-sc-green",
    items: [
      { key: "dp_electricity_kwh", label: "Électricité (kWh)" },
      { key: "dp_electricity_renewable_pct", label: "Part renouvelable" },
      { key: "dp_energy_kwh", label: "Énergie totale (kWh)" },
    ],
  },
  {
    title: "Impact — étudiants",
    accent: "bg-sc-warning",
    items: [
      { key: "dp_new_students", label: "Nouveaux étudiants" },
      { key: "dp_female_enrollments", label: "Inscriptions féminines" },
      { key: "dp_african_enrollments", label: "Inscriptions africaines" },
      { key: "dp_total_graduates", label: "Diplômés (cumul)" },
    ],
  },
  {
    title: "Économie locale",
    accent: "bg-sc-blue",
    items: [
      { key: "dp_total_wages_usd", label: "Salaires versés" },
      { key: "dp_training_spend_usd", label: "Dépenses formation" },
      { key: "dp_pct_local_suppliers", label: "Fournisseurs locaux" },
      { key: "dp_pct_sme_suppliers", label: "Fournisseurs PME" },
    ],
  },
];

/** Indicateurs suivis dans le tableau d'évolution trimestrielle. */
export const ESG_TREND_KEYS = [
  "dp_total_fte",
  "dp_pct_female_fte",
  "dp_pct_turnover",
  "dp_new_jobs",
  "dp_new_students",
  "dp_pct_female_board",
  "dp_electricity_kwh",
  "dp_total_wages_usd",
];

export function metricFor(key: string): EsgMetric | undefined {
  return ESG_METRIC_BY_KEY[key];
}
