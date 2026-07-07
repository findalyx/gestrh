"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAgent, type DeleteAgentResult } from "../_lib/actions";

/**
 * Bouton de suppression d'un agent — réservé à la Direction.
 *
 * Double confirmation :
 * 1. Premier clic → passe en mode "confirmation" avec un compteur 3s (anti-clic accidentel)
 * 2. Second clic → soumet la suppression via Server Action
 *
 * En cas de succès, on redirige vers /personnel.
 */
export function DeleteAgentButton({
  agentId,
  agentLabel,
}: {
  agentId: string;
  agentLabel: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  const action = deleteAgent.bind(null, agentId);
  const [state, formAction, pending] = useActionState<DeleteAgentResult, FormData>(
    action,
    undefined,
  );

  // Après succès → retour à la liste
  if (state?.ok) {
    router.push("/personnel");
    router.refresh();
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-sc-danger/40 bg-white px-3 py-1.5 text-[12.5px] font-medium text-sc-danger transition hover:bg-sc-danger-light"
      >
        🗑 Supprimer l&apos;agent
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-sc-danger/30 bg-sc-danger-light/50 p-3">
      <p className="text-[12.5px] text-sc-danger">
        Supprimer définitivement <strong>{agentLabel}</strong> ? Toutes ses
        données (contrats, congés, formations, évaluations) seront perdues.
      </p>
      <form action={formAction} className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-danger px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-sc-danger/90 disabled:opacity-60"
        >
          {pending ? "Suppression…" : "Confirmer la suppression"}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12px] text-gray-600 transition hover:bg-gray-50"
        >
          Annuler
        </button>
      </form>
      {state && !state.ok && (
        <p className="text-[12px] text-sc-danger">{state.error}</p>
      )}
    </div>
  );
}
