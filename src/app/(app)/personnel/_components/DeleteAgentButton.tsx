"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAgent, type DeleteAgentResult } from "../_lib/actions";

/**
 * Suppression d'un agent — réservé à la Direction.
 *
 * Déclencheur discret : petite icône corbeille alignée avec les autres actions
 * de l'en-tête. Au clic, une fenêtre modale rappelle que TOUT l'historique sera
 * perdu et propose l'alternative « INACTIF ». Confirmation explicite requise
 * avant l'appel de la Server Action. En cas de succès → retour à la liste.
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

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        title="Supprimer l'agent"
        aria-label="Supprimer l'agent"
        className="inline-flex items-center justify-center rounded-lg border border-sc-border bg-white px-2 py-1.5 text-gray-400 transition hover:border-sc-danger/40 hover:bg-sc-danger-light hover:text-sc-danger"
      >
        <TrashIcon />
      </button>

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-sc-border bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="flex items-center gap-2 font-serif text-[15px] font-semibold text-sc-danger">
              <TrashIcon /> Supprimer l&apos;agent
            </h3>
            <p className="mt-3 text-[12.5px] text-gray-700">
              Supprimer définitivement <strong>{agentLabel}</strong> ?{" "}
              <strong>Toutes ses informations seront perdues</strong> : contrats,
              bulletins de paie, congés, formations, évaluations, notes
              d&apos;honoraires et documents. Cette action est irréversible.
            </p>
            <p className="mt-2 rounded-lg bg-sc-blue-bg px-3 py-2 text-[11.5px] text-gray-600">
              Astuce : pour garder l&apos;historique, préfère passer l&apos;agent
              en statut <strong>INACTIF</strong> (via « Modifier ») plutôt que le
              supprimer.
            </p>
            <form
              action={formAction}
              className="mt-4 flex items-center justify-end gap-2"
            >
              <button
                type="button"
                onClick={() => setConfirm(false)}
                disabled={pending}
                className="rounded-lg border border-sc-border bg-white px-3.5 py-1.5 text-[12.5px] text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-sc-danger px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-sc-danger/90 disabled:opacity-60"
              >
                {pending ? "Suppression…" : "Confirmer la suppression"}
              </button>
            </form>
            {state && !state.ok && (
              <p className="mt-2 text-[12px] text-sc-danger">{state.error}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
