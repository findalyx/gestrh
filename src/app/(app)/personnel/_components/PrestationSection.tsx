"use client";

import { useActionState, useState } from "react";
import { PrestationStatus } from "@prisma/client";
import {
  createPrestationInvoice,
  updatePrestationInvoice,
  uploadPrestationDocument,
  setPrestationStatus,
  deletePrestationInvoice,
  type PrestationFormState,
  type PrestationActionState,
} from "../_lib/prestation-actions";

const FCFA = new Intl.NumberFormat("fr-FR");

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

export type PrestationItem = {
  id: string;
  period: string; // YYYY-MM
  amount: number;
  label: string | null;
  status: PrestationStatus;
  documentName: string | null;
  hasDocument: boolean;
  paidAt: string | null;
};

const STATUS_META: Record<
  PrestationStatus,
  { label: string; cls: string }
> = {
  EN_ATTENTE: {
    label: "En attente de document",
    cls: "bg-sc-warning-light text-[#854f0b]",
  },
  SIGNE: { label: "Signé", cls: "bg-sc-blue-light text-sc-blue" },
  PAYE: { label: "Payé", cls: "bg-sc-green-light text-sc-green-dark" },
};

function formatPeriod(p: string): string {
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

export function PrestationSection({
  agentId,
  items,
  canEdit,
}: {
  agentId: string;
  items: PrestationItem[];
  canEdit: boolean;
}) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  const paid = items
    .filter((i) => i.status === "PAYE")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-3">
      {/* Synthèse */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-sc-border bg-sc-blue-bg/30 px-4 py-2.5 text-[12.5px]">
          <span>
            <strong>{items.length}</strong> prestation
            {items.length > 1 ? "s" : ""}
          </span>
          <span className="text-gray-600">
            Total : <strong className="font-mono">{FCFA.format(total)}</strong>{" "}
            FCFA
          </span>
          <span className="text-sc-green-dark">
            Payé : <strong className="font-mono">{FCFA.format(paid)}</strong>{" "}
            FCFA
          </span>
        </div>
      )}

      {/* Liste */}
      {items.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          Aucune prestation mensuelle enregistrée.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <PrestationRow key={item.id} item={item} canEdit={canEdit} />
          ))}
        </div>
      )}

      {/* Ajouter */}
      {canEdit && (
        <details className="rounded-xl border border-sc-border bg-white">
          <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-semibold text-sc-blue-darker">
            + Ajouter une prestation mensuelle
          </summary>
          <div className="border-t border-sc-border p-4">
            <AddPrestationForm agentId={agentId} />
          </div>
        </details>
      )}
    </div>
  );
}

