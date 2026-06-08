"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendBirthdayWish } from "../_lib/actions";

export function BirthdayWish({
  agentId,
  firstName,
  canSend,
}: {
  agentId: string;
  firstName: string;
  /** false si la personne n'a pas de compte pour recevoir le message. */
  canSend: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      const res = await sendBirthdayWish(agentId, formData);
      if (!res.ok) setError(res.error);
      else {
        setDone(true);
        setOpen(false);
        formRef.current?.reset();
        router.refresh();
      }
    } catch {
      setError("Échec de l'envoi.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="mt-2 text-[12px] font-medium text-sc-green-dark">
        ✓ Message envoyé à {firstName} 🎉
      </p>
    );
  }

  if (!canSend) {
    return (
      <p className="mt-2 text-[11px] text-gray-400">
        Pas de compte pour recevoir un message.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sc-purple px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
      >
        🎂 Souhaiter un anniversaire
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="mt-2 space-y-2">
      <textarea
        name="message"
        required
        rows={2}
        maxLength={500}
        autoFocus
        placeholder={`Un mot pour ${firstName}…`}
        className="w-full resize-y rounded-lg border border-sc-border bg-white px-3 py-2 text-[12.5px] outline-none focus:border-sc-purple"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-purple px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Envoi…" : "Envoyer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Annuler
        </button>
        {error && (
          <span className="text-[11.5px] font-medium text-sc-danger">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
