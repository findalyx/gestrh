"use client";

import { useActionState } from "react";
import { reopenEvaluation } from "../_lib/actions";
import type { CampaignActionState } from "../_lib/schema";

export function ReopenButton({ evaluationId }: { evaluationId: string }) {
  const action = reopenEvaluation.bind(null, evaluationId);
  const [state, formAction, pending] = useActionState<CampaignActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg disabled:opacity-60"
      >
        {pending ? "…" : "Ré-ouvrir"}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}
