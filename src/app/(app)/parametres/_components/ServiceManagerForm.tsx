"use client";

import { useActionState } from "react";
import { assignServiceManager, type ActionState } from "../_lib/actions";

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
};

export function ServiceManagerForm({
  serviceId,
  currentManagerId,
  candidates,
  disabled,
}: {
  serviceId: string;
  currentManagerId: string | null;
  candidates: Candidate[];
  disabled?: boolean;
}) {
  const action = assignServiceManager.bind(null, serviceId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        name="agentId"
        defaultValue={currentManagerId ?? ""}
        disabled={disabled || pending}
        className="rounded-lg border border-sc-border bg-white px-2 py-1 text-[12.5px] outline-none focus:border-sc-blue focus:ring-[3px] focus:ring-sc-blue/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">— Aucun —</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.lastName.toUpperCase()} {c.firstName} ({c.matricule})
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-lg bg-sc-blue px-2.5 py-1 text-[11.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "…" : "OK"}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
      {state?.ok && (
        <span className="text-[11px] text-sc-green-dark">✓</span>
      )}
    </form>
  );
}
