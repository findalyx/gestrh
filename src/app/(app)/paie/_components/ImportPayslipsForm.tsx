"use client";

import { useActionState } from "react";
import { importPayslips, type ImportPayslipsState } from "../_lib/import-actions";

export function ImportPayslipsForm() {
  const [state, action, pending] = useActionState<ImportPayslipsState, FormData>(
    importPayslips,
    undefined,
  );

  return (
    <div>
      <p className="text-[12px] text-gray-600">
        Téléversez le PDF mensuel des bulletins. Le système lit chaque bulletin
        (période, matricule, brut, net) et met à jour la paie automatiquement.
      </p>
      <p className="mt-1 text-[11.5px] text-gray-500">
        Ré-importer le même PDF est sans risque : chaque bulletin est mis à jour
        par agent et par période (aucun doublon). C&apos;est ainsi qu&apos;on
        complète une période où des bulletins manquaient.
      </p>
      <p className="mt-1 text-[11px] font-medium text-sc-warning">
        ⓘ En version cloud, le PDF doit peser <strong>≤ 4 Mo</strong>. Pour un
        PDF plus lourd, découpe-le ou compresse-le d&apos;abord (ex : <a
          href="https://smallpdf.com/fr/compresser-pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-sc-blue"
        >smallpdf.com</a>).
      </p>

      <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
        <input
          name="pdf"
          type="file"
          accept="application/pdf"
          required
          className="block text-[12px] file:mr-2 file:rounded-md file:border-0 file:bg-sc-blue-light file:px-3 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-sc-blue"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Import en cours…" : "Importer"}
        </button>
      </form>

      {state && !state.ok && (
        <div className="mt-3 rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3 py-2 text-[12.5px] text-sc-danger">
          {state.error}
        </div>
      )}

      {state && state.ok && (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-sc-green/30 bg-sc-green-light px-3 py-2 text-[12.5px] text-sc-green-dark">
            ✓ {state.imported} bulletin{state.imported > 1 ? "s" : ""} importé
            {state.imported > 1 ? "s" : ""}
            {state.updated > 0 && ` · ${state.updated} mis à jour`}
            {state.period && ` · période ${state.period}`}
            {state.skipped > 0 &&
              ` · ${state.skipped} ignoré(s) (données incomplètes)`}
            .
          </div>
          {state.unmatched.length > 0 && (
            <div className="rounded-lg border border-sc-warning/40 bg-sc-warning-light px-3 py-2.5 text-[12px] text-[#854f0b]">
              ⚠ {state.unmatched.length} bulletin
              {state.unmatched.length > 1 ? "s" : ""} non relié
              {state.unmatched.length > 1 ? "s" : ""} à un agent (matricule absent
              du système). Créez le dossier puis ré-importez le même PDF pour les
              rattacher :
              <div className="mt-2 flex flex-wrap gap-1.5">
                {state.unmatched.map((u, i) => (
                  <a
                    key={i}
                    href={`/personnel/nouveau?matricule=${encodeURIComponent(u.matricule ?? "")}`}
                    className="inline-flex items-center gap-1 rounded-md border border-sc-warning/50 bg-white px-2 py-1 font-mono text-[11.5px] text-[#854f0b] transition hover:bg-sc-warning-light"
                    title={u.name ? `Indice nom : ${u.name}` : undefined}
                  >
                    S{u.matricule}
                    <span className="font-sans font-semibold text-sc-blue">
                      + créer
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
