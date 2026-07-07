"use client";

import { AppErrorPage } from "@/components/AppErrorPage";

/**
 * Error boundary du groupe (app) — attrape toute erreur non gérée dans une
 * page authentifiée (paie, congés, personnel, etc.) et affiche un écran
 * lisible plutôt que le message générique de Next.js.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorPage
      error={error}
      reset={reset}
      showDetails={process.env.NODE_ENV !== "production"}
    />
  );
}
