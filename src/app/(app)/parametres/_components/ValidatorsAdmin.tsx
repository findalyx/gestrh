"use client";

import { useActionState, useState } from "react";
import {
  createValidator,
  deleteValidator,
  type ValidatorActionState,
} from "../_lib/validator-actions";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

export type ValidatorRow = {
  id: string;
  label: string;
  agentName: string;
  matricule: string;
};

export type AgentOption = {
  id: string;
  name: string;
  matricule: string;
};

// Libellés fréquents, proposés en autocomplétion.
const LABEL_SUGGESTIONS = [
  "RH",
  "Doyen Exécutif",
  "Doyen Académique",
  "Recteur",
  "Directeur Général",
  "Directeur Financier",
  "Directrice Administrative",
  "Chef de Service de la Scolarité",
  "Responsable Marketing",
  "Chef de Service IT",
];

export function ValidatorsAdmin({
  validators,
  agents,
}: {
  validators: ValidatorRow[];
  agents: AgentOption[];
}) {
  return (
    <div className="space-y-4">
      {/* Liste */}
      {validators.length === 0 ? (
        <p className="text-[12.5px] text-gray-500">
          Aucun validateur défini. Ajoutez les personnes qui valident les congés
          (RH, Doyen Exécutif, Recteur…) ci-dessous.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-sc-border bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-sc-blue-bg text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                <th className="px-4 py-2.5">Personne</th>
                <th className="px-4 py-2.5">Rôle / libellé</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {validators.map((v) => (
                <tr key={v.id} className="border-t border-sc-border">
                  <td className="px-4 py-2.5 text-gray-700">
                    {v.agentName}
                    <span className="ml-1 font-mono text-[11px] text-gray-500">
                      · {v.matricule}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded-full bg-sc-purple-light px-2 py-[2px] text-[11px] font-semibold text-sc-purple-dark">
                      {v.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DeleteValidatorButton validatorId={v.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ajouter */}
      <AddValidatorForm agents={agents} />
    </div>
  );
}

function AddValidatorForm({ agents }: { agents: AgentOption[] }) {
  const [state, formAction, pending] = useActionState<ValidatorActionState, FormData>(
    createValidator,
    undefined,
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-sc-border bg-white p-4"
    >
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <label htmlFor="agentId" className="text-[12px] font-medium text-sc-blue-darker">
          Personne
        </label>
        <select id="agentId" name="agentId" required className={inputCls}>
          <option value="">— Choisir —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.matricule})
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <label htmlFor="label" className="text-[12px] font-medium text-sc-blue-darker">
          Rôle / libellé
        </label>
        <input
          id="label"
          name="label"
          list="validator-labels"
          placeholder="Ex : Doyen Exécutif"
          required
          className={inputCls}
        />
        <datalist id="validator-labels">
          {LABEL_SUGGESTIONS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-blue px-4 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
      >
        {pending ? "…" : "Ajouter"}
      </button>
      {state?.ok && (
        <p className="w-full text-[12px] text-sc-green-dark">✓ {state.message}</p>
      )}
      {state && !state.ok && (
        <p className="w-full text-[12px] text-sc-danger">{state.error}</p>
      )}
    </form>
  );
}

function DeleteValidatorButton({ validatorId }: { validatorId: string }) {
  const [confirm, setConfirm] = useState(false);
  const action = deleteValidator.bind(null, validatorId);
  const [state, formAction, pending] = useActionState<ValidatorActionState, FormData>(
    action,
    undefined,
  );
  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="text-[11.5px] text-gray-500 transition hover:text-sc-danger"
      >
        Retirer
      </button>
    );
  }
  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-danger px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-sc-danger/90 disabled:opacity-60"
      >
        {pending ? "…" : "Confirmer"}
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="text-[11px] text-gray-500 hover:text-sc-blue-darker"
      >
        Annuler
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}
