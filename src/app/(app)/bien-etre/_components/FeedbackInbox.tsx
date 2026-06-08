"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WellbeingStatus, WellbeingTopic } from "@prisma/client";
import { setWellbeingStatus } from "../_lib/actions";

const TOPIC_LABEL: Record<WellbeingTopic, string> = {
  ENVIRONNEMENT: "Environnement",
  AMELIORATION: "Amélioration",
  RECONNAISSANCE: "Reconnaissance",
  AUTRE: "Autre",
};

const TOPIC_STYLE: Record<WellbeingTopic, string> = {
  ENVIRONNEMENT: "bg-sc-blue-light text-sc-blue",
  AMELIORATION: "bg-sc-teal-light text-sc-teal-dark",
  RECONNAISSANCE: "bg-sc-green-light text-sc-green-dark",
  AUTRE: "bg-gray-100 text-gray-600",
};

const STATUS_STYLE: Record<WellbeingStatus, string> = {
  NOUVEAU: "bg-sc-warning-light text-[#854f0b]",
  LU: "bg-sc-blue-light text-sc-blue",
  TRAITE: "bg-sc-green-light text-sc-green-dark",
};

const STATUS_LABEL: Record<WellbeingStatus, string> = {
  NOUVEAU: "Nouveau",
  LU: "Lu",
  TRAITE: "Traité",
};

export type InboxPost = {
  id: string;
  topic: WellbeingTopic;
  message: string;
  status: WellbeingStatus;
  createdAt: string; // ISO
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export function FeedbackInbox({ posts }: { posts: InboxPost[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function changeStatus(id: string, status: WellbeingStatus) {
    setBusy(id);
    try {
      await setWellbeingStatus(id, status);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center text-[13px] text-gray-500">
        Aucun avis pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <div
          key={p.id}
          className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${TOPIC_STYLE[p.topic]}`}
            >
              {TOPIC_LABEL[p.topic]}
            </span>
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[p.status]}`}
            >
              {STATUS_LABEL[p.status]}
            </span>
            <span className="ml-auto text-[11.5px] text-gray-400">
              {formatDate(p.createdAt)}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-[13px] text-gray-700">
            {p.message}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.status !== WellbeingStatus.LU && (
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => changeStatus(p.id, WellbeingStatus.LU)}
                className="rounded-md border border-sc-border bg-white px-3 py-1 text-[11.5px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Marquer lu
              </button>
            )}
            {p.status !== WellbeingStatus.TRAITE && (
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => changeStatus(p.id, WellbeingStatus.TRAITE)}
                className="rounded-md bg-sc-green px-3 py-1 text-[11.5px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                Marquer traité
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
