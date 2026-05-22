"use client";

import { useActionState, useState } from "react";
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from "../_lib/actions";
import type { LeaveActionState } from "../_lib/schema";

export function ApproveButton({ requestId }: { requestId: string }) {
  const action = approveLeaveRequest.bind(null, requestId);
  const [state, formAction, pending] = useActionState<LeaveActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-green px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-sc-green-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "…" : "Approuver"}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.message}</span>
      )}
    </form>
  );
}

export function RejectButton({ requestId }: { requestId: string }) {
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
    <form action={formAction} className="flex items-center gap-1.5">
      <input
        name="reason"
        type="text"
        placeholder="Motif (optionnel)"
        className="w-[180px] rounded-lg border border-sc-border bg-white px-2 py-1 text-[12px] outline-none focus:border-sc-blue"
        autoFocus
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-danger px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "…" : "Confirmer"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[11px] text-gray-500 hover:text-sc-blue-darker"
      >
        Annuler
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.message}</span>
      )}
    </form>
  );
}

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
