import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";
import { getOrganization } from "@/lib/organization";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Connexion",
};

export default async function LoginPage() {
  // Si déjà connecté, on redirige vers le tableau de bord.
  const session = await getSession();
  if (session) {
    redirect("/tableau-de-bord");
  }

  const org = await getOrganization();
  const logoUrl = org.logoFilename
    ? `/api/branding/logo?v=${encodeURIComponent(org.updatedAt.toISOString())}`
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sc-blue-bg px-4 py-8">
      <div className="w-full max-w-[420px] rounded-2xl border border-sc-border bg-white p-8 shadow-[0_10px_40px_rgba(51,89,164,0.10)]">
        <div className="mb-6 flex flex-col items-center text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={org.name}
              className="mb-3 h-16 w-16 rounded-xl border border-sc-border bg-white object-contain p-2"
            />
          ) : null}
          <h1 className="font-serif text-2xl font-bold text-sc-blue-darker">
            {org.name}
          </h1>
          <p className="mt-1 text-[12.5px] text-gray-500">
            Connectez-vous à votre espace RH
          </p>
        </div>

        <LoginForm />

        <details className="mt-6 rounded-lg border border-sc-border bg-sc-blue-bg px-3.5 py-2.5 text-[12px] text-gray-600">
          <summary className="cursor-pointer font-medium text-sc-blue-darker">
            Comptes de démonstration
          </summary>
          <div className="mt-2 space-y-1">
            <p>
              Mot de passe commun : <code className="font-mono">sirh2026</code>
            </p>
            <ul className="mt-1 space-y-0.5 font-mono text-[11.5px]">
              <li>direction@st-christopher.sn</li>
              <li>drh@st-christopher.sn</li>
              <li>manager@st-christopher.sn</li>
              <li>agent@st-christopher.sn</li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
}
