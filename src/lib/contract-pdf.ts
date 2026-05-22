import "server-only";

import PDFDocument from "pdfkit";
import { ContractType } from "@prisma/client";

const FCFA = new Intl.NumberFormat("fr-FR");

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
}

function formatDateShort(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR").format(d);
}

const TYPE_LABEL: Record<ContractType, string> = {
  CDI: "CONTRAT DE TRAVAIL A DUREE INDETERMINEE",
  CDD: "CONTRAT DE TRAVAIL A DUREE DETERMINEE",
  VACATAIRE: "CONTRAT DE VACATION",
  STAGE: "CONVENTION DE STAGE",
};

export type ContractPdfArgs = {
  organization: {
    name: string;
    shortName?: string | null;
    address: string | null;
    city: string | null;
    country: string;
    ninea: string | null;
    rccm: string | null;
    phone: string | null;
    bp: string | null;
    capital: bigint | null;
    legalRepName: string | null;
    legalRepTitle: string | null;
  };
  agent: {
    firstName: string;
    lastName: string;
    matricule: string;
    jobTitle: string;
    address: string | null;
    birthDate: Date | null;
    birthPlace: string | null;
    nationality: string | null;
    maritalStatus: string | null;
    serviceName: string;
  };
  contract: {
    reference: string;
    type: ContractType;
    startDate: Date;
    endDate: Date | null;
    grade: string | null;
    baseSalary: number;
  };
};

/**
 * Génère un PDF de contrat de travail au format sénégalais standard
 * (modèle SCIMD : titre encadré, 11 articles, signatures avec mention
 *  « L'INSPECTEUR DU TRAVAIL »).
 */
