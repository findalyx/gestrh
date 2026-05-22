/* ============================================================
 *  SIRH St Christopher — Données de démonstration
 *  Reproduit les chiffres des spécifications (§9) :
 *  245 agents · 98 PER · 147 PATS · 7 services · ~85 M FCFA
 * ============================================================ */

import {
  PrismaClient,
  Gender,
  StaffCategory,
  StaffSubCategory,
  AgentStatus,
  ContractType,
  ContractStatus,
  LeaveType,
  LeaveStatus,
  EvaluationStatus,
  TrainingStatus,
  EnrollmentStatus,
  JobStatus,
  ApplicationStage,
  PayrollStatus,
  Role,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// --- Générateur pseudo-aléatoire déterministe (seed fixe) -----
let seedState = 20252026;
function rand(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// --- Listes de noms (contexte sénégalais — Dakar) -------------
const PRENOMS_H = [
  "Mamadou", "Cheikh", "Ousmane", "Ibrahima", "Modou", "Abdoulaye",
  "Moussa", "Babacar", "Pape", "Alioune", "Lamine", "Serigne",
  "Amadou", "Saliou", "Idrissa", "Malick", "Daouda", "Samba",
  "Assane", "Mor",
];
const PRENOMS_F = [
  "Awa", "Fatou", "Aminata", "Mariama", "Aïssatou", "Khady",
  "Ndèye", "Sokhna", "Astou", "Coumba", "Bineta", "Rama",
  "Mame", "Adama", "Fatoumata", "Dieynaba", "Penda", "Yacine",
  "Maïmouna", "Seynabou",
];
const NOMS = [
  "Diop", "Ndiaye", "Fall", "Sow", "Ba", "Sarr", "Faye", "Gueye",
  "Cissé", "Diallo", "Sy", "Mbaye", "Niang", "Sène", "Thiam",
  "Kane", "Dieng", "Diouf", "Camara", "Touré", "Wade", "Samb", "Gaye",
];

const TITRES: Record<StaffSubCategory, string[]> = {
  PER_ENSEIGNEMENT: [
    "Professeur titulaire", "Maître de conférences", "Assistant",
    "Chargé d'enseignement", "Praticien hospitalier",
  ],
  PER_RECHERCHE: [
    "Chercheur senior", "Chercheur", "Assistant de recherche",
    "Ingénieur de recherche",
  ],
  PATS_ADMINISTRATIF: [
    "Gestionnaire RH", "Comptable", "Secrétaire de direction",
    "Assistant administratif", "Chargé de scolarité",
  ],
  PATS_TECHNIQUE: [
    "Technicien de laboratoire", "Agent de maintenance",
    "Administrateur systèmes", "Agent technique",
  ],
};

const SALAIRES: Record<StaffSubCategory, [number, number]> = {
  PER_ENSEIGNEMENT: [450_000, 900_000],
  PER_RECHERCHE: [400_000, 750_000],
  PATS_ADMINISTRATIF: [180_000, 400_000],
  PATS_TECHNIQUE: [160_000, 350_000],
};

// --- Répartition des agents par service (total = 41, jeu de test réduit) ---------
const SERVICES = [
  { code: "MED", name: "Médecine", sub: "PER_ENSEIGNEMENT", count: 8 },
  { code: "CHI", name: "Chirurgie", sub: "PER_ENSEIGNEMENT", count: 5 },
  { code: "PHA", name: "Pharmacie", sub: "PER_ENSEIGNEMENT", count: 3 },
  { code: "SIO", name: "Sciences infirmières", sub: "PER_ENSEIGNEMENT", count: 3 },
  { code: "REC", name: "Recherche", sub: "PER_RECHERCHE", count: 6 },
  { code: "ADM", name: "Administration", sub: "PATS_ADMINISTRATIF", count: 10 },
  { code: "TEC", name: "Technique", sub: "PATS_TECHNIQUE", count: 6 },
] as const;

async function main() {
  console.log("🌱  Réinitialisation des données…");

  // Suppression dans l'ordre des dépendances
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payrollRecord.deleteMany();
  await prisma.trainingEnrollment.deleteMany();
  await prisma.trainingSession.deleteMany();
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
  await prisma.organization.deleteMany();

  // --- Organisation (singleton) ------------------------------
  console.log("🏢  Création de l'organisation par défaut…");
  await prisma.organization.create({
    data: {
      name: "Université St Christopher",
      shortName: "SC",
      tagline: "SIRH · Université",
      address: "Route de Ouakam",
      city: "Dakar",
      country: "Sénégal",
      ninea: "—",
      phone: "+221 33 800 00 00",
      email: "contact@st-christopher.sn",
      website: "https://st-christopher.sn",
    },
  });

  // --- Services ----------------------------------------------
  console.log("🏛️   Création des 7 services…");
  const serviceMap = new Map<string, string>();
  for (const s of SERVICES) {
    const created = await prisma.service.create({
      data: { code: s.code, name: s.name },
    });
    serviceMap.set(s.code, created.id);
  }

  // --- Agents + contrats -------------------------------------
  console.log(`👥  Création des ${SERVICES.reduce((s, x) => s + x.count, 0)} agents et de leurs contrats…`);
  let matNum = 0;
  const agentIds: string[] = [];
  const agentsByService = new Map<string, string[]>();

  for (const s of SERVICES) {
    const subCat = s.sub as StaffSubCategory;
    const category: StaffCategory = subCat.startsWith("PER")
      ? StaffCategory.PER
      : StaffCategory.PATS;
    agentsByService.set(s.code, []);

    for (let i = 0; i < s.count; i++) {
      matNum++;
      const gender = rand() < 0.5 ? Gender.HOMME : Gender.FEMME;
      const firstName = gender === Gender.HOMME ? pick(PRENOMS_H) : pick(PRENOMS_F);
      const lastName = pick(NOMS);
      const matricule = `${category}-${String(matNum).padStart(4, "0")}`;
      const age = randInt(24, 64);
      const birthYear = 2026 - age;
      const hireYear = randInt(2005, 2025);
      const [salMin, salMax] = SALAIRES[subCat];
      const baseSalary = Math.round(randInt(salMin, salMax) / 5000) * 5000;
      const status =
        age >= 62 && rand() < 0.4 ? AgentStatus.RETRAITE : AgentStatus.ACTIF;

      const agent = await prisma.agent.create({
        data: {
          matricule,
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${matNum}@st-christopher.sn`
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, ""),
          phone: `+221 7${randInt(0, 8)} ${randInt(100, 999)} ${randInt(10, 99)} ${randInt(10, 99)}`,
          birthDate: new Date(birthYear, randInt(0, 11), randInt(1, 28)),
          gender,
          category,
          subCategory: subCat,
          jobTitle: pick(TITRES[subCat]),
          status,
          hireDate: new Date(hireYear, randInt(0, 11), randInt(1, 28)),
          serviceId: serviceMap.get(s.code)!,
        },
      });
      agentIds.push(agent.id);
      agentsByService.get(s.code)!.push(agent.id);

      // Contrat : majorité de CDI, quelques CDD
      const isCdd = rand() < 0.18;
      const contractStart = new Date(hireYear, randInt(0, 11), randInt(1, 28));
      const contractEnd = isCdd
        ? new Date(2026, randInt(4, 11), randInt(1, 28))
        : null;
      await prisma.contract.create({
        data: {
          reference: `CTR-${matricule}`,
          type: isCdd ? ContractType.CDD : ContractType.CDI,
          status: ContractStatus.ACTIF,
          startDate: contractStart,
          endDate: contractEnd,
          grade: `Échelon ${randInt(1, 12)}`,
          baseSalary,
          agentId: agent.id,
        },
      });
    }
  }

  // --- Managers de service -----------------------------------
  console.log("🧭  Désignation des responsables de service…");
  const managerIds = new Map<string, string>();
  for (const s of SERVICES) {
    const managerId = agentsByService.get(s.code)![0];
    await prisma.service.update({
      where: { id: serviceMap.get(s.code)! },
      data: { managerId },
    });
    managerIds.set(s.code, managerId);
  }

  // --- Comptes utilisateurs (4 profils — §4) -----------------
  console.log("🔐  Création des comptes de démonstration…");
  const pwd = await bcrypt.hash("sirh2026", 10);
  const drhAgentId = agentsByService.get("ADM")![0];
  const managerAgentId = managerIds.get("MED")!;
  const agentAgentId = agentsByService.get("MED")![3];
  // Pour ne pas pré-inscrire automatiquement les comptes de démo aux formations
  // (l'utilisateur veut pouvoir tester l'inscription).
  const demoAgentIds = new Set([drhAgentId, managerAgentId, agentAgentId]);

  const adminUser = await prisma.user.create({
    data: { email: "direction@st-christopher.sn", passwordHash: pwd, role: Role.DIRECTION },
  });
  await prisma.user.create({
    data: {
      email: "drh@st-christopher.sn",
      passwordHash: pwd,
      role: Role.DRH,
      agentId: drhAgentId,
    },
  });
  await prisma.user.create({
    data: {
      email: "manager@st-christopher.sn",
      passwordHash: pwd,
      role: Role.MANAGER,
      agentId: managerAgentId,
    },
  });
  await prisma.user.create({
    data: {
      email: "agent@st-christopher.sn",
      passwordHash: pwd,
      role: Role.AGENT,
      agentId: agentAgentId,
    },
  });

  // --- Soldes & demandes de congés ---------------------------
  console.log("🏖️   Création des soldes et demandes de congés…");
  for (const agentId of agentIds) {
    await prisma.leaveBalance.create({
      data: {
        agentId,
        year: 2026,
        type: LeaveType.ANNUEL,
        totalDays: 30,
        usedDays: randInt(0, 22),
      },
    });
  }

  // Demandes de congé variées : passées, en cours, à venir
  // → permet à la heatmap de présence de montrer des variations dans la
  //   fenêtre des 20 derniers jours ouvrés.
  const NOW = new Date();
  const DAY_MS = 24 * 3600 * 1000;
  const addDays = (base: Date, n: number) => new Date(base.getTime() + n * DAY_MS);

  // 12 congés approuvés répartis sur la fenêtre récente (passés + en cours)
  // pour rendre la heatmap parlante.
  for (let i = 0; i < 12; i++) {
    const agentId = pick(agentIds);
    const duration = randInt(2, 7);
    // décalage entre -25 et +3 jours par rapport à aujourd'hui
    const startOffset = randInt(-25, 3);
    const startDate = addDays(NOW, startOffset);
    const endDate = addDays(startDate, duration - 1);
    await prisma.leaveRequest.create({
      data: {
        agentId,
        type: pick([
          LeaveType.ANNUEL,
          LeaveType.MALADIE,
          LeaveType.EXCEPTIONNEL,
        ]),
        status: LeaveStatus.APPROUVE,
        startDate,
        endDate,
        days: duration,
        reason: "Congé planifié",
        decidedAt: addDays(startDate, -7),
      },
    });
  }

  // 18 demandes en attente de validation (futures) + quelques refusées
  const pendingStatuses: LeaveStatus[] = [
    ...Array(10).fill(LeaveStatus.EN_ATTENTE_MANAGER),
    ...Array(8).fill(LeaveStatus.EN_ATTENTE_DRH),
    ...Array(6).fill(LeaveStatus.REFUSE),
  ];
  for (const status of pendingStatuses) {
    const agentId = pick(agentIds);
    const duration = randInt(2, 14);
    const startOffset = randInt(7, 90); // dans les 3 prochains mois
    const startDate = addDays(NOW, startOffset);
    const endDate = addDays(startDate, duration - 1);
    await prisma.leaveRequest.create({
      data: {
        agentId,
        type: pick([
          LeaveType.ANNUEL,
          LeaveType.MALADIE,
          LeaveType.EXCEPTIONNEL,
        ]),
        status,
        startDate,
        endDate,
        days: duration,
        reason: "Demande de congé",
      },
    });
  }

  // --- Évaluations (85 % réalisées, 3 en retard) -------------
  console.log("📊  Création des évaluations annuelles…");
  const evalAgents = agentIds.slice(0, 180);
  let idx = 0;
  for (const agentId of evalAgents) {
    let status: EvaluationStatus;
    if (idx < 3) status = EvaluationStatus.EN_RETARD;
    else if (idx < Math.floor(evalAgents.length * 0.85)) status = EvaluationStatus.TERMINEE;
    else status = EvaluationStatus.EN_COURS;
    idx++;

    await prisma.evaluation.create({
      data: {
        agentId,
        period: "2025",
        status,
        dueDate: new Date(2026, 4, 31),
        completedAt: status === EvaluationStatus.TERMINEE ? new Date(2026, 3, randInt(1, 28)) : null,
        overallScore: status === EvaluationStatus.TERMINEE ? randInt(58, 98) : null,
        highPotential: status === EvaluationStatus.TERMINEE && rand() < 0.12,
      },
    });
  }

  // --- Formations --------------------------------------------
  console.log("🎓  Création du catalogue de formations…");
  const cours = [
    { title: "Pédagogie universitaire", category: "Pédagogie" },
    { title: "Compétences interculturelles", category: "Interculturel" },
    { title: "Outils numériques & e-learning", category: "Numérique" },
    { title: "Méthodologie de la recherche", category: "Recherche" },
    { title: "Management d'équipe", category: "Management" },
  ];
  let enrollmentCount = 0;
  for (const c of cours) {
    const course = await prisma.trainingCourse.create({
      data: { title: c.title, category: c.category },
    });
    const session = await prisma.trainingSession.create({
      data: {
        courseId: course.id,
        startDate: new Date(2026, randInt(1, 9), randInt(1, 20)),
        endDate: new Date(2026, randInt(1, 9), randInt(21, 28)),
        location: "Campus St Christopher — Dakar",
        capacity: 50,
        // Sessions OUVERTES par défaut pour permettre aux comptes de démo
        // de tester l'inscription.
        status: TrainingStatus.OUVERTE,
      },
    });
    // Quelques pré-inscriptions (3-5) pour rendre la session vivante, en
    // évitant les comptes de démo (qui doivent pouvoir s'inscrire eux-mêmes).
    const nb = randInt(3, 5);
    const used = new Set<string>();
    for (let i = 0; i < nb; i++) {
      const agentId = pick(agentIds);
      if (used.has(agentId) || demoAgentIds.has(agentId)) continue;
      used.add(agentId);
      await prisma.trainingEnrollment.create({
        data: {
          agentId,
          sessionId: session.id,
          status: pick([
            EnrollmentStatus.INSCRIT,
            EnrollmentStatus.CONFIRME,
          ]),
        },
      });
      enrollmentCount++;
    }
  }

  // --- Recrutement (7 postes, pipeline 142 candidatures) -----
  console.log("🔎  Création du pipeline de recrutement…");
  const postes = [
    { title: "Maître de conférences en Cardiologie", cat: StaffCategory.PER, svc: "MED" },
    { title: "Praticien hospitalier — Chirurgie", cat: StaffCategory.PER, svc: "CHI" },
    { title: "Chercheur en santé publique", cat: StaffCategory.PER, svc: "REC" },
    { title: "Pharmacien enseignant", cat: StaffCategory.PER, svc: "PHA" },
    { title: "Gestionnaire RH senior", cat: StaffCategory.PATS, svc: "ADM" },
    { title: "Administrateur systèmes", cat: StaffCategory.PATS, svc: "TEC" },
    { title: "Comptable principal", cat: StaffCategory.PATS, svc: "ADM" },
  ];
  const jobIds: string[] = [];
  for (const p of postes) {
    const job = await prisma.jobPosting.create({
      data: {
        title: p.title,
        category: p.cat,
        status: JobStatus.OUVERT,
        openings: 1,
        serviceId: serviceMap.get(p.svc)!,
        closesAt: new Date(2026, randInt(6, 11), randInt(1, 28)),
      },
    });
    jobIds.push(job.id);
  }
  // Pipeline : 14 / 8 / 4 / 2 / 1  = 29 candidatures (jeu de test réduit)
  const pipeline: ApplicationStage[] = [
    ...Array(14).fill(ApplicationStage.CANDIDATURE),
    ...Array(8).fill(ApplicationStage.PRESELECTION),
    ...Array(4).fill(ApplicationStage.ENTRETIEN),
    ...Array(2).fill(ApplicationStage.FINALISTE),
    ...Array(1).fill(ApplicationStage.RECRUTE),
  ];
  for (const stage of pipeline) {
    const gender = rand() < 0.5 ? Gender.HOMME : Gender.FEMME;
    const fn = gender === Gender.HOMME ? pick(PRENOMS_H) : pick(PRENOMS_F);
    const ln = pick(NOMS);
    await prisma.application.create({
      data: {
        candidateName: `${fn} ${ln}`,
        candidateEmail: `${fn.toLowerCase()}.${ln.toLowerCase()}@email.sn`
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, ""),
        stage,
        jobPostingId: pick(jobIds),
        interviewAt:
          stage === ApplicationStage.ENTRETIEN || stage === ApplicationStage.FINALISTE
            ? new Date(2026, randInt(5, 7), randInt(1, 28))
            : null,
      },
    });
  }

  // --- Paie du mois courant ----------------------------------
  console.log("💰  Génération des bulletins de paie (2026-05)…");
  const contracts = await prisma.contract.findMany({
    select: { agentId: true, baseSalary: true },
  });
  for (const c of contracts) {
    const bonuses = Math.round((c.baseSalary * randInt(8, 22)) / 100);
    const allowances = Math.round((c.baseSalary * randInt(3, 10)) / 100);
    const deductions = Math.round((c.baseSalary * randInt(12, 18)) / 100);
    await prisma.payrollRecord.create({
      data: {
        agentId: c.agentId,
        period: "2026-05",
        baseSalary: c.baseSalary,
        bonuses,
        allowances,
        deductions,
        netSalary: c.baseSalary + bonuses + allowances - deductions,
        status: PayrollStatus.VALIDE,
      },
    });
  }

  // --- Communication interne ---------------------------------
  // Note : les "alertes RH" du topbar sont désormais calculées en temps réel
  // depuis l'état de la base (cf. src/lib/alerts.ts). Pas besoin de seeder
  // des notifications statiques qui se désynchronisent vite des chiffres réels.
  console.log("📣  Création de l'annonce de lancement…");
  await prisma.announcement.create({
    data: {
      title: "Lancement de la campagne d'évaluation 2025-2026",
      body: "La campagne annuelle d'entretiens d'évaluation est ouverte. Les responsables de service sont invités à planifier les entretiens avant le 31 mai.",
      authorId: adminUser.id,
    },
  });

  console.log("\n✅  Données de démonstration créées :");
  console.log(`    · ${agentIds.length} agents · 7 services`);
  console.log(`    · ${contracts.length} contrats · ${enrollmentCount} inscriptions formation`);
  console.log(`    · ${pipeline.length} candidatures · 4 comptes utilisateurs`);
  console.log("\n    Comptes de démo (mot de passe : sirh2026) :");
  console.log("    · direction@st-christopher.sn   (Direction Générale)");
  console.log("    · drh@st-christopher.sn         (DRH)");
  console.log("    · manager@st-christopher.sn     (Manager)");
  console.log("    · agent@st-christopher.sn       (Agent)");
}

main()
  .catch((e) => {
    console.error("❌  Erreur lors du seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
