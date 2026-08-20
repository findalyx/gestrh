"use client";

import { useActionState, useState } from "react";
import {
  launchEvaluationCampaign,
  renameEvaluationCampaign,
  deleteEvaluationCampaign,
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

/**
 * Correction d'une campagne lancee sur la mauvaise annee : on la rattache a une
 * autre annee (les notes deja saisies suivent) ou on la supprime.
 */
export function CampaignAdmin({ period }: { period: string }) {
  const [renameState, renameAction, renaming] = useActionState<
    CampaignActionState,
    FormData
  >(renameEvaluationCampaign, undefined);
  const [deleteState, deleteAction, deleting] = useActionState<
    CampaignActionState,
    FormData
  >(deleteEvaluationCampaign, undefined);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] text-gray-500">
        Campagne <strong>{period}</strong> — utile si elle a été lancée sur la
        mauvaise année. Les notes et commentaires déjà saisis sont conservés lors
        d&apos;un changement d&apos;année.
      </p>

      <form action={renameAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="from" value={period} />
        <div className="flex flex-col gap-1">
          <label
            htmlFor="to"
            className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
          >
            Rattacher à l&apos;année
          </label>
          <input
            id="to"
            name="to"
            type="number"
            min={2020}
            max={2099}
            defaultValue={String(Number(period) - 1)}
            required
            className="w-[120px] rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
          />
        </div>
        <button
          type="submit"
          disabled={renaming}
          className="rounded-lg border border-sc-border bg-white px-3 py-[9px] text-[12.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg disabled:opacity-60"
        >
          {renaming ? "…" : "Changer l'année"}
        </button>
        {renameState?.ok && (
          <p className="basis-full text-[12px] text-sc-green-dark">
            ✓ {renameState.message}
          </p>
        )}
        {renameState && !renameState.ok && (
          <p className="basis-full text-[12px] text-sc-danger">
            {renameState.error}
          </p>
        )}
      </form>

      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="text-[12px] font-medium text-gray-500 transition hover:text-sc-danger"
        >
          Supprimer la campagne {period}…
        </button>
      ) : (
        <form action={deleteAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="period" value={period} />
          <span className="text-[12px] text-gray-700">
            Supprimer définitivement toutes les évaluations {period} ?
          </span>
          <button
            type="submit"
            disabled={deleting}
            className="rounded-lg bg-sc-danger px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {deleting ? "Suppression…" : "Supprimer"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="text-[12px] text-gray-500 hover:text-sc-blue-darker"
          >
            Annuler
          </button>
          {deleteState && !deleteState.ok && (
            <p className="basis-full text-[12px] text-sc-danger">
              {deleteState.error}
            </p>
          )}
          {deleteState?.ok && (
            <p className="basis-full text-[12px] text-sc-green-dark">
              ✓ {deleteState.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
