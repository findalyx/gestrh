/**
 * Catégorisation de performance sur une note /20 (seuils Université St
 * Christopher) : Excellent ≥ 16, Bon ≥ 12, Moyen ≥ 10, Faible < 10.
 * Fonctions pures, utilisables côté serveur comme client.
 */

export type PerfCategory = "EXCELLENT" | "BON" | "MOYEN" | "FAIBLE";

export const PERF_ORDER: PerfCategory[] = ["EXCELLENT", "BON", "MOYEN", "FAIBLE"];

export function perfCategory(score20: number): PerfCategory {
  if (score20 >= 16) return "EXCELLENT";
  if (score20 >= 12) return "BON";
  if (score20 >= 10) return "MOYEN";
  return "FAIBLE";
}

export const PERF_LABEL: Record<PerfCategory, string> = {
  EXCELLENT: "Excellent",
  BON: "Bon",
  MOYEN: "Moyen",
  FAIBLE: "Faible",
};

export const PERF_STYLE: Record<PerfCategory, string> = {
  EXCELLENT: "bg-sc-green-light text-sc-green-dark",
  BON: "bg-sc-blue-light text-sc-blue",
  MOYEN: "bg-sc-warning-light text-[#854f0b]",
  FAIBLE: "bg-sc-danger-light text-sc-danger",
};

/** Affichage uniforme d'une note (toujours 1 décimale) : 15 → « 15.0 ». */
export function formatScore(n: number): string {
  return n.toFixed(1);
}
