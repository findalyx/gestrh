"use client";

import { useActionState, useMemo, useState } from "react";
import { saveLeaveBalances, type ActionState } from "../_lib/actions";

export type BalanceRow = {
  agentId: string;
  name: string;
  matricule: string;
  serviceName: string;
  totalDays: number | null;
  usedDays: number | null;
};

/**
 * Reprise des soldes de congés : saisie agent par agent des jours acquis et
 * pris, arrêtés à la fin du mois choisi. Au-delà de cette date, l'acquisition
 * automatique (+2 j / mois) prend le relais.
 */
export function LeaveBalanceEditor({
  rows,
  defaultCutoff,
}: {
  rows: BalanceRow[];
  defaultCutoff: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveLeaveBalances,
    undefined,
  );
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.matricule.toLowerCase().includes(needle) ||
        r.serviceName.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  return (
    <form action={formAction} className="space-y-4">
      {/* Barre : date d'arrêté + recherche + enregistrement */}
      <div className="sticky top-0 z-10 flex flex-wrap items-end gap-3 rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="cutoff"
            className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
          >
            Soldes arrêtés à fin
          </label>
          <input
            type="month"
            id="cutoff"
            name="cutoff"
            defaultValue={defaultCutoff}
            required
            className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[7px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
          />
        </div>

        <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
          <label
            htmlFor="recherche"
            className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
          >
            Rechercher
          </label>
          <input
            id="recherche"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, matricule, service…"
            className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-4 py-[9px] text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer les soldes"}
        </button>

        {state?.ok && (
          <p className="w-full text-[12px] text-sc-green-dark">✓ {state.message}</p>
        )}
        {state && !state.ok && (
          <p className="w-full text-[12px] text-sc-danger">{state.error}</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="bg-sc-blue-bg text-left">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3 w-[130px] text-right">Jours acquis</th>
              <th className="px-4 py-3 w-[130px] text-right">Jours pris</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[13px] text-gray-500"
                >
                  Aucun agent ne correspond à cette recherche.
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.agentId} className="border-t border-sc-border">
                  <td className="px-4 py-2">
                    <div className="font-medium text-sc-blue-darker">{r.name}</div>
                    <div className="font-mono text-[11px] text-gray-500">
                      {r.matricule}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{r.serviceName}</td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      name={`acq_${r.agentId}`}
                      defaultValue={r.totalDays ?? ""}
                      className="w-[100px] rounded-lg border border-sc-border bg-gray-50 px-2 py-1 text-right text-[13px] outline-none focus:border-sc-blue focus:bg-white"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      name={`use_${r.agentId}`}
                      defaultValue={r.usedDays ?? ""}
                      className="w-[100px] rounded-lg border border-sc-border bg-gray-50 px-2 py-1 text-right text-[13px] outline-none focus:border-sc-blue focus:bg-white"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11.5px] text-gray-500">
        Une ligne laissée vide dans « Jours acquis » n&apos;est pas modifiée. Les
        demi-journées sont acceptées (0,5).
      </p>
    </form>
  );
}
