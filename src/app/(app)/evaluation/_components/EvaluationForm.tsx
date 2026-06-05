"use client";

import { useActionState } from "react";
import {
  saveDraftEvaluation,
  finalizeEvaluation,
} from "../_lib/actions";
import type { EvaluationFormState } from "../_lib/schema";

type Props = {
  evaluationId: string;
  initialValues: {
    objectives: string;
    comments: string;
    overallScore: number | null;
    highPotential: boolean;
  };
};

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

function err(state: EvaluationFormState, key: string): string | undefined {
  if (!state || state.ok === true) return undefined;
  return state.errors?.[key as never]?.[0];
}

export function EvaluationForm({ evaluationId, initialValues }: Props) {
  const draftAction = saveDraftEvaluation.bind(null, evaluationId);
  const finalizeAction = finalizeEvaluation.bind(null, evaluationId);

  const [draftState, runDraft, draftPending] = useActionState<EvaluationFormState, FormData>(
    draftAction,
    undefined,
  );
  const [finalState, runFinal, finalPending] = useActionState<EvaluationFormState, FormData>(
    finalizeAction,
    undefined,
  );

  // L'état affiché privilégie le dernier appel (en pratique, on n'utilise qu'un seul à la fois)
  const state = finalState ?? draftState;

  return (
    <form className="space-y-4">
      {state && state.ok === false && state.errors?._form && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3.5 py-2.5 text-[12.5px] text-sc-danger">
          {state.errors._form[0]}
        </div>
      )}
      {state && state.ok === true && (
        <div className="rounded-lg border border-sc-green/30 bg-sc-green-light px-3.5 py-2.5 text-[12.5px] text-sc-green-dark">
          ✓ {state.message}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="objectives"
          className="text-[12px] font-medium text-sc-blue-darker"
        >
          Objectifs individuels
        </label>
        <textarea
          id="objectives"
          name="objectives"
          rows={4}
          defaultValue={initialValues.objectives}
          maxLength={2000}
          placeholder="Objectifs fixés et résultats attendus pour la période"
          className={`${inputCls} resize-none`}
        />
        {err(state, "objectives") && (
          <p className="text-[11.5px] text-sc-danger">{err(state, "objectives")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="comments"
          className="text-[12px] font-medium text-sc-blue-darker"
        >
          Commentaires de l&apos;évaluateur
        </label>
        <textarea
          id="comments"
          name="comments"
          rows={5}
          defaultValue={initialValues.comments}
          maxLength={2000}
          placeholder="Appréciation, points forts, axes d'amélioration, plan d'action…"
          className={`${inputCls} resize-none`}
        />
        {err(state, "comments") && (
          <p className="text-[11.5px] text-sc-danger">{err(state, "comments")}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="overallScore"
            className="text-[12px] font-medium text-sc-blue-darker"
          >
            Note globale <span className="text-gray-400">/ 20</span>
          </label>
          <input
            id="overallScore"
            name="overallScore"
            type="number"
            min={0}
            max={20}
            step={0.1}
            defaultValue={initialValues.overallScore ?? ""}
            placeholder="ex : 16"
            className={inputCls}
          />
          {err(state, "overallScore") && (
            <p className="text-[11.5px] text-sc-danger">{err(state, "overallScore")}</p>
          )}
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2 text-[13px]">
            <input
              type="checkbox"
              name="highPotential"
              defaultChecked={initialValues.highPotential}
              className="h-4 w-4 accent-sc-purple"
            />
            <span className="text-sc-blue-darker">Identifié(e) comme haut potentiel</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-sc-border pt-4">
        <button
          type="submit"
          formAction={runDraft}
          disabled={draftPending || finalPending}
          className="rounded-lg border border-sc-border bg-white px-4 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
        >
          {draftPending ? "Enregistrement…" : "Enregistrer en brouillon"}
        </button>
        <button
          type="submit"
          formAction={runFinal}
          disabled={draftPending || finalPending}
          className="rounded-lg bg-sc-blue px-5 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {finalPending ? "Finalisation…" : "Finaliser l'évaluation"}
        </button>
      </div>
    </form>
  );
}
