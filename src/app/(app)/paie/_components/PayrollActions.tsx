"use client";

import { useActionState, useState } from "react";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  validatePayroll,
  markPayrollPaid,
  generateMonthlyPayroll,
  validatePeriodBatch,
  markPeriodPaidBatch,
  deletePayrollRecord,
  deletePeriodPayroll,
  type PayrollActionState,
} from "../_lib/actions";

export function ValidateButton({ payrollId }: { payrollId: string }) {
  const action = validatePayroll.bind(null, payrollId);
  const [state, formAction, pending] = useActionState<PayrollActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-blue px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
      >
        {pending ? "…" : "Valider"}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

export function MarkPaidButton({ payrollId }: { payrollId: string }) {
  const action = markPayrollPaid.bind(null, payrollId);
  const [state, formAction, pending] = useActionState<PayrollActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-green px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-sc-green-dark disabled:opacity-60"
      >
        {pending ? "…" : "Marquer payé"}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

export function ValidatePeriodBatchButton({
  period,
  count,
}: {
  period: string;
  count: number;
}) {
  const action = validatePeriodBatch.bind(null, period);
  const [state, formAction, pending] = useActionState<PayrollActionState, FormData>(
    action,
    undefined,
  );
  if (count === 0) return null;
  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-sc-blue/30 bg-white px-3 py-1.5 text-[12px] font-medium text-sc-blue transition hover:bg-sc-blue-bg disabled:opacity-60"
        title="Valider tous les bulletins en brouillon de cette période"
      >
        {pending ? "…" : `Valider les ${count} brouillons`}
      </button>
      {state && !state.ok && (
        <p className="mt-1 text-[11px] text-sc-danger">{state.error}</p>
      )}
    </form>
  );
}

export function MarkPeriodPaidBatchButton({
  period,
  count,
}: {
  period: string;
  count: number;
}) {
  const action = markPeriodPaidBatch.bind(null, period);
  const [state, formAction, pending] = useActionState<PayrollActionState, FormData>(
    action,
    undefined,
  );
  if (count === 0) return null;
  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-green px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-sc-green-dark disabled:opacity-60"
        title="Marquer tous les bulletins validés de cette période comme payés"
      >
        {pending ? "…" : `Marquer les ${count} comme payés`}
      </button>
      {state && !state.ok && (
        <p className="mt-1 text-[11px] text-sc-danger">{state.error}</p>
      )}
    </form>
  );
}

// ============================================================
//  Suppression d'un bulletin — icône discrète + confirmation
// ============================================================
export function DeletePayrollButton({ payrollId }: { payrollId: string }) {
  return (
    <ConfirmSubmitButton
      action={deletePayrollRecord.bind(null, payrollId) as never}
      title="Supprimer ce bulletin"
      confirmText="Supprimer ce bulletin ?"
    />
  );
}

// ============================================================
//  Suppression de toute une période (double confirmation)
// ============================================================
export function DeletePeriodButton({
  period,
  count,
}: {
  period: string;
  count: number;
}) {
  const [confirm, setConfirm] = useState(false);
  const action = deletePeriodPayroll.bind(null, period);
  const [state, formAction, pending] = useActionState<PayrollActionState, FormData>(
    action,
    undefined,
  );
  if (count === 0) return null;
  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="rounded-lg border border-sc-danger/30 bg-white px-3 py-1.5 text-[12px] font-medium text-sc-danger transition hover:bg-sc-danger-light"
        title="Supprimer tous les bulletins de cette période (utile pour ré-importer)"
      >
        Supprimer les {count} bulletins de la période
      </button>
    );
  }
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <span className="text-[12px] text-sc-danger">
        Supprimer définitivement {count} bulletin(s) ?
      </span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-danger px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Suppression…" : "Oui, tout supprimer"}
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="text-[11.5px] text-gray-500 hover:text-sc-blue-darker"
      >
        Annuler
      </button>
      {state && !state.ok && (
        <p className="basis-full text-[11px] text-sc-danger">{state.error}</p>
      )}
    </form>
  );
}

export function GeneratePayrollForm({
  defaultPeriod,
}: {
  defaultPeriod: string;
}) {
  const [state, formAction, pending] = useActionState<PayrollActionState, FormData>(
    generateMonthlyPayroll,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="period"
          className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
        >
          Période à générer
        </label>
        <input
          id="period"
          name="period"
          type="month"
          defaultValue={defaultPeriod}
          required
          className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
      >
        {pending ? "Génération…" : "Générer les bulletins"}
      </button>
      {state?.ok && (
        <p className="basis-full text-[12px] text-sc-green-dark">✓ {state.message}</p>
      )}
      {state && !state.ok && (
        <p className="basis-full text-[12px] text-sc-danger">{state.error}</p>
      )}
    </form>
  );
}
