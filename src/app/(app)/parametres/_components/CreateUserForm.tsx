"use client";

import { useActionState } from "react";
import { Role } from "@prisma/client";
import { createUserAccount, type ActionState } from "../_lib/actions";

type AgentOption = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  service: string;
};

const ROLE_LABEL: Record<Role, string> = {
  DIRECTION: "Direction",
  DRH: "DRH",
  MANAGER: "Manager",
  RECTEUR: "Recteur",
  DOYEN: "Doyen",
  AGENT: "Agent",
};

export function CreateUserForm({
  agents,
  canCreateDirection,
}: {
  agents: AgentOption[];
  canCreateDirection: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createUserAccount,
    undefined,
  );

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-4 md:grid-cols-4"
    >
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label
          htmlFor="agentId"
          className="text-[12px] font-medium text-sc-blue-darker"
        >
          Agent <span className="text-sc-danger">*</span>
        </label>
        <select
          id="agentId"
          name="agentId"
          required
          className="rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none focus:border-sc-blue focus:bg-white"
        >
          <option value="">— Sélectionner un agent —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.lastName.toUpperCase()} {a.firstName} · {a.matricule} · {a.service}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-gray-500">
          {agents.length === 0
            ? "Tous les agents disposent déjà d'un compte."
            : `${agents.length} agent(s) sans compte d'accès.`}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="role"
          className="text-[12px] font-medium text-sc-blue-darker"
        >
          Rôle <span className="text-sc-danger">*</span>
        </label>
        <select
          id="role"
          name="role"
          defaultValue={Role.AGENT}
          required
          className="rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none focus:border-sc-blue focus:bg-white"
        >
          {(Object.keys(ROLE_LABEL) as Role[])
            .filter((r) => r !== Role.DIRECTION || canCreateDirection)
            .map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[12px] font-medium text-sc-blue-darker"
        >
          Mot de passe initial <span className="text-sc-danger">*</span>
        </label>
        <input
          id="password"
          name="password"
          type="text"
          required
          minLength={8}
          placeholder="8 caractères min."
          className="rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none focus:border-sc-blue focus:bg-white font-mono"
        />
      </div>

      <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-3 border-t border-sc-border pt-4">
        <div className="flex-1 min-w-[200px]">
          {state && !state.ok && (
            <p className="text-[12.5px] text-sc-danger">{state.error}</p>
          )}
          {state?.ok && (
            <p className="text-[12.5px] text-sc-green-dark">✓ {state.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending || agents.length === 0}
          className="rounded-lg bg-sc-blue px-4 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer le compte"}
        </button>
      </div>
    </form>
  );
}
