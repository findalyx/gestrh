/**
 * Calcul de paie selon les barèmes sénégalais simplifiés.
 *
 * Sources (millésime 2024-2025) :
 *   - Caisse de Sécurité Sociale (CSS) — Sénégal
 *   - Institut de Prévoyance Retraite du Sénégal (IPRES)
 *   - Code Général des Impôts — Article 178 et suiv.
 *
 * ⚠️ Implémentation simplifiée : à valider avec un comptable agréé avant
 *    toute production. Les barèmes ne tiennent pas compte de toutes les
 *    spécificités (TRIMF par part, exonérations, plafonds spécifiques aux
 *    indemnités, etc.).
 */

// ============================================================
//  CONSTANTES
// ============================================================

// IPRES Régime Général — toute la population salariale
export const IPRES_RG_PLAFOND_MENSUEL = 432_000; // FCFA
export const IPRES_RG_TAUX_SAL = 0.056; // 5,60 %
export const IPRES_RG_TAUX_PAT = 0.084; // 8,40 %

// IPRES Régime Complémentaire Cadre — cadres uniquement
export const IPRES_RC_PLAFOND_MENSUEL = 1_296_000; // FCFA
export const IPRES_RC_TAUX_SAL = 0.024; // 2,40 %
export const IPRES_RC_TAUX_PAT = 0.036; // 3,60 %

// CFCE — Contribution Forfaitaire à la Charge des Employeurs
export const CFCE_TAUX_PAT = 0.03; // 3 %

// CSS — Caisse de Sécurité Sociale
export const CSS_PLAFOND_MENSUEL = 63_000; // FCFA
export const CSS_ACCIDENT_TAUX_PAT = 0.01; // 1 % (varie 1-5 % selon risque)
export const CSS_ALLOC_FAM_TAUX_PAT = 0.07; // 7 %

// Indemnité de transport — fixée par usage, exonérée
export const INDEMNITE_TRANSPORT_MENSUEL = 26_000; // FCFA

// TRIMF (Taxe Représentative Impôt Minimum Fiscal) — montant forfaitaire
export const TRIMF_FORFAIT_MENSUEL = 3_000; // FCFA (simplification ; en réalité 6 tranches)

// Barème progressif annuel de l'IR (Impôt sur le Revenu)
export const IR_BAREME_ANNUEL: { limit: number; rate: number }[] = [
  { limit: 630_000, rate: 0 },
  { limit: 1_500_000, rate: 0.2 },
  { limit: 4_000_000, rate: 0.3 },
  { limit: 8_000_000, rate: 0.35 },
  { limit: 13_500_000, rate: 0.37 },
  { limit: Infinity, rate: 0.4 },
];

// ============================================================
//  TYPES
// ============================================================

export type PayrollLine = {
  code: string;
  label: string;
  nbre?: number;
  base?: number;
  tauxSal?: number; // %
  gainSal?: number; // FCFA — gains non imposables (indemnités…)
  retenueSal?: number; // FCFA — gains imposables et retenues
  tauxPat?: number; // %
  retenuePat?: number; // FCFA
  bold?: boolean;
  separator?: boolean; // ligne de total
};

export type FullPayroll = {
  lines: PayrollLine[];
  totalBrut: number;
  totalCotisSal: number;
  totalCotisPat: number;
  totalGainsNonImposables: number;
  brutSocial: number;
  avantageEnNature: number;
  brutFiscal: number;
  droitsConges: number; // valorisation
  netAPayer: number;
};

// ============================================================
//  HELPERS
// ============================================================

function round(n: number): number {
  return Math.round(n);
}

/**
 * Calcule l'IR (Impôt sur le Revenu) progressif à partir du salaire net
 * imposable mensuel. Annualisé puis ramené au mois.
 */
function computeIR(monthlyTaxable: number): number {
  const annual = monthlyTaxable * 12;
  let tax = 0;
  let remaining = annual;
  let prevLimit = 0;
  for (const b of IR_BAREME_ANNUEL) {
    const slice = Math.min(remaining, b.limit - prevLimit);
    if (slice <= 0) break;
    tax += slice * b.rate;
    remaining -= slice;
    prevLimit = b.limit;
    if (remaining <= 0) break;
  }
  return round(tax / 12);
}

// ============================================================
//  CALCUL COMPLET
// ============================================================

/**
 * Calcule l'ensemble du bulletin à partir des éléments minimaux.
 */
