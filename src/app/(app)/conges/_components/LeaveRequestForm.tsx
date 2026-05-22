"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LeaveType } from "@prisma/client";
import { createLeaveRequest } from "../_lib/actions";
import type { LeaveFormState } from "../_lib/schema";
import { LEAVE_TYPE_LABEL } from "./LeaveBadges";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

export function LeaveRequestForm({
  todayISO,
}: {
  todayISO: string;
}) {
  const [state, formAction, pending] = useActionState<LeaveFormState | undefined, FormData>(
    createLeaveRequest,
    undefined,
  );
  const v = (k: keyof NonNullable<LeaveFormState["values"]>) =>
    state?.values?.[k] ?? "";
  const err = (k: string) => state?.errors?.[k as never]?.[0];

  return (
    <form action={formAction} className="space-y-5">
      {state?.errors?._form && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3.5 py-2.5 text-[12.5px] text-sc-danger">
          {state.errors._form[0]}
        </div>
      )}

      <fieldset className="space-y-4 rounded-xl border border-sc-border bg-white p-5">
        <legend className="px-2 font-serif text-[14px] font-semibold text-sc-blue-darker">
          Demande de congé
        </legend>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="type" className="text-[12px] font-medium text-sc-blue-darker">
            Type de congé <span className="text-sc-danger">*</span>
          </label>
          <select
            id="type"
            name="type"
            defaultValue={v("type") || LeaveType.ANNUEL}
            required
            className={inputCls}
          >
            {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => (
              <option key={t} value={t}>
                {LEAVE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          {err("type") && (
            <p className="text-[11.5px] text-sc-danger">{err("type")}</p>
          )}
        </div>

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
              min={todayISO}
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
              min={todayISO}
              required
              className={inputCls}
            />
            {err("endDate") && (
              <p className="text-[11.5px] text-sc-danger">{err("endDate")}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-[12px] font-medium text-sc-blue-darker">
            Motif / commentaire <span className="text-gray-400 text-[11px]">(optionnel)</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            defaultValue={v("reason") as string}
            rows={3}
            maxLength={500}
            placeholder="Précisions sur la demande (max 500 caractères)"
            className={`${inputCls} resize-none`}
          />
          {err("reason") && (
            <p className="text-[11.5px] text-sc-danger">{err("reason")}</p>
          )}
        </div>
      </fieldset>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/conges"
          className="rounded-lg border border-sc-border bg-white px-4 py-2.5 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Envoi…" : "Soumettre la demande"}
        </button>
      </div>
    </form>
  );
}
