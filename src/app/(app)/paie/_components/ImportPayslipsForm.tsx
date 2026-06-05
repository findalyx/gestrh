"use client";

import { useActionState } from "react";
import { importPayslips, type ImportPayslipsState } from "../_lib/import-actions";

export function ImportPayslipsForm() {
  const [state, action, pending] = useActionState<ImportPayslipsState, FormData>(
    importPayslips,
    undefined,
  );

  return (
    <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
      <h3 className="flex items-center gap-2 font-serif text-[14px] font-semibold text-sc-blue-darker">
        <span className="h-[16px] w-1 rounded bg-sc-teal" />
        Importer des bulletins de paie (PDF)
      </h3>
      <p className="mt-1 text-[12px] text-gray-600">
        Téléversez le PDF mensuel des bulletins. Le système lit chaque bulletin
        (période, matricule, brut, net) et met à jour la paie automatiquement.
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
            <div className="rounded-lg border border-sc-warning/40 bg-sc-warning-light px-3 py-2 text-[12px] text-[#854f0b]">
              ⚠ {state.unmatched.length} bulletin
              {state.unmatched.length > 1 ? "s" : ""} non relié
              {state.unmatched.length > 1 ? "s" : ""} à un agent (matricule absent
              du système) :
              <div className="mt-1 font-mono text-[11.5px]">
                {state.unmatched
                  .map((u) => `S${u.matricule}${u.name ? ` (${u.name})` : ""}`)
                  .join(" · ")}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
