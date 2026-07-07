"use client";

import { useActionState, useState } from "react";
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
 * Configure la chaîne de validation des congés d'un agent (4 niveaux).
 *
 * Le wrapper applique une `key` dérivée de la chaîne serveur : quand le serveur
 * renvoie une nouvelle chaîne (après enregistrement + revalidatePath), le
 * composant interne se re-monte et ré-initialise ses `select` contrôlés sur les
 * valeurs réellement enregistrées (compactées). Pendant l'édition, la chaîne
 * serveur ne change pas → pas de re-montage, les choix en cours sont conservés.
 */
export function LeaveChainForm(props: {
  agentId: string;
  validators: ChainValidatorOption[];
  currentChain: Record<number, string>;
}) {
  const signature = [1, 2, 3, 4]
    .map((l) => props.currentChain[l] ?? "")
    .join("|");
  return <LeaveChainFormInner key={signature} {...props} />;
}

function LeaveChainFormInner({
  agentId,
  validators,
  currentChain,
}: {
  agentId: string;
  validators: ChainValidatorOption[];
  currentChain: Record<number, string>;
}) {
  const action = setLeaveChain.bind(null, agentId);
  const [state, formAction, pending] = useActionState<ValidatorActionState, FormData>(
    action,
    undefined,
  );

  // Sélections contrôlées, initialisées depuis la chaîne enregistrée.
  const [picks, setPicks] = useState<Record<number, string>>({
    1: currentChain[1] ?? "",
    2: currentChain[2] ?? "",
    3: currentChain[3] ?? "",
    4: currentChain[4] ?? "",
  });

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

  const setLevel = (level: number, value: string) =>
    setPicks((p) => ({ ...p, [level]: value }));

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
              value={picks[level]}
              onChange={(e) => setLevel(level, e.target.value)}
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
