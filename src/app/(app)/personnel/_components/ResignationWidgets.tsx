"use client";

import { useRef, useState } from "react";
import {
  cancelResignation,
  decideResignation,
  markResignationEffective,
  submitResignation,
  uploadSignedResignation,
} from "../_lib/resignation-actions";

const inputCls =
  "w-full rounded-md border border-sc-border bg-white px-3 py-2 text-[12px] outline-none focus:border-sc-blue";

// ---------------------------------------------------------------
//  Soumission
// ---------------------------------------------------------------

export function SubmitResignationForm({
  contractId,
  contractReference,
  defaultNoticeDays,
}: {
  contractId: string;
  contractReference: string;
  defaultNoticeDays: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Date par défaut = aujourd'hui + préavis (ou 30 jours)
  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (defaultNoticeDays ?? 30));
    return d.toISOString().slice(0, 10);
  })();

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await submitResignation(contractId, formData);
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
      <div className="rounded-xl border border-dashed border-sc-border bg-white p-6">
        <h3 className="font-serif text-[14px] font-semibold text-sc-blue-darker">
          Soumettre une démission
        </h3>
        <p className="mt-1 text-[12px] text-gray-600">
          Vous pouvez initier une démission pour le contrat {contractReference}.
          La DRH sera notifiée et décidera de l&apos;acceptation.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker"
        >
          Initier une démission
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="grid grid-cols-1 gap-3 rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)] md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <h3 className="font-serif text-[14px] font-semibold text-sc-blue-darker">
          Soumettre une démission · contrat {contractReference}
        </h3>
        <p className="text-[11px] text-gray-500">
          Le préavis débute automatiquement à la date de soumission.
        </p>
      </div>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
          Date de départ effective <span className="text-sc-danger">*</span>
        </span>
        <input
          type="date"
          name="effectiveDate"
          required
          defaultValue={defaultDate}
          className={inputCls}
        />
        <span className="mt-1 block text-[10px] text-gray-500">
          {defaultNoticeDays
            ? `Suggestion : aujourd'hui + ${defaultNoticeDays} j (préavis contractuel).`
            : "Suggestion : aujourd'hui + 30 jours."}
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
          Motif (optionnel)
        </span>
        <input
          type="text"
          name="reason"
          placeholder="Opportunité professionnelle, raisons personnelles…"
          className={inputCls}
        />
      </label>
      <div className="flex items-center justify-end gap-2 md:col-span-2">
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
          className="rounded-md bg-sc-blue px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker disabled:opacity-50"
        >
          {pending ? "Envoi…" : "Soumettre"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------
//  Annulation
// ---------------------------------------------------------------

export function CancelResignationButton({ resignationId }: { resignationId: string }) {
  const [pending, setPending] = useState(false);
  async function onClick() {
    if (!confirm("Annuler cette démission ?")) return;
    setPending(true);
    try {
      await cancelResignation(resignationId);
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
      className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[11px] font-semibold text-sc-danger hover:bg-sc-danger-light disabled:opacity-50"
    >
      {pending ? "…" : "Annuler la démission"}
    </button>
  );
}

// ---------------------------------------------------------------
//  Décision DRH
// ---------------------------------------------------------------

export function DecisionForm({ resignationId }: { resignationId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await decideResignation(resignationId, formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={action} className="mt-4 space-y-3 rounded-md bg-sc-blue-bg p-4">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
          Commentaire DRH (optionnel)
        </label>
        <textarea
          name="hrComment"
          rows={2}
          className={inputCls + " resize-y"}
          placeholder="Conditions du préavis, dossier de sortie…"
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {error && (
          <span className="mr-auto rounded-md bg-sc-danger-light px-2 py-1 text-[11px] font-semibold text-sc-danger">
            {error}
          </span>
        )}
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="rounded-md border border-sc-danger bg-white px-3 py-1.5 text-[12px] font-semibold text-sc-danger hover:bg-sc-danger-light disabled:opacity-50"
        >
          Refuser
        </button>
        <button
          type="submit"
          name="decision"
          value="accept"
          disabled={pending}
          className="rounded-md bg-sc-green-dark px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-green disabled:opacity-50"
        >
          Accepter la démission
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------
//  Upload de la lettre signée
// ---------------------------------------------------------------

export function UploadSignedLetter({
  resignationId,
  alreadyUploaded,
}: {
  resignationId: string;
  alreadyUploaded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await uploadSignedResignation(resignationId, formData);
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
        className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
      >
        {alreadyUploaded ? "Remplacer la lettre signée" : "Téléverser la lettre signée"}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-sc-border bg-sc-blue-bg p-3"
    >
      <label className="block flex-1">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Lettre signée scannée (PDF / JPG / PNG)
        </span>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.jpg,.jpeg,.png"
          className="block w-full text-[12px] file:mr-3 file:rounded-md file:border-0 file:bg-sc-blue-light file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-sc-blue"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Téléverser"}
      </button>
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
      {error && (
        <div className="w-full rounded-md border border-sc-danger bg-sc-danger-light px-3 py-1.5 text-[11px] font-semibold text-sc-danger">
          {error}
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------
//  Marquer effectif
// ---------------------------------------------------------------

export function MarkEffectiveButton({ resignationId }: { resignationId: string }) {
  const [pending, setPending] = useState(false);
  async function onClick() {
    if (!confirm("Marquer la démission effective ? Le contrat passera en statut « Rompu ».")) {
      return;
    }
    setPending(true);
    try {
      await markResignationEffective(resignationId);
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
      className="rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker disabled:opacity-50"
    >
      {pending ? "…" : "Marquer la démission effective"}
    </button>
  );
}
