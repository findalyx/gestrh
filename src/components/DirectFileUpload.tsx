"use client";

import { useState, useTransition } from "react";

/**
 * Upload direct navigateur → Supabase Storage (via URL signée), pour contourner
 * la limite ~4,5 Mo des Server Actions Vercel. Réutilisable pour tout document.
 *
 * Flux :
 *   1. `getUploadUrl(filename)` (server action) → URL signée + chemin de destination
 *   2. le navigateur PUT le fichier directement sur cette URL (barre de progression)
 *   3. `finalize(path, filename, size)` (server action) → enregistre le lien en base
 */

export type SignedUrlResult =
  | { ok: true; signedUrl: string; path: string }
  | { ok: false; error: string };

export type FinalizeResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export function DirectFileUpload({
  accept,
  maxMb,
  getUploadUrl,
  finalize,
  buttonLabel = "Envoyer",
  compact = false,
}: {
  accept: string;
  maxMb: number;
  getUploadUrl: (filename: string) => Promise<SignedUrlResult>;
  finalize: (path: string, filename: string, size: number) => Promise<FinalizeResult>;
  buttonLabel?: string;
  compact?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const busy = phase !== "idle" || pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setMsg(null);

    if (file.size > maxMb * 1024 * 1024) {
      setMsg({ ok: false, text: `Fichier trop volumineux (max ${maxMb} Mo).` });
      return;
    }

    setPhase("uploading");
    setProgress(0);
    try {
      const signed = await getUploadUrl(file.name);
      if (!signed.ok) {
        setMsg({ ok: false, text: signed.error });
        setPhase("idle");
        return;
      }
      await putWithProgress(signed.signedUrl, file, setProgress);

      setPhase("processing");
      startTransition(async () => {
        const res = await finalize(signed.path, file.name, file.size);
        setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "Enregistré.") : (res.error ?? "Échec.") });
        setPhase("idle");
        if (res.ok) setFile(null);
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const friendly = /network|fetch|failed/i.test(raw)
        ? "Connexion perdue pendant l'upload. Réessaie."
        : `Échec : ${raw.slice(0, 150)}`;
      setMsg({ ok: false, text: friendly });
      setPhase("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : ""}`}>
        <input
          type="file"
          accept={accept}
          required
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setMsg(null);
          }}
          className="block text-[11.5px] file:mr-2 file:rounded file:border-0 file:bg-sc-blue file:px-2 file:py-1 file:text-[11px] file:font-medium file:text-white hover:file:bg-sc-blue-dark disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !file}
          className="rounded-lg bg-sc-blue px-2.5 py-1 text-[11.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {phase === "uploading"
            ? `${progress}%`
            : phase === "processing" || pending
              ? "…"
              : buttonLabel}
        </button>
      </div>
      {phase === "uploading" && (
        <div className="h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-gray-200">
          <div className="h-full bg-sc-blue transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {msg && (
        <span className={`text-[11px] ${msg.ok ? "text-sc-green-dark" : "text-sc-danger"}`}>
          {msg.ok ? "✓ " : ""}
          {msg.text}
        </span>
      )}
      <span className="text-[10.5px] text-gray-400">Jusqu&apos;à {maxMb} Mo</span>
    </form>
  );
}

/** PUT un fichier vers une URL signée avec suivi de progression (XHR). */
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
