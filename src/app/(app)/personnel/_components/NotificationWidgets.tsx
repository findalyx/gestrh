"use client";

import { useRef, useState } from "react";
import { ContractNotificationKind } from "@prisma/client";
import {
  acknowledgeNotification,
  sendStandaloneNotification,
} from "../_lib/notification-actions";

const KIND_LABEL: Record<ContractNotificationKind, string> = {
  RENOUVELLEMENT: "Renouvellement de contrat",
  NON_RENOUVELLEMENT: "Non-renouvellement de contrat",
  CONFIRMATION_PERIODE_ESSAI: "Confirmation de période d'essai",
  FIN_PERIODE_ESSAI: "Fin de période d'essai",
  RUPTURE_ANTICIPEE: "Rupture anticipée",
};

// Les renouvellements / non-renouvellements passent par le module Renouvellement.
const STANDALONE_KINDS: ContractNotificationKind[] = [
  ContractNotificationKind.CONFIRMATION_PERIODE_ESSAI,
  ContractNotificationKind.FIN_PERIODE_ESSAI,
  ContractNotificationKind.RUPTURE_ANTICIPEE,
];

export function NewNotificationButton({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await sendStandaloneNotification(contractId, formData);
      formRef.current?.reset();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker"
      >
        + Nouvelle notification
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-md border border-sc-border bg-sc-blue-bg p-3"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
            Type
          </span>
          <select
            name="kind"
            required
            defaultValue=""
            className="w-full rounded-md border border-sc-border bg-white px-3 py-2 text-[12px]"
          >
            <option value="" disabled>
              Sélectionner…
            </option>
            {STANDALONE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
            Motif / observations
          </span>
          <textarea
            name="reason"
            rows={2}
            className="w-full resize-y rounded-md border border-sc-border bg-white px-3 py-2 text-[12px]"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {error && (
          <span className="mr-auto rounded-md bg-sc-danger-light px-2 py-1 text-[11px] font-semibold text-sc-danger">
            {error}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker disabled:opacity-50"
        >
          {pending ? "Envoi…" : "Émettre + générer la lettre"}
        </button>
      </div>
    </form>
  );
}

export function AcknowledgeButton({ notificationId }: { notificationId: string }) {
  const [pending, setPending] = useState(false);
  async function onClick() {
    setPending(true);
    try {
      await acknowledgeNotification(notificationId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setPending(false);
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-md border border-sc-border bg-white px-2 py-1 text-[11px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light disabled:opacity-50"
    >
      {pending ? "…" : "Acquitter"}
    </button>
  );
}
