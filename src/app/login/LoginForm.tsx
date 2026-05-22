"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[12.5px] font-medium text-sc-blue-darker"
        >
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email ?? ""}
          placeholder="prenom@st-christopher.sn"
          className="rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2.5 text-[13.5px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[12.5px] font-medium text-sc-blue-darker"
        >
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2.5 text-[13.5px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10"
        />
      </div>

      {state?.error && (
        <div
          role="alert"
          className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3.5 py-2.5 text-[12.5px] text-sc-danger"
        >
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-sc-blue px-4 py-2.5 text-[13.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
