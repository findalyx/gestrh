/* ============================================================
 *  SIRH Université St Christopher — Seed à partir des données réelles
 *
 *  Lit prisma/seed-data.json (généré par scripts/seed-extract.py depuis le
 *  classeur Excel, NON commité car PII). Remplace tout le personnel par les
 *  données réelles : services, agents (PATS / PER / Prestataires), contrats,
 *  soldes de congés 2026, notes d'évaluation, + comptes démo de connexion.
 *
 *  L'Organization (logo, identité) n'est PAS touchée.
 *  Les modules recrutement / formation / paie sont vidés (pas de source réelle).
 * ============================================================ */

import { readFileSync } from "node:fs";
import {
  PrismaClient,
  Gender,
  StaffCategory,
  StaffSubCategory,
  AgentStatus,
  ContractType,
  ContractStatus,
  LeaveType,
  EvaluationStatus,
  Role,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ------------------------------------------------------------------
//  Typage du fichier de données
// ------------------------------------------------------------------
type ContractData = {
  type: string;
  startDate: string | null;
  endDate: string | null;
};
type AgentData = {
  matricule: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string | null;
  category: string;
  subCategory: string;
  jobTitle: string;
  serviceName: string;
  email: string;
  phone: string | null;
  hireDate: string | null;
  contract: ContractData;
  note: number | null;
  leaveBalance: { year: number; type: string; totalDays: number; usedDays: number } | null;
};
type ServiceData = { name: string; code: string; managerMatricule: string | null };
type DemoUser = { email: string; role: string; linkMatricule: string | null };
type SeedData = {
  services: ServiceData[];
  agents: AgentData[];
  demoUsers: DemoUser[];
  demoPassword: string;
};

const data: SeedData = JSON.parse(
  readFileSync("prisma/seed-data.json", "utf8"),
);

function d(s: string | null): Date | null {
  return s ? new Date(s) : null;
}

async function main() {
  console.log("🌱 Seed — données réelles Université St Christopher");

  // --- 1) Nettoyage (ordre FK-safe), Organization préservée -------
  await prisma.leaveApproval.deleteMany();
  await prisma.contractNotification.deleteMany();
  await prisma.resignation.deleteMany();
  await prisma.contractRenewal.deleteMany();
  await prisma.contractAmendment.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.announcementAttachment.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.applicationNote.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payrollRecord.deleteMany();
  await prisma.trainingEnrollment.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.courseModule.deleteMany();
  await prisma.trainingCourse.deleteMany();
  await prisma.application.deleteMany();
  await prisma.jobPosting.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.careerEntry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.service.deleteMany();

  // --- 2) Services (sans manager pour l'instant) ------------------
  const serviceIdByName = new Map<string, string>();
  for (const s of data.services) {
    const created = await prisma.service.create({
      data: { name: s.name, code: s.code },
      select: { id: true },
    });
    serviceIdByName.set(s.name, created.id);
  }
  console.log(`  ✓ ${data.services.length} services`);

  // --- 3) Agents + contrats + soldes + évaluations ----------------
  const agentIdByMatricule = new Map<string, string>();
  const now = new Date();
  let contracts = 0;
  let balances = 0;
  let evals = 0;

  for (const a of data.agents) {
    const serviceId = serviceIdByName.get(a.serviceName);
    if (!serviceId) continue;

    const agent = await prisma.agent.create({
      data: {
        matricule: a.matricule,
        firstName: a.firstName || "—",
        lastName: a.lastName,
        email: a.email,
        phone: a.phone,
        birthDate: d(a.birthDate),
        gender: a.gender as Gender,
        category: a.category as StaffCategory,
        subCategory: a.subCategory as StaffSubCategory,
        jobTitle: a.jobTitle || "Agent",
        status: AgentStatus.ACTIF,
        hireDate: d(a.hireDate) ?? d(a.contract.startDate) ?? now,
        serviceId,
      },
      select: { id: true },
    });
    agentIdByMatricule.set(a.matricule, agent.id);

    // Contrat (salaire absent de la source → 0, à compléter)
    const endDate = d(a.contract.endDate);
    const status =
      endDate && endDate < now ? ContractStatus.EXPIRE : ContractStatus.ACTIF;
    await prisma.contract.create({
      data: {
        agentId: agent.id,
        reference: `CTR-${a.matricule}`,
        type: a.contract.type as ContractType,
        status,
        startDate: d(a.contract.startDate) ?? d(a.hireDate) ?? now,
        endDate,
        baseSalary: 0,
      },
    });
    contracts++;

    // Solde de congés
    if (a.leaveBalance) {
      await prisma.leaveBalance.create({
        data: {
          agentId: agent.id,
          year: a.leaveBalance.year,
          type: a.leaveBalance.type as LeaveType,
          totalDays: a.leaveBalance.totalDays,
          usedDays: a.leaveBalance.usedDays,
        },
      });
      balances++;
    }

    // Évaluation (note /20 → /100)
    if (a.note != null) {
      await prisma.evaluation.create({
        data: {
          agentId: agent.id,
          period: "2026",
          status: EvaluationStatus.TERMINEE,
          overallScore: Math.round(a.note * 5 * 10) / 10,
          completedAt: now,
        },
      });
      evals++;
    }
  }
  console.log(
    `  ✓ ${agentIdByMatricule.size} agents · ${contracts} contrats · ${balances} soldes · ${evals} évaluations`,
  );

  // --- 4) Chefs de service (managerId) ----------------------------
  let managers = 0;
  for (const s of data.services) {
    if (!s.managerMatricule) continue;
    const managerId = agentIdByMatricule.get(s.managerMatricule);
    const serviceId = serviceIdByName.get(s.name);
    if (managerId && serviceId) {
      await prisma.service.update({
        where: { id: serviceId },
        data: { managerId },
      });
      managers++;
    }
  }
  console.log(`  ✓ ${managers} chefs de service rattachés`);

  // --- 5) Comptes démo de connexion -------------------------------
  const pwd = await bcrypt.hash(data.demoPassword, 10);
  let users = 0;
  for (const u of data.demoUsers) {
    const agentId = u.linkMatricule
      ? agentIdByMatricule.get(u.linkMatricule) ?? null
      : null;
    await prisma.user.create({
      data: {
        email: u.email,
        passwordHash: pwd,
        role: u.role as Role,
        isActive: true,
        agentId,
      },
    });
    users++;
  }
  console.log(`  ✓ ${users} comptes démo (mot de passe : ${data.demoPassword})`);

  console.log("✅ Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
