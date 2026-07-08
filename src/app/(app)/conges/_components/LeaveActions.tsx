"use client";

import { useActionState, useState } from "react";
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from "../_lib/actions";
import type { LeaveActionState } from "../_lib/schema";

type PreviousNote = { by: string; comment: string } | null;

/** Petite fenêtre modale centrée (fond semi-opaque cliquable pour fermer). */
function DecisionModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-sc-border bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

type DecisionProps = {
  requestId: string;
  isOverride?: boolean;
  previousNote?: PreviousNote;
};

/** En-tête commun du panneau : avertissement override + note du validateur précédent. */
function PanelHeader({
  isOverride,
  previousNote,
}: {
  isOverride?: boolean;
  previousNote?: PreviousNote;
}) {
  return (
    <>
      {isOverride && (
        <div className="rounded-md border border-sc-warning/40 bg-sc-warning-light px-2.5 py-1.5 text-[11px] leading-snug text-[#854f0b]">
          ⚠ Vous n&apos;êtes pas dans la chaîne de validation de cette personne.
          Vous agissez en tant que <strong>Direction</strong> (hors circuit
          habituel).
        </div>
      )}
      {previousNote && (
        <div className="rounded-md border border-sc-border bg-gray-50 px-2.5 py-1.5 text-[11px] leading-snug text-gray-700">
          <span className="font-semibold text-sc-blue-darker">
            Note de {previousNote.by} :
          </span>{" "}
          « {previousNote.comment} »
        </div>
      )}
    </>
  );
}

// ============================================================
//  APPROUVER — panneau de confirmation avec commentaire
// ============================================================
export function ApproveButton({
  requestId,
  isOverride,
  previousNote,
}: DecisionProps) {
  const [open, setOpen] = useState(false);
  const action = approveLeaveRequest.bind(null, requestId);
  const [state, formAction, pending] = useActionState<LeaveActionState, FormData>(
    action,
    undefined,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-sc-green px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-sc-green-dark"
      >
        Approuver
      </button>
    );
  }

  return (
    <DecisionModal onClose={() => setOpen(false)}>
      <form action={formAction} className="flex flex-col gap-2.5">
        <p className="text-[13px] font-semibold text-sc-blue-darker">
          Confirmer la validation
        </p>
        <PanelHeader isOverride={isOverride} previousNote={previousNote} />
        <textarea
          name="comment"
          rows={3}
          placeholder="Commentaire (visible par le validateur suivant)"
          className="w-full rounded-lg border border-sc-border bg-gray-50 px-2.5 py-2 text-[12.5px] outline-none focus:border-sc-blue focus:bg-white"
          autoFocus
        />
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-1.5 text-[12px] text-gray-500 hover:text-sc-blue-darker"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-sc-green px-4 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-sc-green-dark disabled:opacity-60"
          >
            {pending ? "…" : "Valider"}
          </button>
        </div>
        {state && !state.ok && (
          <span className="text-[11.5px] text-sc-danger">{state.message}</span>
        )}
      </form>
    </DecisionModal>
  );
}

// ============================================================
//  REFUSER — panneau de confirmation avec motif
// ============================================================
export function RejectButton({
  requestId,
  isOverride,
  previousNote,
}: DecisionProps) {
  const [open, setOpen] = useState(false);
  const action = rejectLeaveRequest.bind(null, requestId);
  const [state, formAction, pending] = useActionState<LeaveActionState, FormData>(
    action,
    undefined,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-sc-danger/30 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-sc-danger transition hover:bg-sc-danger-light"
      >
        Refuser
      </button>
    );
  }

  return (
    <DecisionModal onClose={() => setOpen(false)}>
      <form action={formAction} className="flex flex-col gap-2.5">
        <p className="text-[13px] font-semibold text-sc-danger">
          Confirmer le refus
        </p>
        <PanelHeader isOverride={isOverride} previousNote={previousNote} />
        <textarea
          name="reason"
          rows={3}
          placeholder="Motif du refus (visible par l'agent)"
          className="w-full rounded-lg border border-sc-border bg-gray-50 px-2.5 py-2 text-[12.5px] outline-none focus:border-sc-danger focus:bg-white"
          autoFocus
        />
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-1.5 text-[12px] text-gray-500 hover:text-sc-blue-darker"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-sc-danger px-4 py-1.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "…" : "Confirmer le refus"}
          </button>
        </div>
        {state && !state.ok && (
          <span className="text-[11.5px] text-sc-danger">{state.message}</span>
        )}
      </form>
    </DecisionModal>
  );
}

// ============================================================
//  ANNULER — par l'auteur
// ============================================================
export function CancelButton({ requestId }: { requestId: string }) {
  const action = cancelLeaveRequest.bind(null, requestId);
  const [state, formAction, pending] = useActionState<LeaveActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-sc-border bg-white px-2.5 py-1 text-[11.5px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "…" : "Annuler"}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.message}</span>
      )}
    </form>
  );
}
