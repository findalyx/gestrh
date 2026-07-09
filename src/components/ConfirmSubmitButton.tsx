"use client";

import { useActionState, useState } from "react";

/**
 * Bouton d'action destructive avec confirmation en 2 temps.
 *   1er clic  → affiche « Confirmer / Annuler »
 *   Confirmer → soumet l'action (server action liée)
 *
 * Deux apparences :
 *   - `icon` (défaut) : petite icône corbeille discrète
 *   - libellé texte via `label`
 *
 * L'action est une server action liée de forme (prev, formData) => Promise<state>.
 * Le `state` peut porter `{ ok, error }` — on affiche l'erreur le cas échéant.
 */
type ActionFn = (prev: unknown, formData: FormData) => Promise<unknown>;

export function ConfirmSubmitButton({
  action,
  label,
  confirmText = "Confirmer la suppression ?",
  confirmLabel = "Supprimer",
  title = "Supprimer",
}: {
  action: ActionFn;
  /** Si fourni, bouton texte ; sinon icône corbeille discrète. */
  label?: string;
  /** Texte affiché au moment de la confirmation. */
  confirmText?: string;
  /** Libellé du bouton de confirmation. */
  confirmLabel?: string;
  /** Tooltip de l'icône. */
  title?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const [state, formAction, pending] = useActionState(
    action as (prev: unknown, fd: FormData) => Promise<unknown>,
    undefined,
  );
  const error =
    state && typeof state === "object" && "error" in state
      ? (state as { error?: string }).error
      : undefined;

  if (!confirm) {
    if (label) {
      return (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="rounded-lg border border-sc-danger/30 bg-white px-2.5 py-1 text-[11.5px] font-medium text-sc-danger transition hover:bg-sc-danger-light"
        >
          {label}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        title={title}
        aria-label={title}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-sc-danger-light hover:text-sc-danger"
      >
        <TrashIcon />
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <span className="text-[11px] text-sc-danger">{confirmText}</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-danger px-2.5 py-1 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "…" : confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="text-[11px] text-gray-500 hover:text-sc-blue-darker"
      >
        Annuler
      </button>
      {error && <span className="text-[10.5px] text-sc-danger">{error}</span>}
    </form>
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
