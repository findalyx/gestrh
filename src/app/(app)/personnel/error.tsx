"use client";

export default function PersonnelError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sc-danger-light text-sc-danger">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      </div>
      <div>
        <p className="font-serif text-lg font-semibold text-sc-blue-darker">
          Cette page n&apos;a pas pu se charger
        </p>
        <p className="mt-1 text-[13px] text-gray-500">
          Une erreur est survenue. Réessayez.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-sc-blue px-4 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark"
      >
        Réessayer
      </button>
    </div>
  );
}
