"use client";

import { useActionState } from "react";
import {
  launchEvaluationCampaign,
} from "../_lib/actions";
import type { CampaignActionState } from "../_lib/schema";

export function LaunchCampaignForm({
  defaultYear,
}: {
  defaultYear: string;
}) {
  const [state, formAction, pending] = useActionState<CampaignActionState, FormData>(
    launchEvaluationCampaign,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="period"
          className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
        >
          Année de campagne
        </label>
        <input
          id="period"
          name="period"
          type="number"
          min={2020}
          max={2099}
          defaultValue={defaultYear}
          required
          className="w-[120px] rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
      >
        {pending ? "Lancement…" : "Lancer la campagne"}
      </button>
      {state?.ok && (
        <p className="basis-full text-[12px] text-sc-green-dark">✓ {state.message}</p>
      )}
      {state && !state.ok && (
        <p className="basis-full text-[12px] text-sc-danger">{state.error}</p>
      )}
    </form>
  );
}
