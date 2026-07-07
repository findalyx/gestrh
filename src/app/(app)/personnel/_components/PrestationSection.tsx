"use client";

import { useActionState, useState } from "react";
import { PrestationStatus } from "@prisma/client";
import {
  createPrestationInvoice,
  uploadPrestationDocument,
  setPrestationStatus,
  deletePrestationInvoice,
  generateHonorairesNote,
  type PrestationFormState,
  type PrestationActionState,
} from "../_lib/prestation-actions";

const FCFA = new Intl.NumberFormat("fr-FR");

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

export type PrestationItem = {
  id: string;
  period: string;
  reference: string | null;
  designation: string | null;
  grossAmount: number;
  withholding: number;
  amount: number; // net
  status: PrestationStatus;
  hasDocument: boolean;
  documentGenerated: boolean;
  paidAt: string | null;
};

const STATUS_META: Record<PrestationStatus, { label: string; cls: string }> = {
  EN_ATTENTE: {
    label: "En attente",
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
  const totalNet = items.reduce((s, i) => s + i.amount, 0);
  const paidNet = items
    .filter((i) => i.status === "PAYE")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-sc-border bg-sc-blue-bg/30 px-4 py-2.5 text-[12.5px]">
          <span>
            <strong>{items.length}</strong> note{items.length > 1 ? "s" : ""}
          </span>
          <span className="text-gray-600">
            Total net :{" "}
            <strong className="font-mono">{FCFA.format(totalNet)}</strong> FCFA
          </span>
          <span className="text-sc-green-dark">
            Payé : <strong className="font-mono">{FCFA.format(paidNet)}</strong>{" "}
            FCFA
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          Aucune note d&apos;honoraires enregistrée.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <PrestationRow key={item.id} item={item} canEdit={canEdit} />
          ))}
        </div>
      )}

      {canEdit && (
        <details className="rounded-xl border border-sc-border bg-white">
          <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-semibold text-sc-blue-darker">
            + Ajouter une note d&apos;honoraires
          </summary>
          <div className="border-t border-sc-border p-4">
            <AddPrestationForm agentId={agentId} />
          </div>
        </details>
      )}
    </div>
  );
}

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
            {item.reference && (
              <span className="font-mono text-[11px] text-gray-500">
                N° {item.reference}
              </span>
            )}
            <span
              className={`inline-flex rounded-full px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider ${meta.cls}`}
            >
              {meta.label}
            </span>
          </div>
          {item.designation && (
            <p className="mt-0.5 text-[12px] text-gray-600">{item.designation}</p>
          )}
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-gray-700">
            <span>
              Brut{" "}
              <span className="font-mono">{FCFA.format(item.grossAmount)}</span>
            </span>
            <span className="text-gray-500">
              − retenue 5% {FCFA.format(item.withholding)}
            </span>
            <span className="font-semibold text-sc-blue-darker">
              Net <span className="font-mono">{FCFA.format(item.amount)}</span>{" "}
              FCFA
            </span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {item.hasDocument ? (
            <>
              <a
                href={`/api/prestation/${item.id}/document`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-sc-blue px-2.5 py-1 text-[11.5px] font-medium text-white transition hover:bg-sc-blue-dark"
              >
                📄 {item.documentGenerated ? "Note générée" : "Document signé"}
              </a>
              <span
                className={
                  item.documentGenerated
                    ? "text-[10px] text-gray-500"
                    : "text-[10px] font-medium text-sc-green-dark"
                }
              >
                {item.documentGenerated ? "à faire signer" : "✓ signé"}
              </span>
            </>
          ) : (
            <span className="text-[11px] text-gray-400">Aucun document</span>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-sc-border/60 pt-2.5">
          <GenerateButton invoiceId={item.id} hasDocument={item.hasDocument} />

          <details className="text-left">
            <summary className="cursor-pointer text-[11px] font-medium text-sc-blue hover:underline">
              Téléverser le document signé
            </summary>
            <div className="mt-1.5">
              <UploadDocForm invoiceId={item.id} />
            </div>
          </details>

          {item.status !== "SIGNE" && item.hasDocument && (
            <StatusButton invoiceId={item.id} target="SIGNE" label="Marquer signé" />
          )}
          {item.status !== "PAYE" && (
            <StatusButton invoiceId={item.id} target="PAYE" label="Marquer payé" />
          )}
          {item.status === "PAYE" && (
            <StatusButton
              invoiceId={item.id}
              target="SIGNE"
              label="Annuler paiement"
            />
          )}

          <DeleteButton invoiceId={item.id} />
        </div>
      )}
    </div>
  );
}

