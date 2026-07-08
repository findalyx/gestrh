"use client";

import { useState, useTransition } from "react";
import { DocumentType } from "@prisma/client";
import {
  requestDocumentUpload,
  finalizeDocumentUpload,
} from "../_lib/document-actions";

const TYPE_LABEL: Record<DocumentType, string> = {
  CONTRAT: "Contrat",
  CONTRAT_SIGNE: "Contrat signé",
  AVENANT: "Avenant",
  AVENANT_SIGNE: "Avenant signé",
  DEMISSION: "Démission",
  NOTIFICATION_CONTRAT: "Notification contractuelle",
  DIPLOME: "Diplôme",
  CERTIFICATION: "Certification",
  BULLETIN_PAIE: "Bulletin de paie",
  JUSTIFICATIF: "Justificatif",
  CNI: "Carte nationale d'identité",
  CASIER_JUDICIAIRE: "Casier judiciaire",
  RIB: "Relevé d'identité bancaire",
  PHOTO: "Photo d'identité",
  CERTIFICAT_MEDICAL: "Certificat médical",
  CV: "Curriculum vitæ",
  AUTRE: "Autre",
};

const HIDDEN: DocumentType[] = [
  DocumentType.CONTRAT_SIGNE,
  DocumentType.AVENANT_SIGNE,
  DocumentType.NOTIFICATION_CONTRAT,
  DocumentType.DEMISSION,
];

const MAX_MB = 20;

export function DocumentUploader({ agentId }: { agentId: string }) {
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [pending, startTransition] = useTransition();

  const busy = phase !== "idle" || pending;

  function reset() {
    setDocType("");
    setTitle("");
    setFile(null);
    setProgress(0);
    setPhase("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!docType) return setError("Choisissez un type de document.");
    if (!file) return setError("Choisissez un fichier.");
    if (file.size > MAX_MB * 1024 * 1024) {
      return setError(
        `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum ${MAX_MB} Mo.`,
      );
    }

    setPhase("uploading");
    setProgress(0);
    try {
      const signed = await requestDocumentUpload(agentId, docType, title, file.name);
      if (!signed.ok) {
        setError(signed.error);
        setPhase("idle");
        return;
      }
      await putWithProgress(signed.signedUrl, file, setProgress);

      setPhase("processing");
      startTransition(async () => {
        const res = await finalizeDocumentUpload(signed.documentId, file.size);
        if (res.ok) {
          reset();
          setOpen(false);
        } else {
          setError(res.error);
          setPhase("idle");
        }
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(
        /network|fetch|failed/i.test(raw)
          ? "Connexion perdue pendant l'upload. Réessaie."
          : `Échec : ${raw.slice(0, 150)}`,
      );
      setPhase("idle");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker"
      >
        + Téléverser un document
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-md border border-sc-border bg-sc-blue-bg p-3"
    >
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Type
        </span>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          required
          disabled={busy}
          className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px]"
        >
          <option value="" disabled>
            Sélectionner…
          </option>
          {Object.values(DocumentType)
            .filter((t) => !HIDDEN.includes(t))
            .map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
        </select>
      </label>
      <label className="block flex-1">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Titre (optionnel)
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Auto si vide"
          disabled={busy}
          className="w-full rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px]"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Fichier (max {MAX_MB} Mo)
        </span>
        <input
          type="file"
          required
          disabled={busy}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
          className="block text-[12px] file:mr-2 file:rounded-md file:border-0 file:bg-sc-blue-light file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-sc-blue"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker disabled:opacity-50"
      >
        {phase === "uploading"
          ? `${progress}%`
          : phase === "processing" || pending
            ? "Enregistrement…"
            : "Téléverser"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          reset();
          setError(null);
        }}
        disabled={busy}
        className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker disabled:opacity-50"
      >
        Annuler
      </button>
      {phase === "uploading" && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200">
          <div className="h-full bg-sc-blue transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && (
        <div className="w-full rounded-md border border-sc-danger bg-sc-danger-light px-3 py-1.5 text-[11px] font-semibold text-sc-danger">
          {error}
        </div>
      )}
    </form>
  );
}

/** PUT un fichier vers une URL signée Supabase avec suivi de progression. */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? (onProgress(100), resolve())
        : reject(new Error(`HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error("network error"));
    xhr.send(file);
  });
}
