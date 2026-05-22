"use client";

import { useActionState } from "react";
import { Role } from "@prisma/client";
import {
  changeUserRole,
  toggleUserActive,
  type ActionState,
} from "../_lib/actions";

const ROLE_LABEL: Record<Role, string> = {
  DIRECTION: "Direction",
  DRH: "DRH",
  MANAGER: "Manager",
  AGENT: "Agent",
};

export function RoleSelectForm({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: Role;
  disabled?: boolean;
}) {
  const action = changeUserRole.bind(null, userId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        name="role"
        defaultValue={currentRole}
        disabled={disabled || pending}
        className="rounded-lg border border-sc-border bg-white px-2 py-1 text-[12.5px] outline-none focus:border-sc-blue focus:ring-[3px] focus:ring-sc-blue/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
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

export function ToggleActiveForm({
  userId,
  currentActive,
  disabled,
}: {
  userId: string;
  currentActive: boolean;
  disabled?: boolean;
}) {
  const action = toggleUserActive.bind(null, userId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="active" value={String(!currentActive)} />
      <button
        type="submit"
        disabled={disabled || pending}
        className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
          currentActive
            ? "border border-sc-border bg-white text-gray-700 hover:bg-gray-50"
            : "bg-sc-green text-white hover:bg-sc-green-dark"
        }`}
        title={
          state && !state.ok
            ? state.error
            : currentActive
              ? "Désactiver le compte"
              : "Activer le compte"
        }
      >
        {pending ? "…" : currentActive ? "Désactiver" : "Activer"}
      </button>
    </form>
  );
}
