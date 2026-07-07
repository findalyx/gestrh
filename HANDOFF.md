# Handoff — SIRH St Christopher · Module Personnel & Contrats

> Document à coller à un autre chat (Claude / autre) pour reprendre le travail
> sur le **bon repo**. Le code source de référence est entièrement disponible
> sur `segnoogo/gestRH` branche `main`. Ne pas tout réécrire — copier les
> fichiers depuis ce repo source.

---

## 1. Contexte

Projet : **SIRH Université St Christopher** (gestion RH, base Postgres, Prisma,
Next.js 16.2.6, Tailwind 4, React 19).

Tout le travail a été fait sur le repo `segnoogo/gestRH` mais Vercel est
en réalité connecté à un autre repo. Il faut donc **transposer ce travail
vers le bon repo** que tu (lecteur) vas gérer.

Le repo cible doit déjà être un projet Next.js avec :
- `prisma/schema.prisma` (modèle SIRH initial avec Agent, Service, Contract,
  Document, etc.)
- App Router (`src/app/(app)/...`)
- Tailwind avec palette `sc-blue`, `sc-purple`, `sc-teal`, `sc-green`, etc.
- Comptes de démo seedés (direction@/drh@/manager@/agent@-st-christopher.sn,
  mdp `sirh2026`)

Si le repo cible n'a pas exactement cette base, vérifier la compatibilité
avant de copier — le travail est calibré sur cette base.

---

## 2. Ce qui a été livré

Sept fonctionnalités majeures réparties en 8 commits :

1. **Schéma DB étendu** : modèles `ContractAmendment`, `ContractRenewal`,
   `Resignation`, `ContractNotification` ; colonnes BLOB sur `Document` et
   `Contract.signed*` ; enums étendus (`DocumentType`, `ContractStatus`,
   `AmendmentType`, `RenewalDecision`, `ResignationStatus`,
   `ContractNotificationKind`).
2. **Module Personnel** : liste filtrable + fiche agent à 8 onglets (Vue
   d'ensemble, Contrat, Avenants, Renouvellement, Documents, Notifications,
   Démission, Conformité).
3. **Création d'agent** : formulaire 4 sections (état civil, affectation,
   contrat initial, pièces justificatives) avec upload multi-fichier BLOB
   (CNI, diplôme, casier, RIB, photo, certif médical, CV).
4. **Génération `.docx` de contrats** : CDI / CDD / Stage / Vacation,
   upload du PDF signé en BLOB inline sur `Contract`.
5. **Alertes** : cartes dashboard pour échéances CDD (J−90/30/15/Expiré)
   et départs retraite (5 ans / 24 mois). Endpoint cron quotidien.
6. **Workflow renouvellement CDD** : ouverture dossier, décision DRH
   (renouveler / convertir CDI / non-renouveler), génération lettre
   `.docx`, notification formelle à l'agent.
7. **Démission Agent → DRH** : soumission, brouillon `.docx`, validation
   DRH, upload lettre signée, marquage effectif (bascule contrat en ROMPU).
