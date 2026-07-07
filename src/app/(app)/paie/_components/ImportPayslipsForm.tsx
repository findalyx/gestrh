"use client";

import { useState, useTransition } from "react";
import {
  getPayslipUploadUrl,
  importPayslipsFromPath,
  type ImportPayslipsState,
} from "../_lib/import-actions";

/**
 * Formulaire d'import des bulletins de paie.
 *
 * Flux en 2 étapes pour bypasser la limite Vercel Server Actions (4,5 Mo) :
 *   1. Client demande au serveur une URL signée d'upload direct sur Supabase
 *   2. Client PUT le fichier directement sur cette URL (aucune limite Vercel)
 *   3. Client appelle une Server Action qui lit le PDF depuis Supabase et le traite
 *
 * L'utilisateur voit 2 étapes : "Upload…" puis "Import…", avec une barre
 * de progression pour la première.
 */
export function ImportPayslipsForm() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [state, setState] = useState<ImportPayslipsState>(undefined);
  const [pending, startTransition] = useTransition();

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setState(undefined);
    setPhase("uploading");
    setProgress(0);

    try {
      // Étape 1 : demander l'URL signée
      const signed = await getPayslipUploadUrl(file.name);
      if (!signed.ok) {
        setState({ ok: false, error: signed.error });
        setPhase("idle");
        return;
      }

      // Étape 2 : PUT direct vers Supabase (via XHR pour la barre de progression)
      await putFileWithProgress(signed.signedUrl, file, (pct) =>
        setProgress(pct),
      );

      // Étape 3 : demande au serveur de traiter le fichier depuis Storage
      setPhase("processing");
      const fd = new FormData();
      fd.append("path", signed.path);
      fd.append("filename", file.name);

      startTransition(async () => {
        const result = await importPayslipsFromPath(undefined, fd);
        setState(result);
        setPhase("idle");
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ ok: false, error: `Upload échoué : ${msg}` });
      setPhase("idle");
    }
  }

  const busy = phase !== "idle" || pending;

  return (
    <div>
      <p className="text-[12px] text-gray-600">
        Téléversez le PDF mensuel des bulletins. Le système lit chaque bulletin
        (période, matricule, brut, net) et met à jour la paie automatiquement.
      </p>
      <p className="mt-1 text-[11.5px] text-gray-500">
        Ré-importer le même PDF est sans risque : chaque bulletin est mis à jour
        par agent et par période (aucun doublon). C&apos;est ainsi qu&apos;on
        complète une période où des bulletins manquaient.
      </p>
      <p className="mt-1 text-[11px] text-gray-500">
        Taille maximale : <strong>25 Mo</strong>. Upload direct vers le stockage
        sécurisé — sans passer par le serveur d&apos;application.
      </p>

      <form
        onSubmit={handleUpload}
        className="mt-3 flex flex-wrap items-center gap-3"
      >
        <input
          name="pdf"
          type="file"
          accept="application/pdf"
          required
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setState(undefined);
          }}
          className="block text-[12px] file:mr-2 file:rounded-md file:border-0 file:bg-sc-blue-light file:px-3 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-sc-blue disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !file}
          className="rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {phase === "uploading"
            ? `Upload ${progress}%`
            : phase === "processing" || pending
              ? "Import en cours…"
              : "Importer"}
        </button>
      </form>

      {phase === "uploading" && (
        <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-sc-blue transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {state && !state.ok && (
        <div className="mt-3 rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3 py-2 text-[12.5px] text-sc-danger">
          {state.error}
        </div>
      )}

      {state && state.ok && (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-sc-green/30 bg-sc-green-light px-3 py-2 text-[12.5px] text-sc-green-dark">
            ✓ {state.imported} bulletin{state.imported > 1 ? "s" : ""} importé
            {state.imported > 1 ? "s" : ""}
            {state.updated > 0 && ` · ${state.updated} mis à jour`}
            {state.period && ` · période ${state.period}`}
            {state.skipped > 0 &&
              ` · ${state.skipped} ignoré(s) (données incomplètes)`}
            .
          </div>
          {state.unmatched.length > 0 && (
            <div className="rounded-lg border border-sc-warning/40 bg-sc-warning-light px-3 py-2.5 text-[12px] text-[#854f0b]">
              ⚠ {state.unmatched.length} bulletin
              {state.unmatched.length > 1 ? "s" : ""} non relié
              {state.unmatched.length > 1 ? "s" : ""} à un agent (matricule absent
              du système). Créez le dossier puis ré-importez le même PDF pour les
              rattacher :
              <div className="mt-2 flex flex-wrap gap-1.5">
                {state.unmatched.map((u, i) => (
                  <a
                    key={i}
                    href={`/personnel/nouveau?matricule=${encodeURIComponent(u.matricule ?? "")}`}
                    className="inline-flex items-center gap-1 rounded-md border border-sc-warning/50 bg-white px-2 py-1 font-mono text-[11.5px] text-[#854f0b] transition hover:bg-sc-warning-light"
                    title={u.name ? `Indice nom : ${u.name}` : undefined}
                  >
                    S{u.matricule}
                    <span className="font-sans font-semibold text-sc-blue">
                      + créer
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PUT un fichier vers une URL signée Supabase Storage avec suivi de progression.
 * Utilise XHR car fetch() n'expose pas encore `onprogress` de façon fiable.
 */
function putFileWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload HTTP ${xhr.status} : ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload"));
    xhr.send(file);
  });
}
