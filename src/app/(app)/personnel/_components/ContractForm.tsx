"use client";

import { useActionState } from "react";
import { ContractStatus, ContractType } from "@prisma/client";
import {
  createContract,
  updateContract,
  uploadContractPdf,
  deleteContractPdf,
  type ContractActionState,
  type ContractFormState,
} from "../_lib/contract-actions";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

const TYPE_LABEL: Record<ContractType, string> = {
  CDI: "CDI",
  CDD: "CDD",
  VACATAIRE: "Vacataire",
  STAGE: "Stage",
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  RENOUVELE: "Renouvelé",
  RESILIE: "Résilié",
  EN_ATTENTE_SIGNATURE: "En attente de signature",
  ROMPU: "Rompu",
};

type ContractDefaults = {
  type?: ContractType;
  status?: ContractStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  grade?: string | null;
  baseSalary?: number;
};

function toISO(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function NewContractForm({
  agentId,
  editing,
  defaults,
}: {
  agentId?: string;
  editing?: { contractId: string };
  defaults?: ContractDefaults;
}) {
  const action = editing
    ? updateContract.bind(null, editing.contractId)
    : createContract.bind(null, agentId!);
  const [state, formAction, pending] = useActionState<
    ContractFormState | undefined,
    FormData
  >(action, undefined);

  const v = (k: string): string =>
    (state?.values as Record<string, string> | undefined)?.[k] ?? "";
  const err = (k: string) => state?.errors?.[k as never]?.[0];
  // En création : reset après succès. En édition : on conserve les valeurs.
  const cleared = !editing && state?.ok;
  const val = (k: string) => {
    if (cleared) return "";
    const formValue = v(k);
    if (formValue) return formValue;
    if (defaults) {
      if (k === "type") return defaults.type ?? "";
      if (k === "status") return defaults.status ?? "";
      if (k === "startDate") return toISO(defaults.startDate);
      if (k === "endDate") return toISO(defaults.endDate);
      if (k === "grade") return defaults.grade ?? "";
      if (k === "baseSalary") return defaults.baseSalary?.toString() ?? "";
    }
    return "";
  };

  return (
    <form action={formAction} className="space-y-4">
      {err("_form") && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3 py-2 text-[12.5px] text-sc-danger">
          {err("_form")}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-lg border border-sc-green/30 bg-sc-green-light px-3 py-2 text-[12.5px] text-sc-green-dark">
          ✓ {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-[12px] font-medium text-sc-blue-darker">
            Type <span className="text-sc-danger">*</span>
          </label>
          <select
            id="type"
            name="type"
            defaultValue={val("type") || ContractType.CDI}
            required
            className={inputCls}
          >
            {(Object.keys(TYPE_LABEL) as ContractType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-[12px] font-medium text-sc-blue-darker">
            Statut
          </label>
          <select
            id="status"
            name="status"
            defaultValue={val("status") || ContractStatus.ACTIF}
            className={inputCls}
          >
            {(Object.keys(STATUS_LABEL) as ContractStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="startDate"
            className="text-[12px] font-medium text-sc-blue-darker"
          >
            Date de début <span className="text-sc-danger">*</span>
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={val("startDate")}
            required
            className={inputCls}
          />
          {err("startDate") && (
            <p className="text-[11.5px] text-sc-danger">{err("startDate")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="endDate"
            className="text-[12px] font-medium text-sc-blue-darker"
          >
            Date de fin <span className="text-[10.5px] text-gray-400">(CDD)</span>
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={val("endDate")}
            className={inputCls}
          />
          {err("endDate") && (
            <p className="text-[11.5px] text-sc-danger">{err("endDate")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="grade" className="text-[12px] font-medium text-sc-blue-darker">
            Échelon / grade
          </label>
          <input
            id="grade"
            name="grade"
            defaultValue={val("grade")}
            placeholder="Ex : Échelon 5"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="baseSalary"
            className="text-[12px] font-medium text-sc-blue-darker"
          >
            Salaire de base (FCFA) <span className="text-sc-danger">*</span>
          </label>
          <input
            id="baseSalary"
            name="baseSalary"
            type="number"
            min={0}
            step={5000}
            defaultValue={val("baseSalary") || "300000"}
            required
            className={inputCls}
          />
          {err("baseSalary") && (
            <p className="text-[11.5px] text-sc-danger">{err("baseSalary")}</p>
          )}
        </div>
      </div>

      {/* Champ PDF uniquement en création — l'édition se fait via les
          boutons dédiés "Remplacer" / "Supprimer PDF" sur la carte. */}
      {!editing && (
        <div className="flex flex-col gap-1">
          <label htmlFor="pdf" className="text-[12px] font-medium text-sc-blue-darker">
            PDF du contrat signé{" "}
            <span className="text-[10.5px] text-gray-400">(optionnel)</span>
          </label>
          <input
            id="pdf"
            name="pdf"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="block w-full text-[12.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-sc-blue file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-white hover:file:bg-sc-blue-dark"
          />
          <p className="text-[11px] text-gray-500">PDF, PNG ou JPG · 10 Mo max</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-4 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending
            ? editing
              ? "Enregistrement…"
              : "Création…"
            : editing
              ? "Enregistrer"
              : "Créer le contrat"}
        </button>
      </div>
    </form>
  );
}

export function UploadContractPdfForm({ contractId }: { contractId: string }) {
  const action = uploadContractPdf.bind(null, contractId);
  const [state, formAction, pending] = useActionState<ContractActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="pdf"
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        required
        className="block text-[11.5px] file:mr-2 file:rounded file:border-0 file:bg-sc-blue file:px-2 file:py-1 file:text-[11px] file:font-medium file:text-white hover:file:bg-sc-blue-dark"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-blue px-2.5 py-1 text-[11.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
      >
        {pending ? "…" : "Envoyer"}
      </button>
      {state?.ok && <span className="text-[11px] text-sc-green-dark">✓ OK</span>}
      {state && !state.ok && (
        <span className="text-[11px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

export function DeleteContractPdfButton({ contractId }: { contractId: string }) {
  const action = deleteContractPdf.bind(null, contractId);
  const [state, formAction, pending] = useActionState<ContractActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        className="text-[11px] text-gray-500 transition hover:text-sc-danger disabled:opacity-60"
        title="Supprimer le PDF"
      >
        {pending ? "…" : "Supprimer PDF"}
      </button>
      {state && !state.ok && (
        <span className="ml-1 text-[10.5px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}
