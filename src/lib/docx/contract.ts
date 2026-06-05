import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { ContractType, type Agent, type Contract, type Service } from "@prisma/client";
import { CONTRACT_TYPE_LABEL, formatDate, formatFcfa } from "@/lib/contract-utils";

type AgentLite = Pick<
  Agent,
  | "firstName"
  | "lastName"
  | "matricule"
  | "birthDate"
  | "gender"
  | "address"
  | "category"
  | "subCategory"
  | "jobTitle"
  | "email"
  | "phone"
>;

type ContractLite = Pick<
  Contract,
  | "reference"
  | "type"
  | "startDate"
  | "endDate"
  | "grade"
  | "baseSalary"
  | "probationEndDate"
  | "noticePeriodDays"
  | "workingHours"
  | "clauses"
>;

type ServiceLite = Pick<Service, "name" | "code">;

const FONT = "Calibri";

function p(opts: {
  text: string;
  bold?: boolean;
  size?: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  spacingAfter?: number;
}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    heading: opts.heading,
    spacing: { after: opts.spacingAfter ?? 100 },
    children: [
      new TextRun({
        text: opts.text,
        bold: opts.bold,
        size: opts.size ?? 22, // 11pt
        font: FONT,
      }),
    ],
  });
}

function kv(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label} : `, bold: true, size: 22, font: FONT }),
      new TextRun({ text: value, size: 22, font: FONT }),
    ],
  });
}

function article(num: string, title: string, body: string[]): Paragraph[] {
  return [
    p({
      text: `Article ${num} — ${title}`,
      bold: true,
      size: 24,
      spacingAfter: 120,
    }),
    ...body.map((line) =>
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: line, size: 22, font: FONT })],
      }),
    ),
  ];
}

function header(title: string): Paragraph[] {
  return [
    p({
      text: "UNIVERSITÉ ST CHRISTOPHER — DAKAR",
      bold: true,
      size: 28,
      align: AlignmentType.CENTER,
      spacingAfter: 80,
    }),
    p({
      text: "Direction des Ressources Humaines",
      size: 22,
      align: AlignmentType.CENTER,
      spacingAfter: 200,
    }),
    p({
      text: title,
      bold: true,
      size: 32,
      heading: HeadingLevel.HEADING_1,
      align: AlignmentType.CENTER,
      spacingAfter: 300,
    }),
  ];
}

function signature(): Paragraph[] {
  return [
    p({ text: "", spacingAfter: 400 }),
    p({ text: "Fait à Dakar, le ……………………………………", spacingAfter: 300 }),
    p({
      text: "Pour l'Université                                              L'Agent",
      bold: true,
      spacingAfter: 80,
    }),
    p({
      text: "(Nom, qualité et signature)                       (Signature précédée de « Lu et approuvé »)",
      size: 20,
    }),
  ];
}

function commonHeader(agent: AgentLite, contract: ContractLite, service: ServiceLite): Paragraph[] {
  return [
    p({ text: "ENTRE LES SOUSSIGNÉS :", bold: true, spacingAfter: 120 }),
    p({
      text: "L'Université St Christopher, sise à Dakar, représentée par son Directeur Général,",
    }),
    p({ text: "Ci-après dénommée « l'Employeur »,", spacingAfter: 200 }),
    p({ text: "ET", bold: true, align: AlignmentType.CENTER, spacingAfter: 120 }),
    p({
      text: `${agent.gender === "FEMME" ? "Madame" : "Monsieur"} ${agent.firstName} ${agent.lastName.toUpperCase()},`,
      bold: true,
    }),
    p({
      text: `Né${agent.gender === "FEMME" ? "e" : ""} le ${formatDate(agent.birthDate)}${agent.address ? `, demeurant à ${agent.address}` : ""}.`,
    }),
    p({
      text: `Matricule : ${agent.matricule}${agent.email ? ` · Courriel : ${agent.email}` : ""}${agent.phone ? ` · Téléphone : ${agent.phone}` : ""}`,
    }),
    p({ text: "Ci-après dénommé(e) « l'Agent »,", spacingAfter: 200 }),
    p({ text: "IL A ÉTÉ CONVENU CE QUI SUIT :", bold: true, spacingAfter: 200 }),
    p({ text: `Référence du contrat : ${contract.reference}`, bold: true }),
    kv("Service d'affectation", `${service.name} (${service.code})`),
    kv("Catégorie", `${agent.category} · ${agent.subCategory.replace("_", " ")}`),
    p({ text: "", spacingAfter: 200 }),
  ];
}

function articlesCommon(contract: ContractLite, agent: AgentLite, service: ServiceLite): Paragraph[] {
  const blocks: Paragraph[] = [];

  blocks.push(
    ...article("1", "Engagement et fonctions", [
      `L'Employeur engage l'Agent en qualité de ${agent.jobTitle} au sein du service ${service.name}.`,
      contract.grade
        ? `Grade et échelon retenus : ${contract.grade}.`
        : "Le grade et l'échelon seront définis par référence à la grille en vigueur.",
      "L'Agent s'engage à respecter le règlement intérieur, les statuts et toute note de service applicable.",
    ]),
  );

  if (contract.type === ContractType.CDI) {
    blocks.push(
      ...article("2", "Durée du contrat", [
        `Le présent contrat est conclu pour une durée indéterminée à compter du ${formatDate(contract.startDate)}.`,
        contract.probationEndDate
          ? `Il est précédé d'une période d'essai prenant fin le ${formatDate(contract.probationEndDate)}, durant laquelle chacune des parties pourra rompre librement le contrat dans le respect des dispositions légales.`
          : "",
      ].filter(Boolean)),
    );
  } else if (contract.type === ContractType.CDD) {
    blocks.push(
      ...article("2", "Durée du contrat", [
        `Le présent contrat est conclu pour une durée déterminée du ${formatDate(contract.startDate)} au ${formatDate(contract.endDate)}.`,
        "Il prendra fin de plein droit à son terme, sauf renouvellement notifié par écrit dans les délais légaux.",
        contract.probationEndDate
          ? `Une période d'essai est prévue jusqu'au ${formatDate(contract.probationEndDate)}.`
          : "",
      ].filter(Boolean)),
    );
  } else if (contract.type === ContractType.STAGE) {
    blocks.push(
      ...article("2", "Durée du stage", [
        `Le présent contrat de stage est conclu du ${formatDate(contract.startDate)} au ${formatDate(contract.endDate)}.`,
        "Il prendra fin à son terme. Aucun renouvellement n'est garanti.",
      ]),
    );
  } else {
    blocks.push(
      ...article("2", "Durée de la mission", [
        `La présente mission de vacation est conclue du ${formatDate(contract.startDate)} au ${formatDate(contract.endDate)}.`,
        "Elle ne crée aucun lien de subordination permanent et prend fin de plein droit à son terme.",
      ]),
    );
  }

  blocks.push(
    ...article("3", "Rémunération", [
      `Le salaire de base mensuel brut est fixé à ${formatFcfa(contract.baseSalary)}.`,
      "S'y ajoutent, le cas échéant, les primes, indemnités et allocations prévues par les barèmes en vigueur.",
      "Les retenues légales (CSS, IPRES, IPM, impôts) seront opérées conformément à la réglementation sénégalaise.",
    ]),
    ...article("4", "Temps de travail", [
      contract.workingHours
        ? `La durée hebdomadaire de travail est de ${contract.workingHours} heures, à répartir selon les nécessités du service.`
        : "La durée hebdomadaire de travail est fixée par le règlement intérieur, à répartir selon les nécessités du service.",
      "L'Agent peut être amené à effectuer des permanences ou des missions ponctuelles dans les conditions prévues par les textes en vigueur.",
    ]),
    ...article("5", "Congés", [
      "L'Agent bénéficie des congés annuels, exceptionnels et de maladie selon la convention collective et le règlement intérieur.",
      "Les demandes de congés sont soumises à validation hiérarchique via le système d'information RH.",
    ]),
    ...article("6", "Préavis et rupture", [
      contract.noticePeriodDays
        ? `En cas de rupture à l'initiative de l'une des parties, un préavis de ${contract.noticePeriodDays} jours est requis, sauf faute grave ou force majeure.`
        : "Les durées de préavis applicables sont celles fixées par la convention collective et le code du travail sénégalais.",
      "La rupture devra être notifiée par lettre dûment réceptionnée.",
    ]),
  );

  if (contract.clauses && contract.clauses.trim().length > 0) {
    blocks.push(
      ...article("7", "Clauses spécifiques", contract.clauses.split(/\n+/).filter(Boolean)),
    );
  }

  const last = contract.clauses ? "8" : "7";
  blocks.push(
    ...article(last, "Loi applicable et juridiction compétente", [
      "Le présent contrat est régi par le droit sénégalais.",
      "Tout différend né de son exécution ou de son interprétation relèvera de la compétence exclusive des juridictions de Dakar, après tentative préalable de règlement amiable.",
    ]),
  );

  return blocks;
}

export async function buildContractDocx(
  contract: ContractLite,
  agent: AgentLite,
  service: ServiceLite,
): Promise<Uint8Array<ArrayBuffer>> {
  const title = `Contrat ${CONTRACT_TYPE_LABEL[contract.type]} — ${contract.reference}`;

  const doc = new Document({
    creator: "SIRH St Christopher",
    title,
    description: `Contrat de travail · ${agent.firstName} ${agent.lastName}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } },
        children: [
          ...header(title.toUpperCase()),
          ...commonHeader(agent, contract, service),
          ...articlesCommon(contract, agent, service),
          ...signature(),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice() as Uint8Array<ArrayBuffer>;
}