export async function generateContractPdf(
  args: ContractPdfArgs,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 60,
        info: {
          Title: `Contrat ${args.contract.reference}`,
          Author: args.organization.name,
          Subject: `Contrat de travail — ${args.agent.firstName} ${args.agent.lastName}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const isCdd = args.contract.type === ContractType.CDD;
      const cityForSig = args.organization.city ?? "Dakar";

      // ============================================================
      //  En-tête société (compact, en haut à gauche)
      // ============================================================
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(args.organization.name.toUpperCase(), { align: "left" });

      const headerLines: string[] = [];
      if (args.organization.capital) {
        headerLines.push(
          `Société au capital de ${FCFA.format(Number(args.organization.capital))} FCFA`,
        );
      }
      const addrParts = [
        args.organization.address,
        args.organization.city,
        args.organization.country,
      ].filter(Boolean);
      if (addrParts.length) headerLines.push(addrParts.join(", "));
      const contactBits: string[] = [];
      if (args.organization.phone) contactBits.push(`Tél : ${args.organization.phone}`);
      if (args.organization.bp) contactBits.push(`BP : ${args.organization.bp}`);
      if (contactBits.length) headerLines.push(contactBits.join(" — "));
      const idBits: string[] = [];
      if (args.organization.rccm) idBits.push(`RCCM : ${args.organization.rccm}`);
      if (args.organization.ninea) idBits.push(`NINEA : ${args.organization.ninea}`);
      if (idBits.length) headerLines.push(idBits.join(" — "));

      doc.font("Helvetica").fontSize(9).fillColor("#444");
      for (const line of headerLines) doc.text(line);
      doc.fillColor("black").moveDown(2);

      // ============================================================
      //  Titre encadré
      // ============================================================
      const title = TYPE_LABEL[args.contract.type];
      const titleY = doc.y;
      const titleHeight = 32;
      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc
        .rect(doc.page.margins.left, titleY, pageWidth, titleHeight)
        .lineWidth(1)
        .stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(title, doc.page.margins.left, titleY + 9, {
          align: "center",
          width: pageWidth,
        });
      doc.y = titleY + titleHeight + 16;
      doc.x = doc.page.margins.left;

      // Référence sous le titre
      doc
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor("#555")
        .text(`Référence interne : ${args.contract.reference}`, {
          align: "right",
        });
      doc.fillColor("black").moveDown(1);

      // ============================================================
      //  ENTRE-LES SOUSSIGNES
      // ============================================================
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("ENTRE-LES SOUSSIGNES :");
      doc.moveDown(0.6);

      // Bloc Employeur
      const employerParts: string[] = [];
      employerParts.push(args.organization.name);
      if (args.organization.capital) {
        employerParts.push(
          `Société au capital de ${FCFA.format(Number(args.organization.capital))} FCFA`,
        );
      }
      const siege = [args.organization.address, args.organization.city]
        .filter(Boolean)
        .join(", ");
      if (siege) employerParts.push(`Siège social : ${siege}`);
      if (args.organization.phone)
        employerParts.push(`Téléphone : ${args.organization.phone}`);
      if (args.organization.bp) employerParts.push(`BP : ${args.organization.bp}`);
      if (args.organization.rccm)
        employerParts.push(`RCCM : ${args.organization.rccm}`);
      if (args.organization.ninea)
        employerParts.push(`NINEA : ${args.organization.ninea}`);
      if (args.organization.legalRepName) {
        const repTitle = args.organization.legalRepTitle ?? "Représentant légal";
        employerParts.push(
          `Représentée par ${args.organization.legalRepName}, en sa qualité de ${repTitle}`,
        );
      }

      doc.font("Helvetica").fontSize(10);
      for (const line of employerParts) {
        doc.text(line, { align: "left" });
      }
      doc.moveDown(0.4);
      doc
        .font("Helvetica-Oblique")
        .text("Ci-après dénommée « l'Employeur » ;");
      doc.font("Helvetica-Bold").text("D'une part,");
      doc.moveDown(0.8);

      doc.font("Helvetica-Bold").text("ET");
      doc.moveDown(0.8);

      // Bloc Employé
      const employeeParts: string[] = [];
      employeeParts.push(
        `Nom et prénom : ${args.agent.lastName.toUpperCase()} ${args.agent.firstName}`,
      );
      const birthLine: string[] = [];
      if (args.agent.birthDate)
        birthLine.push(`Date de naissance : ${formatDateShort(args.agent.birthDate)}`);
      if (args.agent.birthPlace)
        birthLine.push(`Lieu de naissance : ${args.agent.birthPlace}`);
      if (birthLine.length) employeeParts.push(birthLine.join(" — "));
      if (args.agent.nationality)
        employeeParts.push(`Nationalité : ${args.agent.nationality}`);
      if (args.agent.maritalStatus)
        employeeParts.push(`Situation de famille : ${args.agent.maritalStatus}`);
      if (args.agent.address)
        employeeParts.push(`Lieu de résidence : ${args.agent.address}`);
      employeeParts.push(`Matricule : ${args.agent.matricule}`);

      doc.font("Helvetica").fontSize(10);
      for (const line of employeeParts) {
        doc.text(line, { align: "left" });
      }
      doc.moveDown(0.4);
      doc
        .font("Helvetica-Oblique")
        .text("Ci-après dénommé(e) « l'Employé(e) » ;");
      doc.font("Helvetica-Bold").text("D'autre part,");
      doc.moveDown(0.8);

      doc
        .font("Helvetica")
        .text("Il a été convenu et arrêté ce qui suit :", { align: "left" });
      doc.moveDown(1);

      // ============================================================
      //  Articles
      // ============================================================
      const article = (n: number, title: string, body: string) => {
        // Si on est proche du bas de page, on saute pour éviter une coupure laide
        if (doc.y > doc.page.height - 150) doc.addPage();
        doc
          .font("Helvetica-Bold")
          .fontSize(10.5)
          .text(`ARTICLE ${n} — ${title.toUpperCase()}`);
        doc.moveDown(0.3);
        doc.font("Helvetica").fontSize(10).text(body, { align: "justify" });
        doc.moveDown(0.8);
      };

      // Salaire en lettres (mensuel brut)
      const salaryWords = numberToWords(args.contract.baseSalary);

      article(
        1,
        "Engagement",
        `L'Employeur engage l'Employé(e) en qualité de « ${args.agent.jobTitle} » ` +
          `affecté(e) au service ${args.agent.serviceName}, sous l'autorité hiérarchique ` +
          `de l'Employeur ou de toute personne désignée par celui-ci.`,
      );

      article(
        2,
        "Durée du contrat",
        isCdd && args.contract.endDate
          ? `Le présent contrat est conclu pour une durée déterminée. Il prend effet le ` +
              `${formatDate(args.contract.startDate)} et prendra fin le ` +
              `${formatDate(args.contract.endDate)}, sauf renouvellement par avenant écrit. ` +
              `Il est précédé d'une période d'essai d'un (1) mois, durant laquelle chaque partie ` +
              `peut y mettre fin sans préavis ni indemnité.`
          : `Le présent contrat est conclu pour une durée indéterminée et prend effet le ` +
              `${formatDate(args.contract.startDate)}. Il est précédé d'une période d'essai ` +
              `de trois (3) mois, renouvelable une fois, durant laquelle chaque partie peut ` +
              `y mettre fin sans préavis ni indemnité.`,
      );

      article(
        3,
        "Lieu de travail",
        `L'Employé(e) exercera ses fonctions au siège de l'Employeur situé à ${cityForSig}. ` +
          `Toutefois, en raison des nécessités de service, l'Employé(e) pourra être amené(e) ` +
          `à effectuer des déplacements ponctuels au Sénégal ou à l'étranger.`,
      );

      article(
        4,
        "Mobilité",
        `L'Employé(e) accepte par avance toute mutation, affectation ou changement de poste ` +
          `que l'Employeur pourrait décider dans l'intérêt du service, sur l'ensemble du ` +
          `territoire national, sans que cela ne constitue une modification substantielle ` +
          `du contrat de travail.`,
      );

      article(
        5,
        "Horaires de travail",
        `La durée hebdomadaire du travail est de quarante (40) heures, conformément à la ` +
          `législation en vigueur. Les horaires d'ouverture sont fixés par l'Employeur ` +
          `et peuvent être modifiés en fonction des besoins du service. Les heures ` +
          `supplémentaires effectuées à la demande expresse de l'Employeur seront rémunérées ` +
          `selon les taux légaux.`,
      );

      article(
        6,
        "Obligations de l'employé",
        `L'Employé(e) s'engage à exercer ses fonctions avec diligence, loyauté et probité, ` +
          `à se conformer aux directives de la hiérarchie, à respecter le règlement intérieur ` +
          `et à consacrer l'intégralité de son activité professionnelle à l'Employeur. ` +
          `Toute activité rémunérée parallèle est subordonnée à l'autorisation écrite préalable ` +
          `de l'Employeur.`,
      );

      article(
        7,
        "Clause de non-concurrence",
        `Pendant une durée d'un (1) an à compter de la cessation du présent contrat, quelle ` +
          `qu'en soit la cause, l'Employé(e) s'interdit d'exercer, directement ou indirectement, ` +
          `une activité concurrente de celle de l'Employeur dans un rayon de cinquante (50) ` +
          `kilomètres autour du siège de ce dernier. Cette clause s'applique sans contrepartie ` +
          `financière, sauf accord écrit ultérieur des parties.`,
      );

      article(
        8,
        "Confidentialité",
        `L'Employé(e) s'engage à observer la plus stricte discrétion sur l'ensemble des ` +
          `informations, documents, données et secrets d'affaires dont il/elle aura connaissance ` +
          `à l'occasion de l'exécution de ses fonctions. Cette obligation perdure sans limitation ` +
          `de durée après la cessation du présent contrat.`,
      );

      article(
        9,
        "Rémunération",
        `En contrepartie de son travail, l'Employé(e) percevra un salaire mensuel brut de ` +
          `${FCFA.format(args.contract.baseSalary)} FCFA (` +
          salaryWords +
          ` francs CFA)` +
          (args.contract.grade
            ? `, correspondant à l'échelon « ${args.contract.grade} »`
            : "") +
          `. Le salaire sera versé par virement bancaire au plus tard le dernier jour ouvrable ` +
          `du mois. En outre, l'Employé(e) pourra bénéficier d'une prime annuelle équivalente ` +
          `à un (1) à six (6) mois de salaire, dont le montant est laissé à l'appréciation ` +
          `de l'Employeur en fonction des résultats individuels et de la performance de ` +
          `l'entreprise.`,
      );

      article(
        10,
        "Couvertures sanitaire et sociale",
        `L'Employé(e) sera immatriculé(e) à la Caisse de Sécurité Sociale (CSS) et à ` +
          `l'Institution de Prévoyance Retraite du Sénégal (IPRES). Il/elle bénéficiera ` +
          `également de la couverture maladie offerte par l'Institut de Prévoyance Maladie ` +
          `(IPM) de l'Employeur. Les cotisations légales (IPRES, IPM, TRIMF, impôt sur le ` +
          `revenu, CFCE) seront retenues à la source conformément à la réglementation en ` +
          `vigueur.`,
      );

      article(
        11,
        "Lois et règlements applicables",
        `Le présent contrat est régi par les dispositions de la loi n° 97-17 du 1er décembre ` +
          `1997 portant Code du travail de la République du Sénégal, ses textes d'application, ` +
          `ainsi que par la convention collective applicable au secteur d'activité de l'Employeur ` +
          `et le règlement intérieur de l'entreprise. Tout différend né de l'exécution ou de la ` +
          `rupture du présent contrat sera soumis, après tentative de conciliation devant ` +
          `l'Inspecteur du Travail, aux juridictions compétentes de Dakar.`,
      );

      // ============================================================
      //  Mention finale & Signatures
      // ============================================================
      if (doc.y > doc.page.height - 200) doc.addPage();
      doc.moveDown(1);
      doc
        .font("Helvetica")
        .fontSize(10)
        .text(
          `Fait et signé à ${cityForSig}, le ${formatDate(new Date())}, en quatre (4) exemplaires originaux.`,
          { align: "left" },
        );
      doc.moveDown(2);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("SIGNATURES", { align: "center", underline: true });
      doc.moveDown(2);

      // Trois colonnes : Employeur — Employé — Inspecteur
      const totalWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colWidth = totalWidth / 3;
      const baseY = doc.y;
      const xLeft = doc.page.margins.left;
      const xMid = doc.page.margins.left + colWidth;
      const xRight = doc.page.margins.left + 2 * colWidth;

      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("L'Employeur", xLeft, baseY, { width: colWidth, align: "center" });
      doc.text("L'Employé(e)", xMid, baseY, { width: colWidth, align: "center" });
      doc.text("L'INSPECTEUR DU TRAVAIL", xRight, baseY, {
        width: colWidth,
        align: "center",
      });

      doc.moveDown(0.5);
      const subY = baseY + 18;
      doc.font("Helvetica-Oblique").fontSize(8).fillColor("#666");
      doc.text("(cachet et signature)", xLeft, subY, {
        width: colWidth,
        align: "center",
      });
      doc.text("(mention « lu et approuvé »)", xMid, subY, {
        width: colWidth,
        align: "center",
      });
      doc.text("(visa et cachet)", xRight, subY, {
        width: colWidth,
        align: "center",
      });
      doc.fillColor("black");

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Convertit un nombre en lettres françaises (utilisé pour la mention légale
 * du salaire). Implémentation simplifiée — suffisante pour les montants
 * usuels (< 999 999 999).
 */
function numberToWords(n: number): string {
  if (n === 0) return "zéro";
  const units = [
    "",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
    "dix-sept",
    "dix-huit",
    "dix-neuf",
  ];
  const tens = [
    "",
    "",
    "vingt",
    "trente",
    "quarante",
    "cinquante",
    "soixante",
    "soixante",
    "quatre-vingt",
    "quatre-vingt",
  ];

  function below100(num: number): string {
    if (num < 20) return units[num];
    const t = Math.floor(num / 10);
    const u = num % 10;
    if (t === 7 || t === 9) {
      return `${tens[t]}-${units[10 + u]}`;
    }
    if (u === 0) return tens[t] + (t === 8 ? "s" : "");
    if (u === 1 && t !== 8) return `${tens[t]} et un`;
    return `${tens[t]}-${units[u]}`;
  }

  function below1000(num: number): string {
    if (num < 100) return below100(num);
    const h = Math.floor(num / 100);
    const r = num % 100;
    const cent = h === 1 ? "cent" : `${units[h]} cent${r === 0 ? "s" : ""}`;
    return r === 0 ? cent : `${cent} ${below100(r)}`;
  }

  if (n < 1000) return below1000(n);

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (millions > 0) {
    parts.push(
      millions === 1
        ? "un million"
        : `${below1000(millions)} millions`,
    );
  }
  if (thousands > 0) {
    parts.push(
      thousands === 1 ? "mille" : `${below1000(thousands)} mille`,
    );
  }
  if (rest > 0) parts.push(below1000(rest));
  return parts.join(" ");
}
