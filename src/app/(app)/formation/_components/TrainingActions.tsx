"use client";

import { useActionState } from "react";
import { TrainingStatus } from "@prisma/client";
import {
  enrollSelf,
  unenrollSelf,
  setSessionStatus,
} from "../_lib/actions";
import type { TrainingActionState } from "../_lib/schema";

export function EnrollButton({
  sessionId,
  disabled,
  reason,
}: {
  sessionId: string;
  disabled?: boolean;
  reason?: string;
}) {
  const action = enrollSelf.bind(null, sessionId);
  const [state, formAction, pending] = useActionState<TrainingActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={disabled || pending}
        title={reason}
        className="rounded-lg bg-sc-blue px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-sc-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "…" : "M'inscrire"}
      </button>
      {state?.ok && (
        <span className="text-[11px] text-sc-green-dark">✓</span>
      )}
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

export function UnenrollButton({
  enrollmentId,
  label = "Se désinscrire",
}: {
  enrollmentId: string;
  label?: string;
}) {
  const action = unenrollSelf.bind(null, enrollmentId);
  const [state, formAction, pending] = useActionState<TrainingActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-sc-border bg-white px-2.5 py-1 text-[11.5px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
      >
        {pending ? "…" : label}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

export function SetStatusButton({
  sessionId,
  newStatus,
  label,
  variant = "secondary",
}: {
  sessionId: string;
  newStatus: TrainingStatus;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const action = setSessionStatus.bind(null, sessionId, newStatus);
  const [state, formAction, pending] = useActionState<TrainingActionState, FormData>(
    action,
    undefined,
  );
  const cls =
    variant === "primary"
      ? "bg-sc-blue text-white hover:bg-sc-blue-dark"
      : variant === "danger"
        ? "border border-sc-danger/30 bg-white text-sc-danger hover:bg-sc-danger-light"
        : "border border-sc-border bg-white text-gray-700 hover:bg-gray-50";
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition disabled:opacity-60 ${cls}`}
      >
        {pending ? "…" : label}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}
