"use client";

import { useActionState } from "react";
import {
  deleteAttachment,
  type CommunicationActionState,
} from "../_lib/actions";

export function DeleteAttachmentButton({ id }: { id: string }) {
  const action = deleteAttachment.bind(null, id);
  const [state, formAction, pending] = useActionState<CommunicationActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-sc-border bg-white px-2 py-[2px] text-[10.5px] font-medium text-sc-danger transition hover:bg-sc-danger-light disabled:opacity-60"
      >
        {pending ? "…" : "Retirer"}
      </button>
      {state && !state.ok && (
        <span className="text-[10.5px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}
