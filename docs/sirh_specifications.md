# SIRH Université St Christopher — Spécifications du projet

## 1. Contexte général

L'**Université St Christopher** est une institution privée d'enseignement supérieur basée à Dakar (Sénégal), spécialisée dans la formation médicale et la recherche scientifique. Elle propose des cursus en médecine, médecine dentaire, pharmacie et sciences infirmières & obstétricales.

L'objectif du projet est de **concevoir et développer un Système d'Information des Ressources Humaines (SIRH) intégré** pour centraliser, automatiser et sécuriser la gestion de l'ensemble du capital humain de l'université.

## 2. Objectif de l'application

Le SIRH doit permettre à la **Direction Générale, à la DRH et aux responsables hiérarchiques** de :

- Centraliser et sécuriser toutes les données RH
- Automatiser les processus de paie, congés, évaluations et formations
- Suivre la performance et le bien-être du personnel
- Anticiper et prévenir les situations critiques (contrats arrivant à échéance, évaluations en retard, absentéisme élevé)
- Disposer d'un tableau de bord stratégique en temps réel pour la prise de décision

## 3. Populations gérées

L'application doit distinguer **deux catégories de personnel** :

| Catégorie | Description |
|---|---|
| **PER** | Personnel Enseignant et Recherche (enseignants, chercheurs, praticiens hospitaliers) |
| **PATS** | Personnel Administratif, Technique et de Service |

Chaque catégorie a ses propres règles (contrats, échelles salariales, processus d'évaluation) qui devront être paramétrables.

## 4. Profils utilisateurs

L'application doit gérer au minimum 4 profils avec des droits différents :

1. **Direction Générale** — accès complet, vue stratégique, validations finales
2. **DRH / Responsable RH** — accès complet à toutes les fonctionnalités RH
3. **Manager / Responsable de service** — accès limité à son équipe (validation de congés, évaluations)
4. **Agent (PER ou PATS)** — accès à son propre dossier, demandes de congés, consultation bulletins

## 5. Modules fonctionnels

L'application est structurée en **9 modules** :

### 5.1 Tableau de bord
- KPI principaux (effectif total, PER, PATS, taux de présence, alertes)
- Graphiques d'évolution (effectif sur 12 mois, masse salariale, pyramide des âges)
- Donut de répartition par catégorie
- Heatmap de présence par service
- Pipeline de recrutement (entonnoir)
- Indicateurs de performance et formation
- Panneau de notifications avec alertes RH

### 5.2 Gestion du personnel (PER/PATS)
- Création et gestion des dossiers individuels
- Informations personnelles, contractuelles, professionnelles
- Historique de carrière et postes occupés
- Organigramme dynamique de l'université
- Archivage sécurisé des documents (contrats, diplômes, certifications)
- Import/export en masse (Excel/CSV)

### 5.3 Paie & avantages sociaux
- Automatisation du calcul des salaires selon grilles PER/PATS
- Gestion des primes, indemnités et allocations
- Génération des bulletins de paie en PDF
- Déclarations sociales (CSS, IPRES, IPM) conformes à la réglementation sénégalaise
- Historique de paie par agent
- Calcul en FCFA

### 5.4 Congés & absences
- Demandes de congés en ligne par les agents
- Workflow de validation hiérarchique (Manager → DRH)
- Suivi des soldes (congés annuels, maladies, exceptionnels)
- Calendrier visuel des absences par service
- Gestion des justificatifs (certificats médicaux, etc.)
- Alertes automatiques sur les déséquilibres organisationnels

### 5.5 Recrutement & intégration
- Publication d'offres d'emploi
- Réception et tri des candidatures
- Pipeline de recrutement (Candidatures → Présélection → Entretiens → Finalistes → Recrutés)
- Planification des entretiens
- Parcours d'intégration des nouveaux collaborateurs (checklist d'onboarding)

### 5.6 Formation & développement
- Catalogue de formations internes et externes
- Plan de formation annuel
- Inscriptions et suivi des sessions
- Cartographie des compétences par agent
- Identification des besoins de développement
- Bilans de formation

### 5.7 Évaluation & performance
- Définition des objectifs individuels et collectifs
- Campagne d'entretiens annuels d'évaluation
- Grilles d'évaluation paramétrables (différentes pour PER et PATS)
- Identification des hauts potentiels
- Génération de rapports de performance
- Suivi de la mise en œuvre des plans d'action

### 5.8 Communication interne
- Notifications automatisées (échéances, validations, rappels)
- Annonces de la direction
- Calendrier institutionnel partagé
- Messagerie interne entre agents et managers

### 5.9 Conformité & archives
- Archivage sécurisé de tous les documents RH
- Respect du droit du travail sénégalais et du Code du travail
- Conformité RGPD pour les données personnelles
- Préparation des audits internes et externes
- Historique des modifications (traçabilité)

## 6. Identité visuelle

### 6.1 Palette de couleurs officielle

| Rôle | Hex | Usage |
|---|---|---|
| **Bleu St Christopher** | `#3359A4` | Couleur principale, sidebar, boutons principaux, PER |
| **Violet** | `#554596` | Accents secondaires, recherche, performance |
| **Vert** | `#7AB929` | Indicateurs positifs, PATS, succès |
| **Turquoise** | `#28B5BE` | Données informatives, présence |

