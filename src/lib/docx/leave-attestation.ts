import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  LeaveApprovalLevel,
  LeaveType,
  type Agent,
  type LeaveRequest,
  type Service,
} from "@prisma/client";
import { formatDate } from "@/lib/contract-utils";

const FONT = "Calibri";

const TYPE_LABEL: Record<LeaveType, string> = {
  ANNUEL: "congé annuel",
  MALADIE: "congé de maladie",
  MATERNITE: "congé de maternité",
  PATERNITE: "congé de paternité",
  EXCEPTIONNEL: "congé exceptionnel",
  SANS_SOLDE: "congé sans solde",
};

const LEVEL_LABEL: Record<LeaveApprovalLevel, string> = {
  CHEF: "Chef de Service",
  DOYEN: "Doyen",
  DG_RECTEUR: "Direction Générale / Recteur",
};

type AgentLite = Pick<
  Agent,
  "firstName" | "lastName" | "matricule" | "gender" | "jobTitle"
>;
type LeaveLite = Pick<
  LeaveRequest,
  "type" | "startDate" | "endDate" | "days" | "decidedAt"
>;
type ServiceLite = Pick<Service, "name">;
type ApprovalLite = { level: LeaveApprovalLevel; decidedAt: Date };

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
    spacing: { after: opts.spacingAfter ?? 140 },
    children: [
      new TextRun({
        text: opts.text,
        bold: opts.bold,
        size: opts.size ?? 22,
        font: FONT,
      }),
    ],
  });
}

function kv(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 90 },
    children: [
      new TextRun({ text: `${label} : `, bold: true, size: 22, font: FONT }),
      new TextRun({ text: value, size: 22, font: FONT }),
    ],
  });
}

/** Date de reprise = lendemain de la fin du congé. */
function returnDate(end: Date): Date {
  const d = new Date(end);
  d.setDate(d.getDate() + 1);
  return d;
}

export async function buildLeaveAttestationDocx(
  leave: LeaveLite,
  agent: AgentLite,
  service: ServiceLite,
  approvals: ApprovalLite[],
): Promise<Uint8Array<ArrayBuffer>> {
  const civ = agent.gender === "FEMME" ? "Madame" : "Monsieur";
  const ne = agent.gender === "FEMME" ? "ée" : "é";

  const doc = new Document({
    creator: "SIRH St Christopher",
    title: `Attestation de congés — ${agent.firstName} ${agent.lastName}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } },
        },
        children: [
          p({
            text: "UNIVERSITÉ ST CHRISTOPHER — DAKAR",
            bold: true,
            size: 28,
            align: AlignmentType.CENTER,
          }),
          p({
            text: "Direction des Ressources Humaines",
            size: 22,
            align: AlignmentType.CENTER,
            spacingAfter: 300,
          }),
          p({
            text: "ATTESTATION DE CONGÉS",
            bold: true,
            size: 32,
            heading: HeadingLevel.HEADING_1,
            align: AlignmentType.CENTER,
            spacingAfter: 320,
          }),

          new Paragraph({
            spacing: { after: 220 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text:
                  "La Direction des Ressources Humaines de l'Université St Christopher " +
                  `atteste que ${civ} ${agent.firstName} ${agent.lastName.toUpperCase()}, ` +
                  `${agent.jobTitle} au sein du service ${service.name} ` +
                  `(matricule ${agent.matricule}), est autoris${ne} à prendre ` +
                  `un ${TYPE_LABEL[leave.type]} dans les conditions suivantes :`,
                size: 22,
                font: FONT,
              }),
            ],
          }),

          kv("Type de congé", TYPE_LABEL[leave.type]),
          kv("Durée", `${leave.days} jour(s)`),
          kv("Date de départ", formatDate(leave.startDate)),
          kv("Dernier jour de congé", formatDate(leave.endDate)),
          kv("Date de reprise prévue", formatDate(returnDate(leave.endDate))),
          p({ text: "", spacingAfter: 200 }),

          p({
            text: "Autorisations accordées",
            bold: true,
            size: 24,
            spacingAfter: 120,
          }),
          ...(approvals.length > 0
            ? approvals.map((a) =>
                p({
                  text: `— ${LEVEL_LABEL[a.level]} : favorable, le ${formatDate(a.decidedAt)}.`,
                  spacingAfter: 80,
                }),
              )
            : [
                p({
                  text: `— Congé autorisé le ${formatDate(leave.decidedAt ?? leave.startDate)}.`,
                  spacingAfter: 80,
                }),
              ]),

          p({ text: "", spacingAfter: 300 }),
          new Paragraph({
            spacing: { after: 300 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text:
                  "La présente attestation est délivrée pour servir et valoir ce que de droit.",
                size: 22,
                font: FONT,
              }),
            ],
          }),

          p({
            text: `Fait à Dakar, le ${formatDate(new Date())}.`,
            align: AlignmentType.RIGHT,
            spacingAfter: 240,
          }),
          p({
            text: "Pour la Direction des Ressources Humaines,",
            bold: true,
            align: AlignmentType.RIGHT,
            spacingAfter: 240,
          }),
          p({
            text: "(Nom, qualité et signature)",
            size: 20,
            align: AlignmentType.RIGHT,
            spacingAfter: 300,
          }),
          p({
            text:
              "Document généré électroniquement par le SIRH de l'Université St Christopher.",
            size: 18,
            align: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength,
  ).slice() as Uint8Array<ArrayBuffer>;
}
