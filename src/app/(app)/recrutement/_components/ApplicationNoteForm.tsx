"use client";

import { useActionState, useRef, useEffect } from "react";
import {
  addApplicationNote,
  deleteApplicationNote,
} from "../_lib/actions";
import type { RecruitmentActionState } from "../_lib/schema";

export function ApplicationNoteForm({ applicationId }: { applicationId: string }) {
  const action = addApplicationNote.bind(null, applicationId);
  const [state, formAction, pending] = useActionState<RecruitmentActionState, FormData>(
    action,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Reset le textarea après succès
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <textarea
        name="body"
        rows={3}
        maxLength={2000}
        required
        placeholder="Ajouter une note à l'étape actuelle (impression entretien, axes à creuser, etc.)"
        className="w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10 resize-none"
      />
      <div className="flex items-center justify-end gap-2">
        {state && !state.ok && (
          <span className="text-[11.5px] text-sc-danger">{state.error}</span>
        )}
        {state?.ok && (
          <span className="text-[11.5px] text-sc-green-dark">✓ {state.message}</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Ajout…" : "Ajouter la note"}
        </button>
      </div>
    </form>
  );
}

export function DeleteNoteButton({ noteId }: { noteId: string }) {
  const action = deleteApplicationNote.bind(null, noteId);
  const [state, formAction, pending] = useActionState<RecruitmentActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        title="Supprimer cette note"
        className="text-[10.5px] text-gray-400 transition hover:text-sc-danger disabled:opacity-60"
      >
        {pending ? "…" : "✕"}
      </button>
      {state && !state.ok && (
        <span className="ml-1 text-[10.5px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}
