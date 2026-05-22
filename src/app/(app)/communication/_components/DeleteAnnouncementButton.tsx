"use client";

import { useActionState } from "react";
import {
  deleteAnnouncement,
  type CommunicationActionState,
} from "../_lib/actions";

export function DeleteAnnouncementButton({ id }: { id: string }) {
  const action = deleteAnnouncement.bind(null, id);
  const [state, formAction, pending] = useActionState<CommunicationActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-sc-danger/30 bg-white px-2.5 py-1 text-[11px] font-medium text-sc-danger transition hover:bg-sc-danger-light disabled:opacity-60"
      >
        {pending ? "…" : "Supprimer"}
      </button>
      {state && !state.ok && (
        <span className="text-[10.5px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}
