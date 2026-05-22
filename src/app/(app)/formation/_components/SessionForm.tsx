"use client";

import { useActionState } from "react";
import { TrainingStatus } from "@prisma/client";
import { createSession } from "../_lib/actions";
import type { SessionFormState } from "../_lib/schema";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

const STATUS_LABEL: Record<TrainingStatus, string> = {
  PLANIFIEE: "Planifiée",
  OUVERTE: "Ouverte aux inscriptions",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

export function SessionForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState<SessionFormState | undefined, FormData>(
    createSession,
    undefined,
  );
  const v = (k: "startDate" | "endDate" | "location" | "capacity" | "status") =>
    state?.values?.[k] ?? "";
  const err = (k: string) => state?.errors?.[k as never]?.[0];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />

      {state?.errors?._form && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3.5 py-2.5 text-[12.5px] text-sc-danger">
          {state.errors._form[0]}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
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
            defaultValue={v("startDate") as string}
            required
            className={inputCls}
          />
          {err("startDate") && (
            <p className="text-[11.5px] text-sc-danger">{err("startDate")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="endDate"
            className="text-[12px] font-medium text-sc-blue-darker"
          >
            Date de fin <span className="text-sc-danger">*</span>
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={v("endDate") as string}
            required
            className={inputCls}
          />
          {err("endDate") && (
            <p className="text-[11.5px] text-sc-danger">{err("endDate")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="location" className="text-[12px] font-medium text-sc-blue-darker">
            Lieu
          </label>
          <input
            id="location"
            name="location"
            defaultValue={v("location") as string}
            placeholder="Salle, ville, lien visio…"
            className={inputCls}
          />
          {err("location") && (
            <p className="text-[11.5px] text-sc-danger">{err("location")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="capacity" className="text-[12px] font-medium text-sc-blue-darker">
            Capacité
          </label>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={500}
            defaultValue={(v("capacity") as string) || "20"}
            className={inputCls}
          />
          {err("capacity") && (
            <p className="text-[11.5px] text-sc-danger">{err("capacity")}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-[12px] font-medium text-sc-blue-darker">
          Statut initial
        </label>
        <select
          id="status"
          name="status"
          defaultValue={(v("status") as string) || TrainingStatus.PLANIFIEE}
          className={inputCls}
        >
          {(Object.keys(STATUS_LABEL) as TrainingStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-sc-border pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer la session"}
        </button>
      </div>
    </form>
  );
}
