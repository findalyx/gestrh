"use client";

import { useRef, useState } from "react";
import { WellbeingTopic } from "@prisma/client";
import { submitWellbeingPost } from "../_lib/actions";

const TOPIC_LABEL: Record<WellbeingTopic, string> = {
  ENVIRONNEMENT: "Environnement de travail",
  AMELIORATION: "Idée d'amélioration",
  RECONNAISSANCE: "Remerciement / félicitation",
  AUTRE: "Autre",
};

export function FeedbackForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setDone(false);
    setPending(true);
    try {
      const res = await submitWellbeingPost(formData);
      if (!res.ok) setError(res.error);
      else {
        setDone(true);
        formRef.current?.reset();
      }
    } catch {
      setError("Échec de l'envoi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
      <h3 className="flex items-center gap-2 font-serif text-base font-semibold text-sc-blue-darker">
        <span className="h-[18px] w-1 rounded bg-sc-teal" />
        Donner mon avis
      </h3>
      <p className="mt-1 text-[12.5px] text-gray-600">
        Partagez un avis sur l'environnement de travail ou une idée
        d'amélioration.{" "}
        <span className="font-semibold text-sc-green-dark">
          100 % anonyme
        </span>{" "}
        : votre message n'est relié à aucun nom.
      </p>

      <form ref={formRef} action={action} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="topic"
            className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500"
          >
            Sujet
          </label>
          <select
            id="topic"
            name="topic"
            defaultValue="ENVIRONNEMENT"
            className="w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-[9px] text-[13px] outline-none focus:border-sc-blue focus:bg-white sm:w-auto"
          >
            {(Object.keys(TOPIC_LABEL) as WellbeingTopic[]).map((t) => (
              <option key={t} value={t}>
                {TOPIC_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="message"
            className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500"
          >
            Votre message
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={4}
            maxLength={2000}
            placeholder="Ce qui va bien, ce qui pourrait être amélioré, une idée concrète…"
            className="w-full resize-y rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none focus:border-sc-blue focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
          >
            {pending ? "Envoi…" : "Envoyer anonymement"}
          </button>
          {done && (
            <span className="text-[12.5px] font-medium text-sc-green-dark">
              ✓ Merci, votre avis a été transmis anonymement.
            </span>
          )}
          {error && (
            <span className="text-[12.5px] font-medium text-sc-danger">
              {error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
