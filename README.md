# SIRH — Université St Christopher

Système d'Information des Ressources Humaines (SIRH) de l'Université
St Christopher (Dakar). Application web de gestion centralisée du
personnel **PER** (Enseignant et Recherche) et **PATS** (Administratif,
Technique et de Service).

> Voir [`docs/sirh_specifications.md`](docs/sirh_specifications.md) pour
> les spécifications complètes et [`docs/sirh_st_christopher_v7.html`](docs/sirh_st_christopher_v7.html)
> pour la maquette d'origine.

## Stack technique

| Couche        | Technologie                          |
| ------------- | ------------------------------------- |
| Framework     | Next.js 16 (App Router) — front + API |
| Langage       | TypeScript                            |
| Style         | Tailwind CSS v4                        |
| Base de données | PostgreSQL                          |
| ORM           | Prisma                                |
| Graphiques    | Chart.js                              |

Un seul langage (TypeScript) et un seul framework pour l'interface et le
backend. PostgreSQL est choisi pour sa robustesse en accès concurrents
(plusieurs utilisateurs connectés simultanément).

## Prérequis

- Node.js 20+
- PostgreSQL 14+

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer la base de données
cp .env.example .env
#    puis renseigner DATABASE_URL dans .env

# 3. Créer le schéma et charger les données de démonstration
npm run db:migrate
npm run db:seed

# 4. Lancer le serveur de développement
npm run dev
```

L'application est disponible sur http://localhost:3000

## Comptes de démonstration

Mot de passe commun : `sirh2026`

| Profil             | Email                          |
| ------------------ | ------------------------------ |
| Direction Générale | direction@st-christopher.sn    |
| DRH                | drh@st-christopher.sn          |
| Manager            | manager@st-christopher.sn      |
| Agent              | agent@st-christopher.sn        |

## Scripts

| Commande              | Description                                  |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Serveur de développement                     |
| `npm run build`       | Build de production                          |
| `npm run db:migrate`  | Applique les migrations Prisma               |
| `npm run db:seed`     | Charge les données de démonstration          |
| `npm run db:studio`   | Interface visuelle de la base (Prisma Studio) |

## Structure du projet

```
prisma/
  schema.prisma      Schéma de la base de données (9 modules)
  seed.ts            Données de démonstration (245 agents)
src/
  app/
    (app)/           Pages avec layout commun (sidebar + topbar)
      tableau-de-bord/
      personnel/  paie/  conges/  evaluation/
      formation/  recrutement/  communication/
      conformite/  parametres/
  components/        Composants d'interface
  lib/               Client Prisma, configuration navigation
```

## État d'avancement

- [x] Structure du projet, thème et navigation
- [x] Schéma de base de données (9 modules)
- [x] Tableau de bord — KPI en temps réel
- [ ] Tableau de bord — graphiques analytiques
- [ ] Authentification et gestion des profils
- [ ] Modules fonctionnels (personnel, paie, congés, …)
