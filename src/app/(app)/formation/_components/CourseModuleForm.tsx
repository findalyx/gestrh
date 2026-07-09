"use client";

import { useActionState, useEffect, useRef } from "react";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { addCourseModule, deleteCourseModule } from "../_lib/actions";
import type {
  CourseModuleFormState,
  TrainingActionState,
} from "../_lib/schema";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

export function CourseModuleForm({ courseId }: { courseId: string }) {
  const action = addCourseModule.bind(null, courseId);
  const [state, formAction, pending] = useActionState<
    CourseModuleFormState | undefined,
    FormData
  >(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const err = (k: string) => state?.errors?.[k as never]?.[0];

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px]">
        <div>
          <input
            name="title"
            placeholder="Titre du module (ex : Introduction, Module pratique…)"
            required
            maxLength={140}
            className={inputCls}
          />
          {err("title") && (
            <p className="mt-1 text-[11px] text-sc-danger">{err("title")}</p>
          )}
        </div>
        <div>
          <input
            name="durationHours"
            type="number"
            min={1}
            max={200}
            placeholder="Durée (h)"
            className={inputCls}
          />
          {err("durationHours") && (
            <p className="mt-1 text-[11px] text-sc-danger">
              {err("durationHours")}
            </p>
          )}
        </div>
      </div>
      <textarea
        name="description"
        rows={2}
        maxLength={1000}
        placeholder="Contenu du module (optionnel)"
        className={`${inputCls} resize-none`}
      />
      {err("description") && (
        <p className="text-[11px] text-sc-danger">{err("description")}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        {state?.ok && (
          <span className="text-[11.5px] text-sc-green-dark">✓ Module ajouté</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Ajout…" : "Ajouter le module"}
        </button>
      </div>
    </form>
  );
}

export function DeleteModuleButton({ moduleId }: { moduleId: string }) {
  return (
    <ConfirmSubmitButton
      action={deleteCourseModule.bind(null, moduleId) as never}
      label="Supprimer"
      confirmText="Supprimer ce module ?"
    />
  );
}