Couleurs sémantiques additionnelles :
- Warning : `#E6A817`
- Danger : `#D9534F`

### 6.2 Typographie

- **Police titres** : Playfair Display (caractère académique et institutionnel)
- **Police corps de texte** : Inter (lisibilité et modernité)

### 6.3 Style général

- Design **épuré et professionnel**, adapté à une institution universitaire de prestige
- Sidebar bleu marine foncé (en dégradé)
- Cartes blanches avec bordures fines et ombres subtiles
- Icônes en cercle pastel à fond coloré clair
- Espacement généreux entre les sections

## 7. Spécifications du tableau de bord (page d'accueil)

Le tableau de bord doit présenter dans l'ordre :

1. **Topbar** : Titre + recherche fonctionnelle (agents/services) + bouton "Exporter" + cloche de notifications + profil utilisateur
2. **5 KPI cards horizontales** sur une ligne : Effectif total, Personnel PER, Personnel PATS, Taux de présence, Alertes RH (chaque carte avec icône cercle pastel + valeur + variation %)
3. **Filtres période** (Mois / Trimestre / Année) sur les graphiques d'évolution
4. **Graphique d'évolution de l'effectif** sur 12 mois (lignes PER vs PATS) + **Donut de répartition** par catégorie côte à côte
5. **Pyramide des âges** (Hommes/Femmes par tranche) + **Évolution de la masse salariale** (barres) côte à côte
6. **Heatmap de présence par service** (7 services × 20 jours) + **Pipeline de recrutement** (entonnoir 5 étapes) côte à côte
7. **Radar de performance RH** (Actuel vs Cible) + **Suivi des formations** (barres Réalisé vs Prévu) côte à côte
8. **Modules accès rapide** : 8 cartes compactes alignées sur une ligne (Personnel, Paie, Congés, Recrutement, Formation, Évaluation, Communication, Conformité)

Le **panneau de notifications** s'ouvre au clic sur la cloche et contient les alertes RH (contrats expirant, évaluations en retard, congés à valider).

## 8. Stack technique recommandée

### 8.1 Frontend
- **Framework** : React (avec Vite ou Next.js)
- **Styling** : Tailwind CSS ou styled-components
- **Charts** : Chart.js ou Recharts pour les graphiques
- **State management** : Zustand ou Redux Toolkit
- **Routing** : React Router

### 8.2 Backend
- **Langage** : Node.js (Express ou NestJS) **ou** Python (FastAPI ou Django)
- **Base de données** : PostgreSQL (idéal pour les relations complexes RH)
- **ORM** : Prisma (Node) ou SQLAlchemy (Python)
- **Authentification** : JWT avec refresh tokens
- **Stockage fichiers** : Local ou S3 (pour contrats, bulletins, justificatifs)

### 8.3 Sécurité
- Hashage des mots de passe (bcrypt)
- Chiffrement des données sensibles
- HTTPS obligatoire
- Logs d'audit pour toutes les actions RH
- Sauvegardes automatiques quotidiennes

### 8.4 Déploiement
- Conteneurisation Docker
- Hébergement cloud (AWS, Google Cloud, ou serveur dédié local)
- CI/CD via GitHub Actions

## 9. Données de test (pour la démo)

L'université compte actuellement :
- **245 agents** au total
- **98 PER** : 65 en enseignement, 33 en recherche
- **147 PATS** : 92 administratifs, 55 techniques
- Services : Médecine, Chirurgie, Pharmacie, Sciences infirmières, Administration, Technique, Recherche
- Masse salariale mensuelle : ~85 millions FCFA
- Taux de présence : 92 %

## 10. Critères de succès

L'application sera considérée comme réussie si elle permet :

- ✅ Une centralisation à 100 % des données RH (PER + PATS)
- ✅ Une réduction du temps de traitement administratif (paie, congés) d'au moins 50 %
- ✅ Une visibilité en temps réel de la Direction Générale sur les indicateurs clés
- ✅ Une conformité totale avec la réglementation sénégalaise et le RGPD
- ✅ Une adoption par 100 % du personnel dans les 6 mois suivant le déploiement
- ✅ Une prévention proactive des situations critiques (contrats, évaluations, absentéisme)

## 11. Phases de développement suggérées

### Phase 1 — MVP (3 mois)
- Authentification et gestion des profils
- Module Gestion du personnel
- Module Congés & absences
- Tableau de bord de base

### Phase 2 — Cœur métier (3 mois)
- Module Paie & avantages
- Module Évaluation & performance
- Module Formation & développement

### Phase 3 — Compléments (2 mois)
- Module Recrutement
- Module Communication interne
- Module Conformité & archives

### Phase 4 — Optimisation (1 mois)
- Tableaux de bord avancés
- Reporting personnalisé
- Mobile responsive complet
- Formation des utilisateurs

---

**Document préparé pour la conception du SIRH de l'Université St Christopher**
*Référence : Mémoire M2 GRH — Conception et mise en place d'un SIRH à l'Université St Christopher*