function AddPrestationForm({ agentId }: { agentId: string }) {
  const action = createPrestationInvoice.bind(null, agentId);
  const [state, formAction, pending] = useActionState<
    PrestationFormState | undefined,
    FormData
  >(action, undefined);

  // Aperçu live de la retenue et du net
  const [gross, setGross] = useState<number>(0);
  const withholding = Math.round(gross * 0.05);
  const net = gross - withholding;

  const err = (k: string) => state?.errors?.[k as never]?.[0];
  const cleared = state?.ok;
  const v = (k: string) => (cleared ? "" : (state?.values?.[k] ?? ""));

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
          <label htmlFor="reference" className="text-[12px] font-medium text-sc-blue-darker">
            N° de note{" "}
            <span className="text-[10.5px] text-gray-400">(ex: 004/PP/06/2025)</span>
          </label>
          <input
            id="reference"
            name="reference"
            defaultValue={v("reference")}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="noteDate" className="text-[12px] font-medium text-sc-blue-darker">
            Date de la note
          </label>
          <input
            id="noteDate"
            name="noteDate"
            type="date"
            defaultValue={v("noteDate")}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="designation" className="text-[12px] font-medium text-sc-blue-darker">
          Désignation de l&apos;intervention
        </label>
        <input
          id="designation"
          name="designation"
          defaultValue={v("designation")}
          placeholder="Ex : Coordonnateur pédagogique pharmacie"
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="grossAmount" className="text-[12px] font-medium text-sc-blue-darker">
          Honoraires brut (FCFA) <span className="text-sc-danger">*</span>
        </label>
        <input
          id="grossAmount"
          name="grossAmount"
          type="number"
          min={1}
          step={1000}
          defaultValue={v("grossAmount")}
          onChange={(e) => setGross(Number(e.target.value) || 0)}
          placeholder="Ex : 1578947"
          required
          className={inputCls}
        />
        {err("grossAmount") && (
          <p className="text-[11.5px] text-sc-danger">{err("grossAmount")}</p>
        )}
      </div>

      {/* Aperçu calcul */}
      {gross > 0 && (
        <div className="rounded-lg border border-sc-border bg-sc-blue-bg/30 px-3 py-2 text-[12px]">
          <div className="flex justify-between">
            <span>Total honoraires brut</span>
            <span className="font-mono">{FCFA.format(gross)} FCFA</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Retenue à la source 5%</span>
            <span className="font-mono">− {FCFA.format(withholding)} FCFA</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-sc-border pt-1 font-semibold text-sc-blue-darker">
            <span>Net à payer</span>
            <span className="font-mono">{FCFA.format(net)} FCFA</span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-4 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer la note"}
        </button>
      </div>
    </form>
  );
}

function GenerateButton({
  invoiceId,
  hasDocument,
}: {
  invoiceId: string;
  hasDocument: boolean;
}) {
  const action = generateHonorairesNote.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState<PrestationActionState, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-sc-blue/30 bg-white px-2.5 py-1 text-[11.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg disabled:opacity-60"
      >
        {pending ? "…" : hasDocument ? "↻ Régénérer la note" : "⚙ Générer la note (PDF)"}
      </button>
      {state && !state.ok && (
        <span className="ml-1 text-[10.5px] text-sc-danger">{state.error}</span>
      )}
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
