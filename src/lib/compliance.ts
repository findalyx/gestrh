/**
 * Vérifications de conformité contractuelle (droit du travail sénégalais).
 * Calculs purs basés sur la fiche agent récupérée par getAgentDetail.
 */
import {
  ContractStatus,
  ContractType,
  StaffCategory,
} from "@prisma/client";
import type { AgentDetail } from "@/lib/personnel";

export type ComplianceCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "na";
  detail: string;
};

const DAY_MS = 86_400_000;

/** Durée maximale légale d'une suite de CDD : 2 ans (article L.43 du code du travail). */
const CDD_MAX_CUMULATIVE_DAYS = 2 * 365;
/** Nombre maximal de renouvellements consécutifs d'un CDD. */
const CDD_MAX_RENEWALS = 2;
/** Durée de période d'essai légale (en jours) selon la catégorie. */
const PROBATION_MAX_DAYS: Record<StaffCategory, number> = {
  PER: 180, // 6 mois
  PATS: 90, // 3 mois
};

export function runChecks(agent: AgentDetail): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  const activeContract = agent.contracts.find((c) => c.status === ContractStatus.ACTIF);
  const cddContracts = agent.contracts
    .filter((c) => c.type === ContractType.CDD)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // --- 1) Durée cumulée des CDD ---------------------------------
  if (cddContracts.length === 0) {
    checks.push({
      id: "cdd-cumul",
      label: "Durée cumulée des CDD",
      status: "na",
      detail: "Aucun CDD au dossier.",
    });
  } else {
    const cumulMs = cddContracts.reduce((acc, c) => {
      const end = c.endDate ?? new Date();
      return acc + Math.max(0, end.getTime() - c.startDate.getTime());
    }, 0);
    const cumulDays = Math.round(cumulMs / DAY_MS);
    const ratio = cumulDays / CDD_MAX_CUMULATIVE_DAYS;
    let status: ComplianceCheck["status"];
    if (ratio > 1) status = "fail";
    else if (ratio > 0.85) status = "warn";
    else status = "pass";
    checks.push({
      id: "cdd-cumul",
      label: "Durée cumulée des CDD",
      status,
      detail: `${cumulDays} jours cumulés (plafond légal : ${CDD_MAX_CUMULATIVE_DAYS} jours / 2 ans).`,
    });
  }

  // --- 2) Renouvellements successifs ----------------------------
  const renewals = agent.contracts
    .map((c) => c.renewal)
    .filter((r): r is NonNullable<typeof r> => r !== null && r !== undefined)
    .filter((r) => r.decision === "RENOUVELE");
  let renewalStatus: ComplianceCheck["status"];
  if (renewals.length > CDD_MAX_RENEWALS) renewalStatus = "fail";
  else if (renewals.length === CDD_MAX_RENEWALS) renewalStatus = "warn";
  else renewalStatus = "pass";
  checks.push({
    id: "cdd-renewals",
    label: "Renouvellements consécutifs",
    status: cddContracts.length > 0 ? renewalStatus : "na",
    detail:
      cddContracts.length > 0
        ? `${renewals.length} renouvellement(s) consécutif(s) — plafond légal : ${CDD_MAX_RENEWALS}.`
        : "Sans objet.",
  });

  // --- 3) Période d'essai conforme ------------------------------
  if (!activeContract) {
    checks.push({
      id: "probation",
      label: "Période d'essai",
      status: "na",
      detail: "Aucun contrat actif.",
    });
  } else if (!activeContract.probationEndDate) {
    checks.push({
      id: "probation",
      label: "Période d'essai",
      status: "warn",
      detail: "Aucune date de fin de période d'essai renseignée.",
    });
  } else {
    const days = Math.round(
      (activeContract.probationEndDate.getTime() - activeContract.startDate.getTime()) / DAY_MS,
    );
    const limit = PROBATION_MAX_DAYS[agent.category];
    const status = days > limit ? "fail" : "pass";
    checks.push({
      id: "probation",
      label: "Période d'essai",
      status,
      detail: `${days} jours configurés (limite ${agent.category} : ${limit} jours).`,
    });
  }

  // --- 4) PDF signé du contrat actif -----------------------------
  if (!activeContract) {
    checks.push({
      id: "signed-pdf",
      label: "Contrat signé archivé",
      status: "na",
      detail: "Aucun contrat actif.",
    });
  } else {
    const signed = Boolean(activeContract.signedAt);
    checks.push({
      id: "signed-pdf",
      label: "Contrat signé archivé",
      status: signed ? "pass" : "warn",
      detail: signed
        ? `Déposé le ${activeContract.signedAt!.toLocaleDateString("fr-FR")} (${activeContract.signedFileName ?? "—"}).`
        : "Aucun PDF signé n'a été déposé pour ce contrat.",
    });
  }

  // --- 5) Pièces justificatives obligatoires --------------------
  const required: { type: string; label: string }[] = [
    { type: "CNI", label: "CNI" },
    { type: "DIPLOME", label: "Diplôme" },
    { type: "CASIER_JUDICIAIRE", label: "Casier judiciaire" },
    { type: "RIB", label: "RIB" },
  ];
  const present = new Set(agent.documents.map((d) => d.type as string));
  const missing = required.filter((r) => !present.has(r.type));
  checks.push({
    id: "required-docs",
    label: "Pièces justificatives obligatoires",
    status: missing.length === 0 ? "pass" : missing.length === 1 ? "warn" : "fail",
    detail:
      missing.length === 0
        ? "Toutes les pièces requises ont été déposées."
        : `Manquant : ${missing.map((m) => m.label).join(", ")}.`,
  });

  return checks;
}

export const STATUS_LABEL: Record<ComplianceCheck["status"], string> = {
  pass: "Conforme",
  warn: "À surveiller",
  fail: "Non conforme",
  na: "Non applicable",
};

export const STATUS_STYLE: Record<ComplianceCheck["status"], string> = {
  pass: "bg-sc-green-light text-sc-green-dark",
  warn: "bg-orange-100 text-orange-700",
  fail: "bg-sc-danger-light text-sc-danger",
  na: "bg-gray-100 text-gray-600",
};
