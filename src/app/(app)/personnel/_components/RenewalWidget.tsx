"use client";

import { useState } from "react";
import { RenewalDecision } from "@prisma/client";
import {
  decideRenewal,
  openRenewal,
  sendRenewalNotification,
} from "../_lib/renewal-actions";

const DECISION_LABEL: Record<RenewalDecision, string> = {
  EN_COURS: "Décision en cours",
  RENOUVELE: "Renouveler le CDD",
  CONVERTI_CDI: "Convertir en CDI",
  NON_RENOUVELE: "Ne pas renouveler",
};

export function OpenRenewalButton({ contractId }: { contractId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      await openRenewal(contractId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker disabled:opacity-50"
      >
        {pending ? "Ouverture…" : "Ouvrir un dossier de renouvellement"}
      </button>
      {error && (
        <p className="mt-2 text-[11px] font-semibold text-sc-danger">{error}</p>
      )}
    </div>
  );
}

export function DecisionForm({ renewalId }: { renewalId: string }) {
  const [decision, setDecision] = useState<RenewalDecision>(RenewalDecision.RENOUVELE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await decideRenewal(renewalId, formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      action={action}
      className="mt-4 grid grid-cols-1 gap-3 rounded-md bg-sc-blue-bg p-4 md:grid-cols-2"
    >
      <label className="block md:col-span-2">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
          Décision
        </span>
        <select
          name="decision"
          value={decision}
          onChange={(e) => setDecision(e.target.value as RenewalDecision)}
          className="w-full rounded-md border border-sc-border bg-white px-3 py-2 text-[12px]"
        >
          <option value={RenewalDecision.RENOUVELE}>
            {DECISION_LABEL.RENOUVELE}
          </option>
          <option value={RenewalDecision.CONVERTI_CDI}>
            {DECISION_LABEL.CONVERTI_CDI}
          </option>
          <option value={RenewalDecision.NON_RENOUVELE}>
            {DECISION_LABEL.NON_RENOUVELE}
          </option>
        </select>
      </label>

      {decision === RenewalDecision.RENOUVELE && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            Nouvelle date de fin <span className="text-sc-danger">*</span>
          </span>
          <input
            type="date"
            name="newEndDate"
            required
            className="w-full rounded-md border border-sc-border bg-white px-3 py-2 text-[12px]"
          />
        </label>
      )}

      {decision === RenewalDecision.CONVERTI_CDI && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            Date de prise d&apos;effet du CDI
          </span>
          <input
            type="date"
            name="newStartDate"
            className="w-full rounded-md border border-sc-border bg-white px-3 py-2 text-[12px]"
          />
          <span className="mt-1 block text-[10px] text-gray-500">
            Vide = au lendemain de l&apos;échéance du CDD actuel.
          </span>
        </label>
      )}

      <label className="block md:col-span-2">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
          Motif / observations
        </span>
        <textarea
          name="reason"
          rows={2}
          placeholder="Performances, besoins du service, restriction budgétaire…"
          className="w-full resize-y rounded-md border border-sc-border bg-white px-3 py-2 text-[12px]"
        />
      </label>

      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {error && (
          <span className="mr-auto rounded-md bg-sc-danger-light px-2 py-1 text-[11px] font-semibold text-sc-danger">
            {error}
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sc-blue px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer la décision"}
        </button>
      </div>
    </form>
  );
}

export function NotifyButton({
  renewalId,
  notified,
}: {
  renewalId: string;
  notified: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (notified) return;
    setPending(true);
    setError(null);
    try {
      await sendRenewalNotification(renewalId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || notified}
        className="rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker disabled:opacity-50"
      >
        {notified
          ? "Agent déjà notifié"
          : pending
            ? "Envoi…"
            : "Notifier l'agent (génération de la lettre)"}
      </button>
      {error && (
        <p className="mt-2 text-[11px] font-semibold text-sc-danger">{error}</p>
      )}
    </div>
  );
}