8. **Avenants / Conformité / Stats / Clauses** : création d'avenant +
   génération `.docx` + signed ; audit légal sénégalais (durée CDD,
   renouvellements, période d'essai, pièces) ; page stats globales ;
   bibliothèque de 7 clauses types.

---

## 3. Procédure de transposition (pour toi, l'autre chat)

### A. Récupérer le code source

```bash
git clone https://github.com/segnoogo/gestRH.git /tmp/gestrh-src
cd /tmp/gestrh-src
git log --oneline main -10   # vérifier les 8 commits Phase 1-8 + build fix
```

### B. Identifier les fichiers à copier

```bash
# liste des fichiers ajoutés/modifiés par notre travail
git diff 8ebe297..80fcf0c --name-status
```

Les commits clés (sur `main` de `segnoogo/gestRH`) :
- `a3c7892` — Phase 1 (schéma + migration + seed)
- `d707686` — Phase 2 (UI Personnel)
- `8dada4a` — Phase 3 (création agent)
- `fc41309` — Phase 4 (génération Word + PDF signé)
- `0969f13` — Phase 5 (alertes)
- `47c389d` — Vercel cron config
- `4a5cf7f` — Phase 6 (renouvellement CDD)
- `82e57ca` — Phase 7 (démission)
- `9ae461e` — Phase 8 (avenants/conformité/stats/clauses)
- `80fcf0c` — Fix build script

### C. Fichiers à transposer

**Migration SQL (à appliquer obligatoirement avant que l'app fonctionne)**
- `prisma/schema.prisma` (remplacer entièrement)
- `prisma/migrations/20260604120000_contract_workflow/migration.sql` (NEW)
- `prisma/seed.ts` (remplacer — contient des échantillons pour les tests)

**Code applicatif** (tous NEW)
```
src/lib/
  ├── contract-utils.ts     # calculs purs (alertes, retraite, format)
  ├── personnel.ts          # queries Prisma typées
  ├── clauses.ts            # bibliothèque de 7 clauses types
  ├── compliance.ts         # vérifications légales
  ├── alerts.ts             # alertes CDD + retraite + matérialisation notifs
  ├── actions/
  │   ├── agent.ts          # createAgent, upload/delete document
  │   ├── contract.ts       # uploadSignedContract, delete
  │   ├── renewal.ts        # workflow renouvellement
  │   ├── resignation.ts    # workflow démission
  │   ├── notification.ts   # notifications standalone
  │   └── amendment.ts      # CRUD avenants
  └── docx/
      ├── contract.ts       # générateur contrat .docx (4 types)
      ├── notification.ts   # générateur lettre notification (5 types)
      ├── resignation.ts    # brouillon démission
      └── amendment.ts      # générateur avenant .docx

src/components/personnel/
  ├── AgentForm.tsx
  ├── AgentTabs.tsx
  ├── TabPlaceholder.tsx
  ├── DocumentUploader.tsx
  ├── DocumentDeleteButton.tsx
  ├── ContractActions.tsx
  ├── RenewalWidget.tsx
  ├── NotificationWidgets.tsx
  ├── ResignationWidgets.tsx
  └── AmendmentWidgets.tsx

src/components/dashboard/
  └── ContractAlertsCards.tsx

src/app/(app)/personnel/
  ├── page.tsx                       # remplace le placeholder
  ├── nouveau/page.tsx
  ├── statistiques/page.tsx
  ├── clauses/page.tsx
  └── [id]/
      ├── layout.tsx
      ├── page.tsx
      ├── contrat/page.tsx
      ├── avenants/page.tsx
      ├── renouvellement/page.tsx
      ├── documents/page.tsx
      ├── notifications/page.tsx
      ├── demission/page.tsx
      └── conformite/page.tsx

src/app/(app)/tableau-de-bord/page.tsx   # modifié (ajout 2 cartes alertes)

src/app/api/
  ├── documents/[id]/route.ts                          # GET download
  ├── contracts/[id]/docx/route.ts                     # GET génération
  ├── contracts/[id]/signed/route.ts                   # GET PDF signé
  ├── contract-notifications/[id]/route.ts             # GET lettre
  ├── resignations/[id]/draft/route.ts                 # GET brouillon
  ├── resignations/[id]/signed/route.ts                # GET PDF signé
  ├── amendments/[id]/docx/route.ts                    # GET génération
  ├── amendments/[id]/signed/route.ts                  # GET PDF signé
  └── cron/contract-alerts/route.ts                    # POST/GET cron
```

**Configuration**
- `package.json` :
  - Ajouter dépendance : `"docx": "^9.7.1"`
  - **CRITIQUE** : remplacer le script build par
    `"build": "prisma generate && prisma migrate deploy && next build"`
- `vercel.json` (NEW à la racine) :
  ```json
  {
    "crons": [
      { "path": "/api/cron/contract-alerts", "schedule": "0 6 * * *" }
    ]
  }
  ```

### D. Façon la plus simple pour toi : appliquer un patch unique

```bash
# depuis le repo cible
git remote add gestrh-src https://github.com/segnoogo/gestRH.git
git fetch gestrh-src main
git diff 8ebe297..gestrh-src/main > /tmp/sirh-personnel.patch
git apply --3way /tmp/sirh-personnel.patch
```

Ou bien cherry-pick les commits un par un :
```bash
git cherry-pick a3c7892 d707686 8dada4a fc41309 0969f13 47c389d 4a5cf7f 82e57ca 9ae461e 80fcf0c
```

---

## 4. Configuration Vercel à vérifier

Variables d'environnement requises :
- `DATABASE_URL` — connection string Postgres (obligatoire)
- `CRON_SECRET` — chaîne aléatoire pour sécuriser le cron quotidien
  (Vercel l'injecte automatiquement en header `Authorization: Bearer`)

Le cron `vercel.json` déclenche `/api/cron/contract-alerts` tous les jours
à 6 h du matin pour matérialiser les alertes en notifications Direction/DRH.

---

## 5. Points d'attention techniques

- **Prisma `Bytes` type** : la version de Prisma utilisée (6.19.3) attend
  `Uint8Array<ArrayBuffer>` (et non `Buffer`). Pattern utilisé partout :
  ```ts
  const fileData = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;
  ```
- **Next.js 16 params async** : tous les `params` de page et de route
  handler sont des `Promise<>` qu'il faut await.
- **ESLint strict** : pas de `Date.now()` en render (pure functions), pas
  d'apostrophes brutes en JSX (`&apos;`), pas de `<a href>` interne (utiliser
  `next/link`).
- **Auth simulée** : tant que l'auth réelle n'est pas branchée, les server
  actions attribuent les opérations au premier compte `DIRECTION` trouvé.
  À remplacer par la session utilisateur quand l'auth sera en place.
- **Stockage** : tous les fichiers sont stockés en BLOB dans Postgres
  (champs `Bytes`). Si le volume devient critique, migrer vers S3/MinIO
  en gardant l'interface des routes API.

---

## 6. Migration SQL — résumé du contenu

Une seule migration nouvelle : `20260604120000_contract_workflow`. Elle :
1. Étend les enums `ContractStatus` (+ `EN_ATTENTE_SIGNATURE`, `ROMPU`) et
   `DocumentType` (+ `CONTRAT_SIGNE`, `AVENANT`, `AVENANT_SIGNE`,
   `DEMISSION`, `NOTIFICATION_CONTRAT`, `CNI`, `CASIER_JUDICIAIRE`, `RIB`,
   `PHOTO`, `CERTIFICAT_MEDICAL`, `CV`).
2. Crée 4 enums : `AmendmentType`, `RenewalDecision`, `ResignationStatus`,
   `ContractNotificationKind`.
3. Ajoute 9 colonnes à `Contract` (probationEndDate, noticePeriodDays,
   workingHours, clauses, signedFileName, signedMimeType, signedFileData,
   signedSize, signedAt).
4. Restructure `Document` : drop `fileUrl`, ajoute `fileName`, `mimeType`,
   `size`, `fileData`, `contractId`, `uploadedById`.
5. Crée les 4 nouvelles tables avec leurs index et FK.

Le SQL complet est à `prisma/migrations/20260604120000_contract_workflow/migration.sql`
dans le repo source.

---

## 7. Test rapide post-déploiement

1. `https://<vercel-url>/personnel` doit afficher la liste filtrable
   (et non plus le placeholder ModulePlaceholder).
2. `/personnel/<id>/contrat` doit avoir un bouton « Générer en Word »
   qui télécharge un `.docx` valide.
3. Le tableau de bord doit afficher 2 cartes supplémentaires : « Échéances
   CDD à venir » et « Départs retraite à anticiper (5 ans) ».
4. `/personnel/nouveau` doit afficher le formulaire 4 sections (pas le
   placeholder).
5. `/personnel/statistiques` et `/personnel/clauses` doivent exister.

Si l'un de ces points ne fonctionne pas, le build Vercel a probablement
échoué — vérifier les logs de déploiement.
