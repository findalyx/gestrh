/** Utilitaires de trimestres ESG (partagés entre pages et actions). */

const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export type QuarterInfo = {
  period: string; // "2026-Q2"
  label: string; // "Avril - Juin 2026"
  startDate: Date;
  endDate: Date;
};

/** q : 1..4 */
export function quarterInfo(year: number, q: number): QuarterInfo {
  const startMonth = (q - 1) * 3; // 0-based
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0); // dernier jour du trimestre
  const label = `${MONTHS_FR[startMonth]} - ${MONTHS_FR[startMonth + 2]} ${year}`;
  return { period: `${year}-Q${q}`, label, startDate, endDate };
}

/** Trimestre courant d'après une date. */
export function currentQuarter(now: Date): { year: number; q: number } {
  return { year: now.getFullYear(), q: Math.floor(now.getMonth() / 3) + 1 };
}

export const QUARTER_LABELS: Record<number, string> = {
  1: "T1 (Jan - Mar)",
  2: "T2 (Avr - Juin)",
  3: "T3 (Juil - Sep)",
  4: "T4 (Oct - Déc)",
};
