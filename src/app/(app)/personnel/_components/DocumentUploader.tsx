"use client";

import { useRef, useState } from "react";
import { DocumentType } from "@prisma/client";
import { uploadAgentDocument } from "../_lib/document-actions";

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

// Types qu'on ne dépose pas via cet uploader (gérés par les workflows dédiés).
const HIDDEN: DocumentType[] = [
  DocumentType.CONTRAT_SIGNE,
  DocumentType.AVENANT_SIGNE,
  DocumentType.NOTIFICATION_CONTRAT,
  DocumentType.DEMISSION,
];

export function DocumentUploader({ agentId }: { agentId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Limite pratique d'envoi via Server Action sur l'hébergeur (~4,5 Mo).
  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

  async function action(formData: FormData) {
    setError(null);
    const file = formData.get("file");
    if (file instanceof File && file.size > MAX_UPLOAD_BYTES) {
      setError(
        `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). ` +
          "Maximum ~4 Mo : compressez le PDF ou réduisez l'image avant l'envoi.",
      );
      return;
    }
    setPending(true);
    try {
      const res = await uploadAgentDocument(agentId, formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      formRef.current?.reset();
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur d'upload.";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker"
        >
          + Téléverser un document
        </button>
      ) : (
        <form
          ref={formRef}
          action={action}
          className="flex flex-wrap items-end gap-2 rounded-md border border-sc-border bg-sc-blue-bg p-3"
        >
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              Type
            </span>
            <select
              name="docType"
              required
              defaultValue=""
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
              name="title"
              placeholder="Auto si vide"
              className="w-full rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              Fichier
            </span>
            <input
              type="file"
              name="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              className="block text-[12px] file:mr-2 file:rounded-md file:border-0 file:bg-sc-blue-light file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-sc-blue"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sc-blue-darker disabled:opacity-50"
          >
            {pending ? "Envoi…" : "Téléverser"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker"
          >
            Annuler
          </button>
          {error && (
            <div className="w-full rounded-md border border-sc-danger bg-sc-danger-light px-3 py-1.5 text-[11px] font-semibold text-sc-danger">
              {error}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