// ============================================================
//  Ligne d'une prestation
// ============================================================
function PrestationRow({
  item,
  canEdit,
}: {
  item: PrestationItem;
  canEdit: boolean;
}) {
  const meta = STATUS_META[item.status];
  return (
    <div className="rounded-lg border border-sc-border bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sc-blue-darker">
              {formatPeriod(item.period)}
            </span>
            <span
              className={`inline-flex rounded-full px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider ${meta.cls}`}
            >
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[13px] text-sc-blue-darker">
            {FCFA.format(item.amount)} FCFA
          </p>
          {item.label && (
            <p className="text-[12px] text-gray-600">{item.label}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {item.hasDocument ? (
            <a
              href={`/api/prestation/${item.id}/document`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sc-blue px-2.5 py-1 text-[11.5px] font-medium text-white transition hover:bg-sc-blue-dark"
            >
              📄 Document signé
            </a>
          ) : (
            <span className="text-[11px] text-gray-400">Aucun document</span>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-sc-border/60 pt-2.5">
          {/* Joindre / remplacer le document */}
          <details className="text-left">
            <summary className="cursor-pointer text-[11px] font-medium text-sc-blue hover:underline">
              {item.hasDocument ? "Remplacer le document" : "Joindre le document"}
            </summary>
            <div className="mt-1.5">
              <UploadDocForm invoiceId={item.id} />
            </div>
          </details>

          {/* Marquer signé / payé */}
          {item.status !== "SIGNE" && item.hasDocument && (
            <StatusButton
              invoiceId={item.id}
              target="SIGNE"
              label="Marquer signé"
            />
          )}
          {item.status !== "PAYE" && (
            <StatusButton invoiceId={item.id} target="PAYE" label="Marquer payé" />
          )}
          {item.status === "PAYE" && (
            <StatusButton
              invoiceId={item.id}
              target="SIGNE"
              label="Annuler le paiement"
            />
          )}

          <DeleteButton invoiceId={item.id} />
        </div>
      )}
    </div>
  );
}

// ============================================================
//  Formulaire d'ajout
// ============================================================
function AddPrestationForm({ agentId }: { agentId: string }) {
  const action = createPrestationInvoice.bind(null, agentId);
  const [state, formAction, pending] = useActionState<
    PrestationFormState | undefined,
    FormData
  >(action, undefined);

  const err = (k: string) => state?.errors?.[k as never]?.[0];
  const cleared = state?.ok;
  const v = (k: string) => (cleared ? "" : (state?.values?.[k] ?? ""));

  // Mois courant par défaut (YYYY-MM)
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <form action={formAction} className="space-y-3">
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
          <label htmlFor="period" className="text-[12px] font-medium text-sc-blue-darker">
            Mois <span className="text-sc-danger">*</span>
          </label>
          <input
            id="period"
            name="period"
            type="month"
            defaultValue={v("period") || defaultPeriod}
            required
            className={inputCls}
          />
          {err("period") && (
            <p className="text-[11.5px] text-sc-danger">{err("period")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="amount" className="text-[12px] font-medium text-sc-blue-darker">
            Montant (FCFA) <span className="text-sc-danger">*</span>
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min={1}
            step={5000}
            defaultValue={v("amount")}
            placeholder="Ex : 500000"
            required
            className={inputCls}
          />
          {err("amount") && (
            <p className="text-[11.5px] text-sc-danger">{err("amount")}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="label" className="text-[12px] font-medium text-sc-blue-darker">
          Libellé <span className="text-[10.5px] text-gray-400">(optionnel)</span>
        </label>
        <input
          id="label"
          name="label"
          defaultValue={v("label")}
          placeholder="Ex : Enseignement + jury de soutenance"
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="document" className="text-[12px] font-medium text-sc-blue-darker">
          Document signé{" "}
          <span className="text-[10.5px] text-gray-400">
            (bon / facture / attestation — optionnel)
          </span>
        </label>
        <input
          id="document"
          name="document"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="block w-full text-[12.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-sc-blue file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-white hover:file:bg-sc-blue-dark"
        />
        <p className="text-[11px] text-gray-500">PDF, PNG, JPG ou WebP · 10 Mo max</p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-4 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer la prestation"}
        </button>
      </div>
    </form>
  );
}

function UploadDocForm({ invoiceId }: { invoiceId: string }) {
  const action = uploadPrestationDocument.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState<PrestationActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="document"
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
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

function StatusButton({
  invoiceId,
  target,
  label,
}: {
  invoiceId: string;
  target: PrestationStatus;
  label: string;
}) {
  const action = setPrestationStatus.bind(null, invoiceId, target);
  const [state, formAction, pending] = useActionState<PrestationActionState, FormData>(
    action,
    undefined,
  );
  const emphasis =
    target === "PAYE"
      ? "border-sc-green/40 text-sc-green-dark hover:bg-sc-green-light"
      : "border-sc-border text-sc-blue-darker hover:bg-sc-blue-bg";
  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg border bg-white px-2 py-0.5 text-[10.5px] font-medium transition disabled:opacity-60 ${emphasis}`}
      >
        {pending ? "…" : label}
      </button>
      {state && !state.ok && (
        <span className="ml-1 text-[10.5px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}

function DeleteButton({ invoiceId }: { invoiceId: string }) {
  const [confirm, setConfirm] = useState(false);
  const action = deletePrestationInvoice.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState<PrestationActionState, FormData>(
    action,
    undefined,
  );
  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="ml-auto text-[10.5px] text-gray-500 transition hover:text-sc-danger"
      >
        Supprimer
      </button>
    );
  }
  return (
    <form action={formAction} className="ml-auto inline-flex items-center gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sc-danger px-2 py-0.5 text-[10.5px] font-semibold text-white transition hover:bg-sc-danger/90 disabled:opacity-60"
      >
        {pending ? "…" : "Confirmer"}
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="text-[10.5px] text-gray-500 hover:text-sc-blue-darker"
      >
        Annuler
      </button>
      {state && !state.ok && (
        <span className="text-[10.5px] text-sc-danger">{state.error}</span>
      )}
    </form>
  );
}
