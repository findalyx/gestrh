"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EsgReportStatus } from "@prisma/client";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  createEsgReport,
  refreshEsgAuto,
  setEsgStatus,
  deleteEsgReport,
  type EsgActionState,
} from "../_lib/actions";
import { QUARTER_LABELS } from "../_lib/periods";

const selectCls =
  "rounded-lg border border-sc-border bg-white px-3 py-2 text-[13px] outline-none focus:border-sc-blue";

// ---------------------------------------------------------- Nouveau rapport
export function NewReportForm({
  years,
  defaultYear,
  defaultQuarter,
}: {
  years: number[];
  defaultYear: number;
  defaultQuarter: number;
}) {
  const [state, action, pending] = useActionState<EsgActionState, FormData>(
    createEsgReport,
    undefined,
  );
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-gray-500">Année</label>
        <select name="year" defaultValue={defaultYear} className={selectCls}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-gray-500">Trimestre</label>
        <select
          name="quarter"
          defaultValue={defaultQuarter}
          className={selectCls}
        >
          {[1, 2, 3, 4].map((q) => (
            <option key={q} value={q}>
              {QUARTER_LABELS[q]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-blue px-4 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer le rapport"}
      </button>
      {state && !state.ok && (
        <span className="text-[12px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

// ------------------------------------------------------- Rafraîchir auto
export function RefreshAutoButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<EsgActionState, FormData>(
    refreshEsgAuto.bind(null, reportId),
    undefined,
  );
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        title="Recalcule les indicateurs marqués « Auto RH » depuis la base"
        className="inline-flex items-center gap-1.5 rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg disabled:opacity-60"
      >
        {pending ? "Recalcul…" : "↻ Rafraîchir données RH"}
      </button>
      {state?.ok && (
        <span className="text-[11.5px] text-sc-green-dark">{state.message}</span>
      )}
    </form>
  );
}

// ------------------------------------------------------- Finaliser / rouvrir
export function StatusButton({
  reportId,
  status,
}: {
  reportId: string;
  status: EsgReportStatus;
}) {
  const target =
    status === EsgReportStatus.FINALISE
      ? EsgReportStatus.BROUILLON
      : EsgReportStatus.FINALISE;
  const [, action, pending] = useActionState<EsgActionState, FormData>(
    setEsgStatus.bind(null, reportId, target),
    undefined,
  );
  const finalizing = target === EsgReportStatus.FINALISE;
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-60 ${
          finalizing
            ? "border-sc-green/40 bg-sc-green-light text-sc-green-dark hover:bg-sc-green-light/70"
            : "border-sc-border bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        {finalizing ? "✓ Finaliser" : "Rouvrir"}
      </button>
    </form>
  );
}

// ------------------------------------------------------- Supprimer
export function DeleteReportButton({ reportId }: { reportId: string }) {
  return (
    <ConfirmSubmitButton
      action={deleteEsgReport.bind(null, reportId) as never}
      label="Supprimer"
      confirmText="Supprimer ce rapport ESG ?"
    />
  );
}
