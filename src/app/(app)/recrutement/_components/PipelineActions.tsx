"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  advanceApplication,
  rejectApplication,
  setInterviewDate,
  closeJobPosting,
  reopenJobPosting,
  deleteJobPosting,
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

/**
 * Suppression definitive d'une offre. Bouton discret ; au clic une modale
 * rappelle que les candidatures et leurs notes partent avec l'offre.
 * Retour a la liste apres succes.
 */
export function DeleteJobPostingButton({
  postingId,
  postingTitle,
  applicationCount,
}: {
  postingId: string;
  postingTitle: string;
  applicationCount: number;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const action = deleteJobPosting.bind(null, postingId);
  const [state, formAction, pending] = useActionState<RecruitmentActionState, FormData>(
    action,
    undefined,
  );

  if (state?.ok) {
    router.push("/recrutement");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="rounded-lg border border-sc-border bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-500 transition hover:border-sc-danger/40 hover:bg-sc-danger-light hover:text-sc-danger"
      >
        Supprimer
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
            <h3 className="font-serif text-[15px] font-semibold text-sc-danger">
              Supprimer l&apos;offre
            </h3>
            <p className="mt-2 text-[13px] text-gray-700">
              « {postingTitle} » sera définitivement supprimée
              {applicationCount > 0
                ? `, ainsi que ses ${applicationCount} candidature${applicationCount > 1 ? "s" : ""}, leurs notes et les CV déposés.`
                : "."}
            </p>
            <p className="mt-2 text-[12px] text-gray-500">
              Pour conserver l&apos;historique, préférez « Clôturer l&apos;offre ».
            </p>
            {state && !state.ok && (
              <p className="mt-3 text-[12px] text-sc-danger">{state.error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirm(false)}
                className="rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Annuler
              </button>
              <form action={formAction}>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-sc-danger px-3 py-1.5 text-[12.5px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? "Suppression…" : "Supprimer définitivement"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
