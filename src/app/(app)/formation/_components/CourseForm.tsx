"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createCourse, updateCourse } from "../_lib/actions";
import type { CourseFormState } from "../_lib/schema";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

const CATEGORIES = [
  "Pédagogie",
  "Numérique",
  "Recherche",
  "Management",
  "Langues",
  "Hygiène & sécurité",
  "Soft skills",
  "Autre",
];

type Defaults = {
  title?: string;
  category?: string;
  description?: string | null;
  isInternal?: boolean;
  instructor?: string | null;
  objectives?: string | null;
  durationHours?: number | null;
};

export function CourseForm({
  editing,
  defaults,
}: {
  editing?: { id: string };
  defaults?: Defaults;
} = {}) {
  const action = editing
    ? updateCourse.bind(null, editing.id)
    : createCourse;
  const [state, formAction, pending] = useActionState<
    CourseFormState | undefined,
    FormData
  >(action, undefined);

  const v = (k: string): string =>
    (state?.values as Record<string, string> | undefined)?.[k] ?? "";
  const err = (k: string) => state?.errors?.[k as never]?.[0];

  const dflt = (k: keyof Defaults): string => {
    const val = defaults?.[k];
    if (val === null || val === undefined) return "";
    if (typeof val === "boolean") return val ? "on" : "";
    return String(val);
  };

  return (
    <form action={formAction} className="space-y-5">
      {state?.errors?._form && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3.5 py-2.5 text-[12.5px] text-sc-danger">
          {state.errors._form[0]}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-lg border border-sc-green/30 bg-sc-green-light px-3.5 py-2.5 text-[12.5px] text-sc-green-dark">
          ✓ {state.message}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-[12px] font-medium text-sc-blue-darker">
          Titre <span className="text-sc-danger">*</span>
        </label>
        <input
          id="title"
          name="title"
          defaultValue={v("title") || dflt("title")}
          required
          className={inputCls}
        />
        {err("title") && <p className="text-[11.5px] text-sc-danger">{err("title")}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_140px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-[12px] font-medium text-sc-blue-darker">
            Catégorie <span className="text-sc-danger">*</span>
          </label>
          <input
            id="category"
            name="category"
            list="course-categories"
            defaultValue={v("category") || dflt("category")}
            required
            className={inputCls}
          />
          <datalist id="course-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {err("category") && (
            <p className="text-[11.5px] text-sc-danger">{err("category")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="instructor"
            className="text-[12px] font-medium text-sc-blue-darker"
          >
            Formateur / intervenant
          </label>
          <input
            id="instructor"
            name="instructor"
            defaultValue={v("instructor") || dflt("instructor")}
            placeholder="Nom et qualité"
            className={inputCls}
          />
          {err("instructor") && (
            <p className="text-[11.5px] text-sc-danger">{err("instructor")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="durationHours"
            className="text-[12px] font-medium text-sc-blue-darker"
          >
            Durée totale (h)
          </label>
          <input
            id="durationHours"
            name="durationHours"
            type="number"
            min={1}
            max={500}
            defaultValue={v("durationHours") || dflt("durationHours")}
            className={inputCls}
          />
          {err("durationHours") && (
            <p className="text-[11.5px] text-sc-danger">{err("durationHours")}</p>
          )}
        </div>
      </div>

      <div className="flex items-end">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2 text-[13px]">
          <input
            type="checkbox"
            name="isInternal"
            defaultChecked={
              v("isInternal") === "on" || dflt("isInternal") === "on" ||
              (!state && !defaults) // par défaut coché en création
            }
            className="h-4 w-4 accent-sc-blue"
          />
          <span className="text-sc-blue-darker">Formation interne</span>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="text-[12px] font-medium text-sc-blue-darker"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={v("description") || dflt("description")}
          placeholder="Présentation générale, public cible, prérequis…"
          className={`${inputCls} resize-none`}
        />
        {err("description") && (
          <p className="text-[11.5px] text-sc-danger">{err("description")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="objectives"
          className="text-[12px] font-medium text-sc-blue-darker"
        >
          Objectifs pédagogiques
        </label>
        <textarea
          id="objectives"
          name="objectives"
          rows={4}
          maxLength={2000}
          defaultValue={v("objectives") || dflt("objectives")}
          placeholder="À l'issue de la formation, les participants seront capables de…"
          className={`${inputCls} resize-none`}
        />
        {err("objectives") && (
          <p className="text-[11.5px] text-sc-danger">{err("objectives")}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-sc-border pt-4">
        <Link
          href={editing ? `/formation/${editing.id}` : "/formation"}
          className="rounded-lg border border-sc-border bg-white px-4 py-2.5 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending
            ? editing
              ? "Enregistrement…"
              : "Création…"
            : editing
              ? "Enregistrer"
              : "Créer le cours"}
        </button>
      </div>
    </form>
  );
}
