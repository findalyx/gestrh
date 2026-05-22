"use client";

import { useActionState, useState } from "react";
import {
  generateMissingContractPdfs,
  regenerateAllContractPdfs,
} from "@/app/(app)/personnel/_lib/contract-actions";
import type { ContractActionState } from "@/app/(app)/personnel/_lib/contract-actions";

export function GenerateContractsButton({
  contractsWithoutPdf,
  contractsWithGeneratedPdf,
  contractsWithSignedScan,
}: {
  contractsWithoutPdf: number;
  contractsWithGeneratedPdf: number;
  contractsWithSignedScan: number;
}) {
  return (
    <div className="space-y-3">
      {/* Bloc 1 — Générer les manquants */}
      <GenerateMissingBlock contractsWithoutPdf={contractsWithoutPdf} />

      {/* Bloc 2 — Tout régénérer (sauf scans signés) */}
      <RegenerateAllBlock
        contractsWithoutPdf={contractsWithoutPdf}
        contractsWithGeneratedPdf={contractsWithGeneratedPdf}
        contractsWithSignedScan={contractsWithSignedScan}
      />
    </div>
  );
}

// ============================================================
//  Bloc 1 — Générer les PDF manquants
// ============================================================
function GenerateMissingBlock({
  contractsWithoutPdf,
}: {
  contractsWithoutPdf: number;
}) {
  const [confirm, setConfirm] = useState(false);
  const [state, formAction, pending] = useActionState<ContractActionState, FormData>(
    generateMissingContractPdfs,
    undefined,
  );

  return (
    <div className="rounded-xl border border-sc-border bg-white p-4">
      <h4 className="text-[13px] font-semibold text-sc-blue-darker">
        Générer les PDF de contrats manquants
      </h4>
      <p className="mt-1 text-[12px] text-gray-600">
        Crée automatiquement un PDF de contrat type (format sénégalais, 11
        articles) pour chaque contrat actuellement <strong>sans PDF joint</strong>.
        Les contrats déjà munis d&apos;un PDF (généré ou scan signé) ne sont
        pas modifiés.
      </p>
      <p className="mt-2 text-[12px] text-gray-700">
        <strong>{contractsWithoutPdf}</strong> contrat
        {contractsWithoutPdf > 1 ? "s" : ""} sans PDF actuellement.
      </p>

      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          disabled={contractsWithoutPdf === 0}
          className="mt-3 rounded-lg border border-sc-border bg-white px-3.5 py-2 text-[12.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {contractsWithoutPdf === 0 ? "Tous les contrats ont un PDF" : "Générer les manquants…"}
        </button>
      ) : (
        <form action={formAction} className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-sc-blue px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
          >
            {pending ? "Génération en cours…" : `Générer ${contractsWithoutPdf} PDF`}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="text-[12px] text-gray-500 hover:text-sc-blue-darker"
          >
            Annuler
          </button>
        </form>
      )}

      {state?.ok && (
        <p className="mt-2 text-[12px] text-sc-green-dark">✓ {state.message}</p>
      )}
      {state && !state.ok && (
        <p className="mt-2 text-[12px] text-sc-danger">{state.error}</p>
      )}
    </div>
  );
}

// ============================================================
//  Bloc 2 — Régénérer tous les PDF auto-générés
// ============================================================
function RegenerateAllBlock({
  contractsWithoutPdf,
  contractsWithGeneratedPdf,
  contractsWithSignedScan,
}: {
  contractsWithoutPdf: number;
  contractsWithGeneratedPdf: number;
  contractsWithSignedScan: number;
}) {
  const [confirm, setConfirm] = useState(false);
  const [state, formAction, pending] = useActionState<ContractActionState, FormData>(
    regenerateAllContractPdfs,
    undefined,
  );

  const toRegen = contractsWithoutPdf + contractsWithGeneratedPdf;

  return (
    <div className="rounded-xl border border-sc-purple/30 bg-sc-purple-light/30 p-4">
      <h4 className="text-[13px] font-semibold text-sc-purple-dark">
        Régénérer tous les PDF auto-générés
      </h4>
      <p className="mt-1 text-[12px] text-gray-700">
        Écrase tous les PDF auto-générés avec la version la plus récente du
        gabarit (utile après mise à jour de l&apos;identité de l&apos;organisation
        ou des informations agent). Les{" "}
        <strong>scans signés téléversés manuellement sont préservés</strong>.
      </p>
      <ul className="mt-2 space-y-0.5 text-[12px] text-gray-700">
        <li>
          <span className="font-semibold">{toRegen}</span> contrat
          {toRegen > 1 ? "s" : ""} à régénérer
          <span className="ml-1 text-gray-500">
            ({contractsWithGeneratedPdf} auto-généré
            {contractsWithGeneratedPdf > 1 ? "s" : ""} + {contractsWithoutPdf}{" "}
            sans PDF)
          </span>
        </li>
        <li>
          <span className="font-semibold">{contractsWithSignedScan}</span> scan
          {contractsWithSignedScan > 1 ? "s" : ""} signé
          {contractsWithSignedScan > 1 ? "s" : ""} préservé
          {contractsWithSignedScan > 1 ? "s" : ""}
        </li>
      </ul>

      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          disabled={toRegen === 0}
          className="mt-3 rounded-lg border border-sc-purple/40 bg-white px-3.5 py-2 text-[12.5px] font-medium text-sc-purple-dark transition hover:bg-sc-purple-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {toRegen === 0 ? "Aucun PDF à régénérer" : "Régénérer tout…"}
        </button>
      ) : (
        <form action={formAction} className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-sc-purple px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-sc-purple-dark disabled:opacity-60"
          >
            {pending
              ? "Régénération en cours…"
              : `Confirmer la régénération (${toRegen})`}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="text-[12px] text-gray-500 hover:text-sc-blue-darker"
          >
            Annuler
          </button>
        </form>
      )}

      {state?.ok && (
        <p className="mt-2 text-[12px] text-sc-green-dark">✓ {state.message}</p>
      )}
      {state && !state.ok && (
        <p className="mt-2 text-[12px] text-sc-danger">{state.error}</p>
      )}
    </div>
  );
}
