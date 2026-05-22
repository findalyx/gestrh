"use client";

import { useActionState, useState } from "react";
import {
  initializeLeaveBalances,
  triggerMonthlyAccrual,
  type ActionState,
} from "../_lib/actions";

export function LeaveBalanceAdmin({
  lastAccrual,
  currentYYMM,
}: {
  lastAccrual: string | null;
  currentYYMM: string;
}) {
  const upToDate = lastAccrual === currentYYMM;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <InitButton />
      <AccrualButton upToDate={upToDate} lastAccrual={lastAccrual} />
    </div>
  );
}

function InitButton() {
  const [confirm, setConfirm] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    initializeLeaveBalances,
    undefined,
  );

  return (
    <div className="rounded-xl border border-sc-border bg-white p-4">
      <h4 className="text-[13px] font-semibold text-sc-blue-darker">
        Initialiser les soldes annuels
      </h4>
      <p className="mt-1 text-[12px] text-gray-600">
        Calcule pour chaque agent actif les jours acquis depuis le 1er janvier
        (ou depuis son embauche) à raison de 2 jours/mois. <strong>Remet à
        zéro les jours utilisés.</strong> À effectuer en début d&apos;exercice.
      </p>

      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="mt-3 rounded-lg border border-sc-border bg-white px-3.5 py-2 text-[12.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg"
        >
          Initialiser…
        </button>
      ) : (
        <form action={formAction} className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-sc-warning px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Initialisation…" : "⚠️ Confirmer l'initialisation"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="text-[12px] text-gray-500 hover:text-sc-blue-darker"
          >
            Annuler
          </button>
        </form>
      )}

      {state?.ok && (
        <p className="mt-2 text-[12px] text-sc-green-dark">✓ {state.message}</p>
      )}
      {state && !state.ok && (
        <p className="mt-2 text-[12px] text-sc-danger">{state.error}</p>
      )}
    </div>
  );
}

function AccrualButton({
  upToDate,
  lastAccrual,
}: {
  upToDate: boolean;
  lastAccrual: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    triggerMonthlyAccrual,
    undefined,
  );

  return (
    <div className="rounded-xl border border-sc-border bg-white p-4">
      <h4 className="text-[13px] font-semibold text-sc-blue-darker">
        Calcul mensuel
      </h4>
      <p className="mt-1 text-[12px] text-gray-600">
        Ajoute +2 jours au solde annuel de chaque agent actif (plafonné à 24 j).
        Lancé automatiquement à la première visite d&apos;un nouveau mois.
        Action manuelle utile pour rattraper un retard.
      </p>
      <p className="mt-2 text-[11.5px] text-gray-500">
        Dernier calcul :{" "}
        <span className="font-mono">
          {lastAccrual ?? "jamais (initialisation requise)"}
        </span>
        {upToDate && <span className="ml-2 text-sc-green-dark">· à jour</span>}
      </p>

      <form action={formAction} className="mt-3">
        <button
          type="submit"
          disabled={pending || upToDate}
          className="rounded-lg bg-sc-blue px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Calcul…" : "Lancer maintenant"}
        </button>
      </form>

      {state?.ok && (
        <p className="mt-2 text-[12px] text-sc-green-dark">✓ {state.message}</p>
      )}
      {state && !state.ok && (
        <p className="mt-2 text-[12px] text-sc-danger">{state.error}</p>
      )}
    </div>
  );
}
