/**
 * Registre des indicateurs ESG — dérivé du questionnaire trimestriel Admaius
 * (« Quarterly data »). Chaque entrée porte sa ligne Excel d'origine (`row`)
 * pour l'export ultérieur au même format.
 *
 * - `auto`   : indicateur pré-rempli depuis les données RH (clé de calcul,
 *              voir compute.ts). Reste éditable.
 * - `derived`: pourcentage calculé en direct à partir de deux autres réponses
 *              (numérateur / dénominateur) — lecture seule.
 */

export type EsgSectionKey =
  | "governance"
  | "confirmations"
  | "iso"
  | "policies"
  | "benefits"
  | "data";

export type EsgFieldType =
  | "text"
  | "textarea"
  | "number"
  | "percent"
  | "boolean"
  | "select";

export type EsgMetric = {
  key: string;
  row: number; // ligne d'origine dans « Quarterly data »
  section: EsgSectionKey;
  label: string;
  definition?: string;
  illustrative?: string;
  type: EsgFieldType;
  options?: string[];
  unit?: string; // "USD", "kWh", "tCO2e", "%"
  auto?: string; // clé de calcul RH (compute.ts)
  derived?: { num: string; den: string }; // % calculé depuis d'autres réponses
};

export const ESG_SECTIONS: { key: EsgSectionKey; label: string }[] = [
  { key: "governance", label: "Gouvernance" },
  { key: "confirmations", label: "Confirmations générales" },
  { key: "iso", label: "Certifications ISO" },
  { key: "policies", label: "Politiques" },
  { key: "benefits", label: "Avantages employés" },
  { key: "data", label: "Données chiffrées" },
];

export const ESG_SECTION_LABEL: Record<EsgSectionKey, string> =
  Object.fromEntries(ESG_SECTIONS.map((s) => [s.key, s.label])) as Record<
    EsgSectionKey,
    string
  >;

const POLICY_OPTIONS = [
  "Yes",
  "Statement only",
  "Currently planned / drafting",
  "No",
  "N/a",
];
const YESNO = ["Yes", "No", "N/a"];

const ISO_DEF =
  "Le cas échéant, préciser la portée, la date d'expiration et l'organisme certificateur (en commentaire).";

