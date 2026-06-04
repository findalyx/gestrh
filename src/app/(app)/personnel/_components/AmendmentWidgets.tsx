"use client";

import { useRef, useState } from "react";
import { AmendmentType } from "@prisma/client";
import {
  createAmendment,
  deleteAmendment,
  uploadSignedAmendment,
} from "../_lib/amendment-actions";

const inputCls =
  "w-full rounded-md border border-sc-border bg-white px-3 py-2 text-[12px] outline-none focus:border-sc-blue";

const TYPE_LABEL: Record<AmendmentType, string> = {
  SALAIRE: "Modification de salaire",
  GRADE: "Changement de grade",
  FONCTION: "Changement de fonction",
  HORAIRES: "Modification d'horaires",
  MUTATION: "Mutation",
  AUTRE: "Autre",
};

export function NewAmendmentButton({
  contractId,
  contractReference,
}: {
  contractId: string;
  contractReference: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await createAmendment(contractId, formData);
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
        + Créer un avenant
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="grid grid-cols-1 gap-3 rounded-md border border-sc-border bg-sc-blue-bg p-4 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <h3 className="font-serif text-[14px] font-semibold text-sc-blue-darker">
          Nouvel avenant · contrat {contractReference}
        </h3>
      </div>
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Type <span className="text-sc-danger">*</span>
        </span>
        <select name="type" required defaultValue="" className={inputCls}>
          <option value="" disabled>
            Sélectionner…
          </option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Date d&apos;effet <span className="text-sc-danger">*</span>
        </span>
        <input type="date" name="effectiveDate" required className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Ancienne valeur
        </span>
        <input type="text" name="oldValue" placeholder="ex. 450 000 FCFA" className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Nouvelle valeur
        </span>
        <input type="text" name="newValue" placeholder="ex. 475 000 FCFA" className={inputCls} />
      </label>
      <label className="block md:col-span-2">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Description <span className="text-sc-danger">*</span>
        </span>
        <textarea
          name="description"
          rows={3}
          required
          className={inputCls + " resize-y"}
          placeholder="Motif et portée de la modification…"
        />
      </label>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
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
          {pending ? "Création…" : "Créer l'avenant"}
        </button>
      </div>
    </form>
  );
}

export function UploadSignedAmendment({
  amendmentId,
  alreadyUploaded,
}: {
  amendmentId: string;
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
      await uploadSignedAmendment(amendmentId, formData);
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
        className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[11px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
      >
        {alreadyUploaded ? "Remplacer le signé" : "Téléverser le signé"}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-sc-border bg-sc-blue-bg p-3"
    >
      <input
        type="file"
        name="file"
        required
        accept=".pdf,.jpg,.jpeg,.png"
        className="block text-[12px] file:mr-2 file:rounded-md file:border-0 file:bg-sc-blue-light file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-sc-blue"
      />
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

export function DeleteAmendmentButton({ amendmentId }: { amendmentId: string }) {
  const [pending, setPending] = useState(false);
  async function onClick() {
    if (!confirm("Supprimer cet avenant ? Cette action est définitive.")) return;
    setPending(true);
    try {
      await deleteAmendment(amendmentId);
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
      {pending ? "…" : "Supprimer"}
    </button>
  );
}
