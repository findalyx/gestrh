"use client";

import { useActionState } from "react";
import { addApplication } from "../_lib/actions";
import type { ApplicationFormState } from "../_lib/schema";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

export function ApplicationForm({ postingId }: { postingId: string }) {
  const action = addApplication.bind(null, postingId);
  const [state, formAction, pending] = useActionState<
    ApplicationFormState | undefined,
    FormData
  >(action, undefined);

  const v = (
    k: "candidateName" | "candidateEmail" | "candidatePhone" | "cvUrl" | "notes",
  ) => state?.values?.[k] ?? "";
  const err = (k: string) => state?.errors?.[k as never]?.[0];

  return (
    <form action={formAction} className="space-y-4">
      {state?.errors?._form && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3.5 py-2.5 text-[12.5px] text-sc-danger">
          {state.errors._form[0]}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="candidateName"
            className="text-[12px] font-medium text-sc-blue-darker"
          >
            Nom complet <span className="text-sc-danger">*</span>
          </label>
          <input
            id="candidateName"
            name="candidateName"
            defaultValue={v("candidateName") as string}
            required
            className={inputCls}
          />
          {err("candidateName") && (
            <p className="text-[11.5px] text-sc-danger">{err("candidateName")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="candidateEmail"
            className="text-[12px] font-medium text-sc-blue-darker"
          >
            Email <span className="text-sc-danger">*</span>
          </label>
          <input
            id="candidateEmail"
            name="candidateEmail"
            type="email"
            defaultValue={v("candidateEmail") as string}
            required
            className={inputCls}
          />
          {err("candidateEmail") && (
            <p className="text-[11.5px] text-sc-danger">{err("candidateEmail")}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="candidatePhone"
          className="text-[12px] font-medium text-sc-blue-darker"
        >
          Téléphone
        </label>
        <input
          id="candidatePhone"
          name="candidatePhone"
          defaultValue={v("candidatePhone") as string}
          className={inputCls}
        />
        {err("candidatePhone") && (
          <p className="text-[11.5px] text-sc-danger">{err("candidatePhone")}</p>
        )}
      </div>

      <fieldset className="rounded-lg border border-sc-border bg-gray-50 p-3.5">
        <legend className="px-1.5 text-[11.5px] font-medium text-sc-blue-darker">
          CV (au moins l&apos;un des deux)
        </legend>
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="cvFile"
              className="text-[11.5px] font-medium text-gray-700"
            >
              Fichier CV
            </label>
            <input
              id="cvFile"
              name="cvFile"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
              className="block w-full text-[12.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-sc-blue file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-white hover:file:bg-sc-blue-dark"
            />
            <p className="text-[11px] text-gray-500">
              PDF, Word, ou image — 5 MB max
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="cvUrl"
              className="text-[11.5px] font-medium text-gray-700"
            >
              ou lien externe
            </label>
            <input
              id="cvUrl"
              name="cvUrl"
              type="url"
              placeholder="https://…"
              defaultValue={v("cvUrl") as string}
              className={inputCls}
            />
            {err("cvUrl") && (
              <p className="text-[11.5px] text-sc-danger">{err("cvUrl")}</p>
            )}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-[12px] font-medium text-sc-blue-darker">
          Notes / parcours
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={v("notes") as string}
          placeholder="Provenance, motivation, points clés du parcours…"
          className={`${inputCls} resize-none`}
        />
        {err("notes") && (
          <p className="text-[11.5px] text-sc-danger">{err("notes")}</p>
        )}
      </div>

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-5 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Ajout…" : "Ajouter le candidat"}
        </button>
      </div>
    </form>
  );
}
