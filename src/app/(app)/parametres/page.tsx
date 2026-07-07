import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { getLastAccrualYYMM } from "@/lib/leave-accrual";
import { getOrganization } from "@/lib/organization";
import { hasLetterhead } from "@/lib/docx/letterhead";
import { Icon } from "@/components/Icon";
import {
  RoleSelectForm,
  ToggleActiveForm,
} from "./_components/UserRoleForm";
import { ServiceManagerForm } from "./_components/ServiceManagerForm";
import { CreateUserForm } from "./_components/CreateUserForm";
import { LeaveBalanceAdmin } from "./_components/LeaveBalanceAdmin";
import { OrganizationForm } from "./_components/OrganizationForm";
import { LetterheadForm } from "./_components/LetterheadForm";
import { CollapsibleSection } from "./_components/CollapsibleSection";
import { ValidatorsAdmin } from "./_components/ValidatorsAdmin";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  DIRECTION: "Direction",
  DRH: "DRH",
  MANAGER: "Manager",
  RECTEUR: "Recteur",
  DOYEN: "Doyen",
  AGENT: "Agent",
};

const ROLE_STYLE: Record<Role, string> = {
  DIRECTION: "bg-sc-purple-light text-sc-purple-dark",
  DRH: "bg-sc-blue-light text-sc-blue",
  MANAGER: "bg-sc-teal-light text-sc-teal-dark",
  RECTEUR: "bg-sc-purple-light text-sc-purple-dark",
  DOYEN: "bg-sc-blue-light text-sc-blue",
  AGENT: "bg-gray-100 text-gray-700",
};

function formatDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function ParametresPage() {
  const me = await requireRole(Role.DIRECTION, Role.DRH);
  const isDirection = me.role === Role.DIRECTION;

  const [
    users,
    services,
    agentsWithoutUser,
    recentAudit,
    lastAccrual,
    organization,
    validators,
    allAgents,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { email: "asc" }],
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            service: { select: { name: true } },
          },
        },
      },
    }),
    prisma.service.findMany({
      orderBy: { name: "asc" },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true, matricule: true },
        },
        agents: {
          select: { id: true, firstName: true, lastName: true, matricule: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        },
        _count: { select: { agents: true } },
      },
    }),
    prisma.agent.findMany({
      where: { user: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        matricule: true,
        firstName: true,
        lastName: true,
        email: true,
        service: { select: { name: true } },
      },
      take: 500,
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { email: true } },
      },
    }),
    getLastAccrualYYMM(),
    getOrganization(),
    prisma.validator.findMany({
      orderBy: { label: "asc" },
      include: {
        agent: { select: { firstName: true, lastName: true, matricule: true } },
      },
    }),
    prisma.agent.findMany({
      where: { status: "ACTIF" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, matricule: true },
      take: 1000,
    }),
  ]);

  const now = new Date();
  const currentYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Le logo est servi via /api/branding/logo ; on ajoute un cache-buster pour
  // forcer le rafraîchissement après upload.
  const logoUrl = organization.logoFilename
    ? `/api/branding/logo?v=${encodeURIComponent(organization.updatedAt.toISOString())}`
    : null;

  // Le papier en-tête des attestations est stocké dans le bucket privé.
  // On vérifie via le même accès que la génération → badge fiable.
  const letterheadExists = await hasLetterhead();

  return (
    <div className="space-y-3">
      {/* Section — Identité de l'organisation */}
      <CollapsibleSection
        accent="bg-sc-blue"
        title="Identité de l'organisation"
        subtitle="Nom, logo, adresse, identifiants fiscaux — utilisés dans la sidebar, l'écran de connexion, les bulletins de paie et les contrats."
        defaultOpen
      >
        <OrganizationForm
          defaults={{
            name: organization.name,
            shortName: organization.shortName,
            tagline: organization.tagline,
            address: organization.address,
            city: organization.city,
            country: organization.country,
            ninea: organization.ninea,
            rccm: organization.rccm,
            phone: organization.phone,
            email: organization.email,
            website: organization.website,
            // BigInt n'est pas sérialisable côté client → on convertit en string.
            capital: organization.capital ? organization.capital.toString() : null,
            bp: organization.bp,
            legalRepName: organization.legalRepName,
            legalRepTitle: organization.legalRepTitle,
            logoFilename: organization.logoFilename,
          }}
          logoUrl={logoUrl}
        />
      </CollapsibleSection>

      {/* Section — Papier en-tête des attestations */}
      <CollapsibleSection
        accent="bg-sc-purple"
        title="Papier en-tête des attestations"
        subtitle="Modèle Word officiel (en-tête + pied de page) appliqué aux attestations de congés, de reprise et de travail."
        badge={letterheadExists ? "Configuré" : "Non configuré"}
      >
        <LetterheadForm exists={letterheadExists} />
      </CollapsibleSection>

      {/* Section — Soldes de congés */}
      <CollapsibleSection
        accent="bg-sc-teal"
        title="Soldes de congés"
        subtitle="Politique : 2 jours ouvrables / mois (24 j / an). Calcul mensuel automatique."
        badge={`Dernier accrual : ${lastAccrual ?? "—"}`}
      >
        <LeaveBalanceAdmin
          lastAccrual={lastAccrual}
          currentYYMM={currentYYMM}
        />
      </CollapsibleSection>

      {/* Section — Validateurs de congés */}
      <CollapsibleSection
        accent="bg-sc-teal"
        title="Validateurs de congés"
        subtitle="Liste des personnes qui valident les congés (RH, Doyen Exécutif, Recteur…). La chaîne de chaque agent se configure sur sa fiche."
        badge={`${validators.length} validateur${validators.length > 1 ? "s" : ""}`}
        htmlId="validateurs"
      >
        <ValidatorsAdmin
          validators={validators.map((v) => ({
            id: v.id,
            label: v.label,
            agentName: `${v.agent.lastName.toUpperCase()} ${v.agent.firstName}`,
            matricule: v.agent.matricule,
          }))}
          agents={allAgents.map((a) => ({
            id: a.id,
            name: `${a.lastName.toUpperCase()} ${a.firstName}`,
            matricule: a.matricule,
          }))}
        />
      </CollapsibleSection>

      {/* Section — Comptes utilisateurs */}
      <CollapsibleSection
        accent="bg-sc-teal"
        title="Comptes utilisateurs"
        subtitle={
          !isDirection
            ? "Le changement de rôle est réservé à la Direction."
            : undefined
        }
        badge={`${users.length} compte${users.length > 1 ? "s" : ""} · ${agentsWithoutUser.length} agent${agentsWithoutUser.length > 1 ? "s" : ""} sans accès`}
      >
        <div className="space-y-4">
        <div className="rounded-lg border border-sc-blue/20 bg-sc-blue-bg/40 px-3.5 py-2.5 text-[12px] text-gray-700">
          <span className="font-semibold text-sc-blue-darker">À noter :</span>{" "}
          le rôle (Direction / DRH / Manager / Agent) concerne uniquement
          l&apos;<strong>accès à l&apos;application</strong>. Pour donner un
          accès à un agent qui n&apos;en a pas encore, utilise la section{" "}
          <a href="#donner-acces" className="text-sc-blue hover:underline">
            « Donner un accès à un agent existant »
          </a>{" "}
          plus bas. Les agents sans compte d&apos;accès n&apos;ont pas de
          rôle applicatif — ils existent juste comme dossiers RH.
        </div>

        <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-sc-blue-bg text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Agent lié</th>
                <th className="px-4 py-3">Rôle actuel</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Dernière connexion</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === me.id;
                return (
                  <tr
                    key={u.id}
                    className={`border-t border-sc-border ${
                      isMe ? "bg-sc-blue-bg/50" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-[12px] text-gray-700">
                      {u.email}
                      {isMe && (
                        <span className="ml-2 rounded bg-sc-blue px-1.5 py-[1px] text-[10px] font-semibold uppercase text-white">
                          Vous
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {u.agent ? (
                        <>
                          {u.agent.lastName.toUpperCase()} {u.agent.firstName}
                          <span className="ml-1 text-[11px] text-gray-500">
                            · {u.agent.matricule}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider ${ROLE_STYLE[u.role]}`}
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {u.isActive ? (
                        <span className="text-[11.5px] font-medium text-sc-green-dark">
                          ● Actif
                        </span>
                      ) : (
                        <span className="text-[11.5px] font-medium text-gray-500">
                          ○ Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-600">
                      {formatDateTime(u.lastLoginAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {isDirection ? (
                          <RoleSelectForm
                            userId={u.id}
                            currentRole={u.role}
                            disabled={isMe}
                          />
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                        <ToggleActiveForm
                          userId={u.id}
                          currentActive={u.isActive}
                          disabled={isMe}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      </CollapsibleSection>

      {/* Section — Affectation des managers */}
      <CollapsibleSection
        accent="bg-sc-purple"
        title="Affectation des managers"
        subtitle={!isDirection ? "Réservé à la Direction." : undefined}
        badge={`${services.length} service${services.length > 1 ? "s" : ""}`}
      >
        <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-sc-blue-bg text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Effectif</th>
                <th className="px-4 py-3">Manager actuel</th>
                <th className="px-4 py-3">Réaffecter</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-sc-border">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-sc-blue-darker">
                      {s.name}
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono">
                      {s.code}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {s._count.agents} agents
                  </td>
                  <td className="px-4 py-2.5">
                    {s.manager ? (
                      <>
                        {s.manager.lastName.toUpperCase()} {s.manager.firstName}
                        <span className="ml-1 text-[11px] text-gray-500 font-mono">
                          · {s.manager.matricule}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-400">Aucun</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {isDirection ? (
                      <ServiceManagerForm
                        serviceId={s.id}
                        currentManagerId={s.manager?.id ?? null}
                        candidates={s.agents}
                      />
                    ) : (
                      <span className="text-[11px] text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Section — Donner un accès à un agent existant */}
      <CollapsibleSection
        accent="bg-sc-green"
        title="Donner un accès à un agent existant"
        subtitle="Crée un compte de connexion pour un agent qui n'en a pas encore. Le mot de passe initial sera à transmettre à l'intéressé."
        badge={`${agentsWithoutUser.length} agent${agentsWithoutUser.length > 1 ? "s" : ""} éligible${agentsWithoutUser.length > 1 ? "s" : ""}`}
        htmlId="donner-acces"
      >
        <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <CreateUserForm
            agents={agentsWithoutUser.map((a) => ({
              id: a.id,
              matricule: a.matricule,
              firstName: a.firstName,
              lastName: a.lastName,
              email: a.email,
              service: a.service.name,
            }))}
            canCreateDirection={isDirection}
          />
        </div>
      </CollapsibleSection>

      {/* Section — Journal d'audit récent */}
      <CollapsibleSection
        accent="bg-sc-warning"
        title="Journal d'audit"
        subtitle="20 dernières actions effectuées dans l'application."
        badge={`${recentAudit.length} entrée${recentAudit.length > 1 ? "s" : ""}`}
      >
        <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          {recentAudit.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-gray-500">
              <Icon
                name="info"
                size={18}
                className="mx-auto mb-2 text-gray-400"
              />
              Aucune action enregistrée pour le moment.
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead className="bg-sc-blue-bg text-left">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entité</th>
                  <th className="px-4 py-3">Détails</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.map((a) => (
                  <tr key={a.id} className="border-t border-sc-border">
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                      {formatDateTime(a.createdAt)}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11.5px] text-gray-700">
                      {a.user?.email ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11.5px] text-sc-blue-darker">
                      {a.action}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{a.entity}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {a.details ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
