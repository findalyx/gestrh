"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  uploadAgentPhoto,
  deleteAgentPhoto,
} from "../_lib/photo-actions";

const MAX_BYTES = 4 * 1024 * 1024;

export function AgentPhotoUploader({
  agentId,
  photoSrc,
  initials,
  canEdit,
}: {
  agentId: string;
  photoSrc: string | null;
  initials: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(
        `Image trop volumineuse (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum 4 Mo.`,
      );
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("photo", file);
      const res = await uploadAgentPhoto(agentId, fd);
      if (!res.ok) setError(res.error);
      else router.refresh();
    } catch {
      setError("Échec du téléversement.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onDelete() {
    setError(null);
    setPending(true);
    try {
      const res = await deleteAgentPhoto(agentId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-20 w-20 flex-shrink-0">
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt={initials}
            className="h-20 w-20 rounded-full object-cover ring-1 ring-sc-border"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sc-purple to-sc-blue text-2xl font-semibold text-white">
            {initials}
          </div>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            title={photoSrc ? "Changer la photo" : "Ajouter une photo"}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-sc-blue text-white shadow-sm transition hover:bg-sc-blue-dark disabled:opacity-60"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>

      {canEdit && photoSrc && (
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="text-[10.5px] font-medium text-gray-400 transition hover:text-sc-danger disabled:opacity-60"
        >
          {pending ? "…" : "Retirer"}
        </button>
      )}

      {error && (
        <p className="max-w-[160px] text-center text-[10.5px] font-medium text-sc-danger">
          {error}
        </p>
      )}
    </div>
  );
}