export const ESG_METRICS: EsgMetric[] = [
  // ---------------------------------------------------------- Gouvernance
  {
    key: "gov_esg_responsible",
    row: 6,
    section: "governance",
    label: "Responsable désigné des pratiques ESG",
    definition:
      "Indiquer s'il s'agit d'une personne nommée ou d'un comité. Si les deux existent, lister les deux.",
    illustrative: "Mohamed Ali (CEO)",
    type: "text",
  },
  {
    key: "gov_hr_responsible",
    row: 7,
    section: "governance",
    label: "Responsable désigné des pratiques RH",
    definition: "Nom et fonction de la personne responsable des pratiques RH.",
    illustrative: "Mohamed Ali (CEO) / Cheickna Sylla (Academic Director)",
    type: "text",
  },
  {
    key: "gov_hs_responsible",
    row: 8,
    section: "governance",
    label: "Responsable désigné Santé & Sécurité",
    definition:
      "Nom et fonction de la personne responsable de la santé et sécurité au travail.",
    illustrative: "Camara Diarietou (Head of Administrative Services)",
    type: "text",
  },
  {
    key: "gov_esg_committee",
    row: 9,
    section: "governance",
    label: "Comité ESG ou développement durable dédié (préciser)",
    definition:
      "Nom du/des comité(s) responsable(s) des sujets ESG. Préciser s'il traite d'un sous-ensemble (EHS, santé-sécurité…).",
    illustrative: "Non",
    type: "text",
  },
  {
    key: "gov_admaius_on_committee",
    row: 10,
    section: "governance",
    label: "Des membres Admaius siègent-ils à ce comité ?",
    definition:
      "Indiquer si des représentants d'Admaius Capital Partners siègent au comité ESG.",
    illustrative: "N/a",
    type: "select",
    options: YESNO,
  },
  {
    key: "gov_committee_meetings",
    row: 11,
    section: "governance",
    label: "Nombre de réunions du comité sur la période",
    definition: "La période de reporting correspond à ce trimestre de 3 mois.",
    illustrative: "1 (tenue le 27 juillet)",
    type: "text",
  },

  // ---------------------------------------------------- Confirmations
  {
    key: "conf_material_incidents",
    row: 15,
    section: "confirmations",
    label:
      "Incidents ESG significatifs, pénalités ou amendes sur la période ?",
    definition:
      "Tout événement environnemental, social ou de gouvernance significatif (perte financière, sanction, atteinte réputationnelle, préjudice). Si oui, détailler et indiquer les actions correctives (commentaire obligatoire).",
    illustrative: "Non",
    type: "select",
    options: YESNO,
  },
  {
    key: "conf_fatalities",
    row: 16,
    section: "confirmations",
    label: "Décès ou accidents/blessures graves liés au travail ?",
    definition:
      "Signaler tout incident mortel ou grave impliquant employés ou prestataires. Si oui, détailler chaque incident (commentaire obligatoire).",
    illustrative: "Non",
    type: "select",
    options: YESNO,
  },
  {
    key: "conf_accidents_count",
    row: 17,
    section: "confirmations",
    label: "Nombre total d'accidents du travail sur la période",
    definition:
      "Exclure les accidents graves déjà signalés ci-dessus. Inclure incidents mineurs/modérés (employés et prestataires).",
    illustrative: "5",
    type: "number",
  },
  {
    key: "conf_grievances",
    row: 18,
    section: "confirmations",
    label:
      "Plaintes liées à l'ESG remontées via les canaux employés/communauté ?",
    definition: "Signaler toute plainte ESG reçue via les mécanismes de grief.",
    illustrative: "Non",
    type: "select",
    options: YESNO,
  },

  // ------------------------------------------------------------- ISO
  { key: "iso_9001", row: 22, section: "iso", label: "ISO 9001 (Management de la qualité)", definition: ISO_DEF, illustrative: "ex. Oui — expire juillet 2027 / organisme Bureau Veritas", type: "text" },
  { key: "iso_14001", row: 23, section: "iso", label: "ISO 14001 (Management environnemental)", definition: ISO_DEF, illustrative: "ex. Oui — expire juin 2026 / SGS", type: "text" },
  { key: "iso_22301", row: 24, section: "iso", label: "ISO 22301 (Continuité d'activité)", definition: ISO_DEF, illustrative: "ex. Oui — expire juillet 2026 / Factocert", type: "text" },
  { key: "iso_22716", row: 25, section: "iso", label: "ISO 22716 (Cosmétiques — BPF)", definition: ISO_DEF, illustrative: "Non", type: "text" },
  { key: "iso_17034", row: 26, section: "iso", label: "ISO 17034 (Producteurs de matériaux de référence)", definition: ISO_DEF, illustrative: "Non", type: "text" },
  { key: "iso_17043", row: 27, section: "iso", label: "ISO 17043 (Essais d'aptitude)", definition: ISO_DEF, illustrative: "Non", type: "text" },
  { key: "iso_22000", row: 28, section: "iso", label: "ISO 22000 (Sécurité des denrées alimentaires)", definition: ISO_DEF, illustrative: "Non", type: "text" },
  { key: "iso_45001", row: 29, section: "iso", label: "ISO 45001 (Santé & sécurité au travail)", definition: ISO_DEF, illustrative: "Non", type: "text" },
  { key: "iso_gmp", row: 30, section: "iso", label: "Bonnes pratiques de fabrication (GMP)", definition: ISO_DEF, illustrative: "Non", type: "text" },

  // -------------------------------------------------------- Politiques
  { key: "pol_code_conduct", row: 34, section: "policies", label: "Code de conduite / d'éthique des affaires", definition: "Politique formelle de conduite/éthique ; préciser si elle couvre fournisseurs et partenaires.", illustrative: "Yes - also covers suppliers / value chain", type: "select", options: POLICY_OPTIONS },
  { key: "pol_esg", row: 35, section: "policies", label: "Politique RSE / durabilité / ESG", definition: "Politique documentée de durabilité ou ESG (principes et engagements).", illustrative: "Yes", type: "select", options: POLICY_OPTIONS },
  { key: "pol_esms", row: 36, section: "policies", label: "Système de gestion environnementale et sociale (SGES/ESMS)", definition: "Système structuré d'identification et gestion des risques E&S.", illustrative: "Yes", type: "select", options: POLICY_OPTIONS },
  { key: "pol_climate", row: 37, section: "policies", label: "Déclaration / politique climat", definition: "Évaluation et gestion des risques climatiques (émissions, énergie, résilience).", illustrative: "Yes - covered under ESG policy", type: "select", options: POLICY_OPTIONS },
  { key: "pol_hr", row: 38, section: "policies", label: "Politique RH / manuel des pratiques", definition: "Politique RH ou manuel employé (recrutement, avantages, conduite, grief).", illustrative: "Yes", type: "select", options: POLICY_OPTIONS },
  { key: "pol_dei", row: 39, section: "policies", label: "Politique Diversité, Équité & Inclusion (anti-discrimination)", definition: "Politique DEI incluant mesures anti-harcèlement et non-discrimination.", illustrative: "Yes", type: "select", options: POLICY_OPTIONS },
  { key: "pol_gbv", row: 40, section: "policies", label: "Prévention et réponse aux violences basées sur le genre (VBG)", definition: "Mécanisme/politique de prévention et réponse VBG (sensibilisation, signalement, sanctions).", illustrative: "Yes", type: "select", options: POLICY_OPTIONS },
  { key: "pol_hs", row: 41, section: "policies", label: "Politique / système de santé & sécurité", definition: "Politique/système SST formel, mis en œuvre et revu régulièrement.", illustrative: "Yes", type: "select", options: POLICY_OPTIONS },
  { key: "pol_grievance_internal", row: 42, section: "policies", label: "Mécanisme de grief — canaux internes (employés)", definition: "Processus confidentiel pour les employés (contact RH, hotline, formulaire).", illustrative: "Yes", type: "select", options: POLICY_OPTIONS },
  { key: "pol_grievance_external", row: 43, section: "policies", label: "Mécanisme de grief — canaux externes (fournisseurs, clients, communautés)", definition: "Canal permettant aux parties externes de soumettre plaintes/retours.", illustrative: "Yes", type: "select", options: POLICY_OPTIONS },
  { key: "pol_waste", row: 44, section: "policies", label: "Système et politique de gestion des déchets", definition: "Politique de gestion des déchets et niveau de mise en œuvre (suivi, tri, élimination).", illustrative: "Statement only", type: "select", options: POLICY_OPTIONS },
  { key: "pol_anticorruption", row: 45, section: "policies", label: "Politique anti-corruption et anti-pots-de-vin", definition: "Politique anti-corruption formelle et formations/procédures associées.", illustrative: "Currently planned / drafting", type: "select", options: POLICY_OPTIONS },
  { key: "pol_supplychain", row: 46, section: "policies", label: "Politique chaîne d'approvisionnement & achats responsables", definition: "Politique fournisseurs incluant sélection, normes de travail, critères ESG.", illustrative: "Currently planned / drafting", type: "select", options: POLICY_OPTIONS },
  { key: "pol_data_security", row: 47, section: "policies", label: "Sécurité et confidentialité des données", definition: "Politique de sécurité/confidentialité conforme aux lois applicables (RGPD).", illustrative: "Yes", type: "select", options: POLICY_OPTIONS },

  // -------------------------------------------------------- Avantages
  { key: "ben_medical", row: 51, section: "benefits", label: "Mutuelle / assurance santé", definition: "Description courte en commentaire si pertinent.", illustrative: "Assurance santé privée complète pour tout le personnel à temps plein.", type: "boolean" },
  { key: "ben_flexible", row: 52, section: "benefits", label: "Travail flexible", illustrative: "Télétravail jusqu'à 2 jours/semaine ; horaires flexibles.", type: "boolean" },
  { key: "ben_parental", row: 53, section: "benefits", label: "Congé parental / familial au-delà du légal", illustrative: "Maternité : 16 semaines à 100 % ; paternité : 10 jours.", type: "boolean" },
  { key: "ben_childcare", row: 54, section: "benefits", label: "Aide à la garde d'enfants", illustrative: "Allocation garde de 50 USD/mois pour enfants de moins de 5 ans.", type: "boolean" },
  { key: "ben_recognition", row: 55, section: "benefits", label: "Programmes de reconnaissance / récompenses", illustrative: "« Employé du mois » trimestriel et bonus annuel d'équipe.", type: "boolean" },
  { key: "ben_pension", row: 56, section: "benefits", label: "Cotisation retraite supplémentaire au-delà du légal", illustrative: "Employeur cotise 5 % du salaire de base à un régime complémentaire.", type: "boolean" },
  { key: "ben_wellness", row: 57, section: "benefits", label: "Programmes bien-être (gym subventionnée, fruits…)", illustrative: "Allocation bien-être de 20 USD/mois ; fruits et café gratuits.", type: "boolean" },
  { key: "ben_development", row: 58, section: "benefits", label: "Développement professionnel / formation", illustrative: "Budget formation annuel de 500 USD par employé.", type: "boolean" },
  { key: "ben_other", row: 59, section: "benefits", label: "AUTRE — préciser", illustrative: "Retraite d'équipe annuelle ; ligne d'écoute et soutien psychologique.", type: "boolean" },

  // ---------------------------------------------------- Données chiffrées
  { key: "dp_total_fte", row: 63, section: "data", label: "Total FTEs (effectif équivalent temps plein)", definition: "Effectif total en ETP. Ici : agents présents (Actif/Suspendu), hors prestataires.", illustrative: "51", type: "number", auto: "totalFte" },
  { key: "dp_female_fte", row: 64, section: "data", label: "Female FTEs", definition: "Sous-ensemble du total (femmes).", illustrative: "19", type: "number", auto: "femaleFte" },
  { key: "dp_pct_female_fte", row: 65, section: "data", label: "% Female FTEs", definition: "Calculé : (Female FTEs / Total FTEs) × 100.", illustrative: "37 %", type: "percent", auto: "pctFemaleFte" },
  { key: "dp_youth_fte", row: 66, section: "data", label: "Youth FTEs (16-25 ans)", definition: "Nombre d'employés jeunes (16 à 25 ans) — calculé depuis les dates de naissance.", illustrative: "3", type: "number", auto: "youthFte" },
  { key: "dp_pct_youth_fte", row: 67, section: "data", label: "% Youth FTEs", definition: "Calculé : (Youth FTEs / Total FTEs) × 100.", illustrative: "6 %", type: "percent", auto: "pctYouthFte" },
  { key: "dp_senior_managers", row: 68, section: "data", label: "Cadres dirigeants / managers", definition: "Rôles d'encadrement (Manager + Direction dans gestRH).", illustrative: "9", type: "number", auto: "seniorManagers" },
  { key: "dp_female_senior", row: 69, section: "data", label: "Femmes cadres dirigeantes", definition: "Sous-ensemble (femmes).", illustrative: "4", type: "number", auto: "femaleSenior" },
  { key: "dp_pct_female_senior", row: 70, section: "data", label: "% Femmes cadres dirigeantes", definition: "Calculé : (Femmes cadres / Total cadres) × 100.", illustrative: "44 %", type: "percent", auto: "pctFemaleSenior" },
  { key: "dp_board_members", row: 71, section: "data", label: "Membres du conseil (ou organe équivalent)", illustrative: "7", type: "number" },
  { key: "dp_female_board", row: 72, section: "data", label: "Femmes au conseil", definition: "Sous-ensemble (femmes).", illustrative: "1", type: "number" },
  { key: "dp_pct_female_board", row: 73, section: "data", label: "% Femmes au conseil", definition: "Calculé automatiquement.", illustrative: "14 %", type: "percent", derived: { num: "dp_female_board", den: "dp_board_members" } },
  { key: "dp_independent_board", row: 74, section: "data", label: "Membres indépendants du conseil", definition: "Administrateurs non impliqués dans la gestion quotidienne, sans lien financier/familial matériel.", illustrative: "2", type: "number" },
  { key: "dp_pct_independent_board", row: 75, section: "data", label: "% Membres indépendants", definition: "Calculé automatiquement.", illustrative: "33 %", type: "percent", derived: { num: "dp_independent_board", den: "dp_board_members" } },
  { key: "dp_board_meetings", row: 76, section: "data", label: "Réunions du conseil sur la période", definition: "Période = ce trimestre de 3 mois.", illustrative: "8", type: "number" },
  { key: "dp_gender_pay_gap", row: 77, section: "data", label: "Écart de rémunération H/F (brut annuel)", definition: "((Rému. moyenne H − Rému. moyenne F) / Rému. moyenne H) × 100. Calculé depuis les bulletins.", illustrative: "25 %", type: "percent", auto: "genderPayGap" },
  { key: "dp_turnover_voluntary", row: 78, section: "data", label: "Turnover volontaire (démission, retraite…)", definition: "Employés partis volontairement sur la période — départs par motif démission/retraite/rupture.", illustrative: "1", type: "number", auto: "turnoverVoluntary" },
  { key: "dp_turnover_involuntary", row: 79, section: "data", label: "Turnover involontaire (licenciement…)", definition: "Employés partis involontairement — départs par motif licenciement/fin CDD/abandon.", illustrative: "2", type: "number", auto: "turnoverInvoluntary" },
  { key: "dp_pct_turnover", row: 80, section: "data", label: "% Turnover (volontaire + involontaire)", definition: "Calculé : total partants / effectif moyen × 100.", illustrative: "6 %", type: "percent", auto: "pctTurnover" },
  { key: "dp_new_jobs", row: 81, section: "data", label: "Nouveaux postes créés (ETP)", definition: "Postes nouvellement créés sur la période — embauches de la période (hors remplacements).", illustrative: "7", type: "number", auto: "newJobs" },
  { key: "dp_youth_internships", row: 82, section: "data", label: "Stages / programmes de formation pour jeunes soutenus", definition: "Nombre de stages/programmes structurés pour jeunes (durée et objet en commentaire).", illustrative: "2 stagiaires accueillis sur un programme structuré de 4 semaines", type: "text" },
  { key: "dp_suppliers_total", row: 83, section: "data", label: "Nombre total de fournisseurs / partenaires", definition: "Total des fournisseurs/partenaires engagés sur la période (locaux et internationaux).", illustrative: "15", type: "number" },
  { key: "dp_suppliers_local", row: 84, section: "data", label: "Fournisseurs / partenaires locaux", definition: "« Local » = même pays africain (ou pays voisin avec échanges directs).", illustrative: "7", type: "number" },
  { key: "dp_pct_local_suppliers", row: 85, section: "data", label: "% Fournisseurs locaux", definition: "Calculé : (Locaux / Total) × 100.", illustrative: "46 %", type: "percent", derived: { num: "dp_suppliers_local", den: "dp_suppliers_total" } },
  { key: "dp_suppliers_sme", row: 86, section: "data", label: "Fournisseurs PME", definition: "Fournisseurs qualifiés de PME selon la définition nationale officielle.", illustrative: "10", type: "number" },
  { key: "dp_pct_sme_suppliers", row: 87, section: "data", label: "% Fournisseurs PME", definition: "Calculé : (PME / Total) × 100.", illustrative: "67 %", type: "percent", derived: { num: "dp_suppliers_sme", den: "dp_suppliers_total" } },
  { key: "dp_pct_above_min_wage", row: 88, section: "data", label: "% d'employés payés au-dessus du salaire minimum local", definition: "Pourcentage d'employés au-dessus du salaire minimum national. Citer la source/référence légale.", illustrative: "100 % des employés > SMIG en vigueur", type: "text" },
  { key: "dp_total_wages_usd", row: 89, section: "data", label: "Valeur totale des salaires (USD) sur le trimestre", definition: "Salaires et bonus versés sur la période (hors avantages). Converti depuis la masse salariale brute FCFA.", illustrative: "200 000 $", type: "number", unit: "USD", auto: "totalWagesUsd" },
  { key: "dp_training_spend_usd", row: 90, section: "data", label: "Montant dépensé en formation (USD) sur le trimestre", definition: "Total dépensé en formation et développement sur la période.", illustrative: "25 000 $", type: "number", unit: "USD" },
  { key: "dp_electricity_kwh", row: 91, section: "data", label: "Consommation d'électricité sur le trimestre (kWh)", definition: "Consommation électrique totale. Données réelles de facture ; estimer sinon (préciser la méthode).", illustrative: "10 000 kWh", type: "number", unit: "kWh" },
  { key: "dp_electricity_renewable_pct", row: 92, section: "data", label: "% d'électricité issue de renouvelables", definition: "Part d'électricité renouvelable (mix réseau, solaire sur site). Estimation acceptée.", illustrative: "33 %", type: "text" },
  { key: "dp_energy_kwh", row: 93, section: "data", label: "Consommation d'énergie sur le trimestre (kWh)", definition: "Autres sources d'énergie (diesel, GPL, gaz…) converties en kWh.", illustrative: "5 350 kWh (500 L de diesel)", type: "text" },
  { key: "dp_emissions", row: 94, section: "data", label: "Émissions par scope 1/2/3 (période la plus récente)", definition: "Scope 1 (direct), 2 (électricité), 3 (chaîne de valeur) en tonnes CO₂e. Préciser méthodo/estimation en commentaire.", illustrative: "0 / 500 / 1250 tCO₂e (scopes 1/2/3)", type: "text" },
  { key: "dp_new_students", row: 95, section: "data", label: "Nouveaux étudiants inscrits sur le trimestre (SCU)", definition: "Nombre d'étudiants uniques ayant finalisé leur inscription à un cours/programme sur la période.", illustrative: "150", type: "number" },
  { key: "dp_female_enrollments", row: 96, section: "data", label: "Nouvelles inscriptions féminines sur le trimestre", definition: "Nombre d'étudiantes inscrites se déclarant femmes sur la même fenêtre.", illustrative: "89", type: "number" },
  { key: "dp_african_enrollments", row: 97, section: "data", label: "Nouvelles inscriptions africaines sur le trimestre", definition: "Étudiants ressortissants ou résidents permanents d'un pays africain au moment de l'inscription.", illustrative: "149", type: "number" },
  { key: "dp_total_graduates", row: 98, section: "data", label: "Nombre total de diplômés (cumulé à ce jour)", definition: "Total cumulé de diplômés depuis la création (chaque diplômé compté une fois).", illustrative: "149", type: "number" },
  { key: "dp_university_sites", row: 99, section: "data", label: "Nombre de sites universitaires opérationnels", definition: "Sites d'apprentissage officiels opérés/gérés par SCU (campus, centres régionaux…).", illustrative: "5", type: "number" },
];

export const ESG_METRIC_BY_KEY: Record<string, EsgMetric> = Object.fromEntries(
  ESG_METRICS.map((m) => [m.key, m]),
);

/** Clés des indicateurs pré-remplis automatiquement depuis les données RH. */
export const AUTO_METRIC_KEYS = ESG_METRICS.filter((m) => m.auto).map(
  (m) => m.key,
);
