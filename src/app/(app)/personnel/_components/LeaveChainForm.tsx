"use client";

import { useActionState } from "react";
import {
  setLeaveChain,
  type ValidatorActionState,
} from "@/app/(app)/parametres/_lib/validator-actions";

const selectCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

export type ChainValidatorOption = {
  id: string;
  label: string;
  agentName: string;
};

/**
 * Configure la chaîne de validation des congés d'un agent : 4 niveaux,
 * chacun rattaché à un validateur (ou vide). Les niveaux vides sont ignorés
 * et la chaîne est compactée côté serveur.
 */
export function LeaveChainForm({
  agentId,
  validators,
  currentChain,
}: {
  agentId: string;
  validators: ChainValidatorOption[];
  /** Map niveau (1..4) → validatorId actuel. */
  currentChain: Record<number, string>;
}) {
  const action = setLeaveChain.bind(null, agentId);
  const [state, formAction, pending] = useActionState<ValidatorActionState, FormData>(
    action,
    undefined,
  );

  if (validators.length === 0) {
    return (
      <p className="text-[12.5px] text-gray-500">
        Aucun validateur n&apos;est encore défini. Ajoutez-en d&apos;abord dans{" "}
        <a href="/parametres#validateurs" className="text-sc-blue hover:underline">
          Paramètres → Validateurs de congés
        </a>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-[12px] text-gray-500">
        Choisissez qui valide, dans l&apos;ordre. Laissez « — Aucun — » pour
        arrêter la chaîne. Si aucun niveau n&apos;est défini, la demande part
        directement au Directeur Général.
      </p>

      <div className="space-y-2">
        {[1, 2, 3, 4].map((level) => (
          <div key={level} className="flex items-center gap-3">
            <span className="w-16 flex-shrink-0 text-[12px] font-medium text-sc-blue-darker">
              Niveau {level}
            </span>
            <select
              name={`level${level}`}
              defaultValue={currentChain[level] ?? ""}
              className={selectCls}
            >
              <option value="">— Aucun —</option>
              {validators.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} — {v.agentName}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-4 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer la chaîne"}
        </button>
        {state?.ok && (
          <span className="text-[12px] text-sc-green-dark">✓ {state.message}</span>
        )}
        {state && !state.ok && (
          <span className="text-[12px] text-sc-danger">{state.error}</span>
        )}
      </div>
    </form>
  );
}
