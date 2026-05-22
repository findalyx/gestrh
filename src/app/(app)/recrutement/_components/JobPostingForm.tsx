"use client";

import { useActionState } from "react";
import Link from "next/link";
import { StaffCategory } from "@prisma/client";
import { createJobPosting } from "../_lib/actions";
import type { JobPostingFormState } from "../_lib/schema";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

type Service = { id: string; name: string };

export function JobPostingForm({ services }: { services: Service[] }) {
  const [state, formAction, pending] = useActionState<
    JobPostingFormState | undefined,
    FormData
  >(createJobPosting, undefined);

  const v = (
    k: "title" | "description" | "category" | "openings" | "serviceId" | "closesAt",
  ) => state?.values?.[k] ?? "";
  const err = (k: string) => state?.errors?.[k as never]?.[0];

  return (
    <form action={formAction} className="space-y-5">
      {state?.errors?._form && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3.5 py-2.5 text-[12.5px] text-sc-danger">
          {state.errors._form[0]}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-[12px] font-medium text-sc-blue-darker">
          Intitulé du poste <span className="text-sc-danger">*</span>
        </label>
        <input
          id="title"
          name="title"
          defaultValue={v("title") as string}
          required
          className={inputCls}
        />
        {err("title") && <p className="text-[11.5px] text-sc-danger">{err("title")}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-[12px] font-medium text-sc-blue-darker">
            Catégorie <span className="text-sc-danger">*</span>
          </label>
          <select
            id="category"
            name="category"
            defaultValue={(v("category") as string) || StaffCategory.PER}
            required
            className={inputCls}
          >
            <option value={StaffCategory.PER}>PER (Enseignant / Recherche)</option>
            <option value={StaffCategory.PATS}>PATS (Administratif / Technique)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="openings" className="text-[12px] font-medium text-sc-blue-darker">
            Postes à pourvoir <span className="text-sc-danger">*</span>
          </label>
          <input
            id="openings"
            name="openings"
            type="number"
            min={1}
            max={50}
            defaultValue={(v("openings") as string) || "1"}
            required
            className={inputCls}
          />
          {err("openings") && (
            <p className="text-[11.5px] text-sc-danger">{err("openings")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="closesAt" className="text-[12px] font-medium text-sc-blue-darker">
            Date limite (optionnel)
          </label>
          <input
            id="closesAt"
            name="closesAt"
            type="date"
            defaultValue={v("closesAt") as string}
            className={inputCls}
          />
          {err("closesAt") && (
            <p className="text-[11.5px] text-sc-danger">{err("closesAt")}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="serviceId" className="text-[12px] font-medium text-sc-blue-darker">
          Service de rattachement (optionnel)
        </label>
        <select
          id="serviceId"
          name="serviceId"
          defaultValue={v("serviceId") as string}
          className={inputCls}
        >
          <option value="">— Non précisé —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-[12px] font-medium text-sc-blue-darker">
          Description du poste
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={2000}
          defaultValue={v("description") as string}
          placeholder="Missions, profil recherché, conditions d'exercice…"
          className={`${inputCls} resize-none`}
        />
        {err("description") && (
          <p className="text-[11.5px] text-sc-danger">{err("description")}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-sc-border pt-4">
        <Link
          href="/recrutement"
          className="rounded-lg border border-sc-border bg-white px-4 py-2.5 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Publication…" : "Publier l'offre"}
        </button>
      </div>
    </form>
  );
}