export function computeFullPayroll(args: {
  baseSalary: number; // salaire de base mensuel
  sursalaire?: number; // sursalaire (primes contractuelles fixes)
  isCadre: boolean;
  nbreJoursTravailles?: number;
  withTransport?: boolean;
}): FullPayroll {
  const baseSalary = args.baseSalary;
  const sursalaire = args.sursalaire ?? 0;
  const nbreJours = args.nbreJoursTravailles ?? 30;
  const withTransport = args.withTransport ?? true;

  const totalBrut = baseSalary + sursalaire;

  // IPRES RG (tous)
  const ipresRgBase = Math.min(totalBrut, IPRES_RG_PLAFOND_MENSUEL);
  const ipresRgSal = round(ipresRgBase * IPRES_RG_TAUX_SAL);
  const ipresRgPat = round(ipresRgBase * IPRES_RG_TAUX_PAT);

  // IPRES RC (cadres seulement)
  const ipresRcBase = args.isCadre ? Math.min(totalBrut, IPRES_RC_PLAFOND_MENSUEL) : 0;
  const ipresRcSal = args.isCadre ? round(ipresRcBase * IPRES_RC_TAUX_SAL) : 0;
  const ipresRcPat = args.isCadre ? round(ipresRcBase * IPRES_RC_TAUX_PAT) : 0;

  // CFCE (employeur)
  const cfcePat = round(totalBrut * CFCE_TAUX_PAT);

  // CSS (employeur, plafonné)
  const cssBase = Math.min(totalBrut, CSS_PLAFOND_MENSUEL);
  const cssAccPat = round(cssBase * CSS_ACCIDENT_TAUX_PAT);
  const cssAllocPat = round(cssBase * CSS_ALLOC_FAM_TAUX_PAT);

  // TRIMF
  const trimf = TRIMF_FORFAIT_MENSUEL;

  // IR — base imposable mensuelle = brut − IPRES salarial
  const baseImposable = Math.max(0, totalBrut - ipresRgSal - ipresRcSal);
  const ir = computeIR(baseImposable);

  // Indemnité de transport (non imposable)
  const indemniteTransport = withTransport ? INDEMNITE_TRANSPORT_MENSUEL : 0;

  // Totaux
  const totalCotisSal = ipresRgSal + ipresRcSal + trimf + ir;
  const totalCotisPat = ipresRgPat + ipresRcPat + cfcePat + cssAccPat + cssAllocPat;
  const totalGainsNonImposables = indemniteTransport;

  const netAPayer = totalBrut - totalCotisSal + totalGainsNonImposables;

  // Footer
  const brutSocial = totalBrut;
  const avantageEnNature = 0;
  const brutFiscal = totalBrut;
  // Droits congés : provision = ~2j/mois × salaire jour × 12 = brut × 12 × 2/30
  const droitsConges = round((totalBrut * 12 * 2) / 30);

  const lines: PayrollLine[] = [];

  // Ligne 1 — Salaire de base
  lines.push({
    code: "0010",
    label: "Salaire de base mensuel",
    nbre: nbreJours,
    base: baseSalary / 30,
    retenueSal: baseSalary,
  });

  // Ligne 2 — Sursalaire (si > 0)
  if (sursalaire > 0) {
    lines.push({
      code: "0025",
      label: "Sursalaire",
      retenueSal: sursalaire,
    });
  }

  // Total Brut
  lines.push({
    code: "",
    label: "Total Brut",
    retenueSal: totalBrut,
    bold: true,
    separator: true,
  });

  // Cotisations
  lines.push({
    code: "1000",
    label: "IPRES Régime général",
    base: ipresRgBase,
    tauxSal: IPRES_RG_TAUX_SAL * 100,
    retenueSal: ipresRgSal,
    tauxPat: IPRES_RG_TAUX_PAT * 100,
    retenuePat: ipresRgPat,
  });

  if (args.isCadre) {
    lines.push({
      code: "1010",
      label: "IPRES Régime compl. cadre",
      base: ipresRcBase,
      tauxSal: IPRES_RC_TAUX_SAL * 100,
      retenueSal: ipresRcSal,
      tauxPat: IPRES_RC_TAUX_PAT * 100,
      retenuePat: ipresRcPat,
    });
  }

  lines.push({
    code: "1020",
    label: "Ret. TRIMF",
    nbre: 1,
    retenueSal: trimf,
  });

  lines.push({
    code: "1030",
    label: "Ret. Impôts sur le revenu",
    retenueSal: ir,
  });

  lines.push({
    code: "1035",
    label: "Contribution forfaitaire (CFCE)",
    base: totalBrut,
    tauxPat: CFCE_TAUX_PAT * 100,
    retenuePat: cfcePat,
  });

  lines.push({
    code: "1040",
    label: "CSS Accident du travail",
    base: cssBase,
    tauxPat: CSS_ACCIDENT_TAUX_PAT * 100,
    retenuePat: cssAccPat,
  });

  lines.push({
    code: "1050",
    label: "CSS Allocations familiales",
    base: cssBase,
    tauxPat: CSS_ALLOC_FAM_TAUX_PAT * 100,
    retenuePat: cssAllocPat,
  });

  lines.push({
    code: "",
    label: "Total cotisations",
    retenueSal: totalCotisSal,
    retenuePat: totalCotisPat,
    bold: true,
    separator: true,
  });

  // Indemnités non imposables
  if (indemniteTransport > 0) {
    lines.push({
      code: "2512",
      label: "Indemnité de transport",
      nbre: nbreJours,
      base: indemniteTransport / nbreJours,
      gainSal: indemniteTransport,
    });
  }

  return {
    lines,
    totalBrut,
    totalCotisSal,
    totalCotisPat,
    totalGainsNonImposables,
    brutSocial,
    avantageEnNature,
    brutFiscal,
    droitsConges,
    netAPayer,
  };
}

/**
 * Heuristique simple pour déterminer si un agent est "cadre" au sens IPRES :
 *   - tous les agents PER (enseignement/recherche)
 *   - les PATS avec un salaire de base ≥ 300 000 FCFA
 */
export function isCadre(args: {
  category: string;
  baseSalary: number;
}): boolean {
  if (args.category === "PER") return true;
  return args.baseSalary >= 300_000;
}
