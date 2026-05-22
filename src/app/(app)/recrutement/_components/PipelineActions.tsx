"use client";

import { useActionState, useState } from "react";
import {
  advanceApplication,
  rejectApplication,
  setInterviewDate,
  closeJobPosting,
  reopenJobPosting,
} from "../_lib/actions";
import type { RecruitmentActionState } from "../_lib/schema";

export function AdvanceButton({
  applicationId,
  label = "Avancer →",
}: {
  applicationId: string;
  label?: string;
}) {
  const action = advanceApplication.bind(null, applicationId);
  const [state, formAction, pending] = useActionState<RecruitmentActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-blue px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
      >
        {pending ? "…" : label}
      </button>
      {state && !state.ok && (
        <span className="text-[10.5px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

export function RejectButton({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);
  const action = rejectApplication.bind(null, applicationId);
  const [state, formAction, pending] = useActionState<RecruitmentActionState, FormData>(
    action,
    undefined,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-sc-danger/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-sc-danger transition hover:bg-sc-danger-light"
      >
        Rejeter
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1.5">
      <input
        name="reason"
        type="text"
        placeholder="Motif (optionnel)"
        className="w-[140px] rounded-lg border border-sc-border bg-white px-2 py-1 text-[11px] outline-none focus:border-sc-blue"
        autoFocus
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-danger px-2 py-1 text-[10.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "…" : "Rejeter"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[10.5px] text-gray-500 hover:text-sc-blue-darker"
      >
        Annuler
      </button>
      {state && !state.ok && (
        <span className="basis-full text-[10.5px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

export function InterviewDateForm({
  applicationId,
  currentDate,
}: {
  applicationId: string;
  currentDate: string | null;
}) {
  const action = setInterviewDate.bind(null, applicationId);
  const [state, formAction, pending] = useActionState<RecruitmentActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input
        name="interviewAt"
        type="datetime-local"
        defaultValue={currentDate ?? ""}
        className="rounded-lg border border-sc-border bg-white px-2 py-[3px] text-[11px] outline-none focus:border-sc-blue"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-sc-border bg-white px-2 py-[3px] text-[10.5px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
      >
        {pending ? "…" : "OK"}
      </button>
      {state && !state.ok && (
        <span className="text-[10.5px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

export function ClosePostingButton({ postingId }: { postingId: string }) {
  const action = closeJobPosting.bind(null, postingId);
  const [state, formAction, pending] = useActionState<RecruitmentActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
      >
        {pending ? "…" : "Fermer l'offre"}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

export function ReopenPostingButton({ postingId }: { postingId: string }) {
  const action = reopenJobPosting.bind(null, postingId);
  const [state, formAction, pending] = useActionState<RecruitmentActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-blue px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
      >
        {pending ? "…" : "Ré-ouvrir l'offre"}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}
