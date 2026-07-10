@AGENTS.md

# Moovenco — Documentation projet

Application de gestion de transport de voyageurs pour **SAS RGO Mobilités Janzé** (Bretagne).

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| UI | React 19, Tailwind CSS v4, inline styles (Inter) |
| Backend | Supabase (Postgres + Auth + Storage) |
| Typage | TypeScript 5 |
| PDF | jsPDF (génération côté client) |
| Carte | Leaflet + OSRM (routing open source) |
| Graphiques | Recharts |
| Export | xlsx, papaparse |
| Email | Resend (`app/api/send-email/route.ts`) |

---

## Architecture des dossiers

```
moovenco/
├── app/                        # Routes Next.js App Router
│   ├── layout.tsx              # Layout racine
│   ├── page.tsx                # Redirection vers /dashboard
│   ├── auth/page.tsx           # Login Supabase
│   ├── accès-refusé/page.tsx
│   ├── api/send-email/         # API Route Resend
│   │
│   ├── dashboard/              # KPIs, CA, anomalies, conso
│   ├── commercial/             # Devis → BC → Factures + Adresses
│   │   ├── page.tsx            # Onglet Devis & Factures
│   │   ├── commandes.tsx       # Onglet Bons de commande
│   │   └── adresses.tsx        # Onglet Adresses
│   ├── comptabilite/           # Factures, clients, tarifs, RH, bulletins
│   │   ├── page.tsx            # Conteneur d'onglets
│   │   ├── factures.tsx
│   │   ├── clients.tsx
│   │   ├── tarifs.tsx
│   │   ├── personnel.tsx       # Fiches conducteurs + circuits habituels
│   │   ├── prepaie.tsx         # Préparation paie (saisie jours)
│   │   └── bulletins.tsx       # Bulletins de salaire
│   ├── planning/               # Grille semaine conducteurs/véhicules
│   │   ├── page.tsx            # Grille + panel créneaux
│   │   ├── DayGantt.jsx        # Vue Gantt d'une journée
│   │   ├── CrossView.jsx       # Vue croisée conducteurs × jours
│   │   └── CrossDetailView.jsx # Détail d'un jour toutes conducteurs
│   ├── atelier/                # Gestion du parc + anomalies
│   ├── scolaire/               # Circuits scolaires + carte Leaflet
│   ├── conducteurs/            # Fiches conducteurs (vue allégée)
│   ├── personnel/              # = comptabilite/personnel en standalone
│   ├── clients/                # Fiches clients
│   ├── documents/              # Documents généraux
│   ├── anomalies/              # Anomalies (vue globale)
│   ├── import/                 # Import CSV/xlsx
│   └── permissions/            # Gestion RBAC par module
│
└── src/
    ├── components/
    │   ├── Sidebar.jsx         # Navigation latérale (prop: currentPage)
    │   ├── Navbar.jsx
    │   ├── AddressPicker.jsx   # Autocomplete sur table `addresses`
    │   ├── VehiclePicker.jsx   # Autocomplete sur table `vehicles`
    │   └── ConsumptionChart.jsx
    └── lib/
        ├── supabase.js         # Client singleton Supabase
        ├── auth.js             # getCurrentProfile, getPermissions, MODULES, filterModules
        ├── useAuth.ts          # Hook client : vérifie session + permissions (redirige si besoin)
        ├── constants.ts        # COMPANY_ID, RGO, TVA_TAUX, STATUTS_DOC, EMPTY_FORM_DEVIS…
        ├── utils.ts            # generateId, getNextNumero, calcTotaux, buildLignesAuto, ensureClient…
        ├── pdf.ts              # Génération PDF devis/factures
        ├── osrm.ts             # Calcul distances/durées via OSRM public
        ├── planningEngine.ts   # Moteur planning : squelettes PDS/HLP/MEP/FDS, RSE, réaffectation
        ├── rse.ts              # Règles RSE : amplitude max, alertes, formatDuration
        └── skeleton.ts         # Composants squelette de chargement
```

---

## Tables Supabase

Toutes les tables ont `company_id = COMPANY_ID` (UUID hardcodé dans `src/lib/constants.ts`).

### Données commerciales

| Table | Description |
|---|---|
| `factures` | Table unifiée devis + factures. `type_document` ∈ `['devis','facture']`. `statut` ∈ `['devis','signe','bc','emise','envoyee','payee','annulee']`. Contient les lignes JSON (`lignes[]`), les montants HT/TVA/TTC et les données opérationnelles (horaires, conducteur, véhicule, etc.) |
| `commandes` | Bons de commande transformés depuis `factures`. `status` ∈ `['confirmee','affectee']`. Champs clés : `reference`, `assigned_driver`, `assigned_vehicle`, `retour_recu_at`, `retour_vu` |
| `clients` | Fiches clients. Clés : `name`, `type` (`mairie/ecole/entreprise/particulier`), `adresse`, `cp`, `ville`, `contact_nom`, `contact_prenom`, `contact_tel`, `contact_mail`, `siret`, `active` |
| `tarifs` | Grille tarifaire. Clés : `vehicle_type`, `client_type`, `tarif_km`, `tarif_journee`, `actif` |
| `addresses` | Adresses enregistrées (lieux récurrents). Clés : `name`, `address`, `lat`, `lng` |
| `module_documents` | Pièces jointes liées à une entité. Clés : `module`, `entity_id`, `nom`, `categorie`, `url`, `taille` |
| `client_documents` | Documents liés à une fiche client |
| `documents` | Documents généraux (module Documents) |

### Planning & RH

| Table | Description |
|---|---|
| `planning` | Enregistrement journalier par conducteur. Clés : `driver_id`, `date`, `day_type`, `day_color`, `valide`, `valide_at` |
| `slots` | Créneaux dans un planning. Clés : `planning_id`, `label`, `type` (`scolaire/occasionnel/mixte/regulier/repos/neutre`), `color`, `start_time`, `end_time`, `from_label`, `to_label`, `vehicle`, `notes`, `circuit_id` |
| `profiles` | Utilisateurs = conducteurs + admin. Clés : `id`, `name`, `role` (`conducteur/super_admin/directeur/gestionnaire`), `company_id`, `active`, `initials`, `color`, `contract` |
| `driver_details` | Infos complémentaires conducteur. Clés : `id` (= profiles.id), `dispo_vacances` |
| `driver_circuits` | Circuits habituels par conducteur. Clés : `driver_id`, `circuit_id`, `jours` (array de jours), `actif` |
| `absences` | Absences du personnel. Clés : `driver_id`, `date_debut`, `date_fin`, `type`, `motif` |
| `prepaie_jours` | Saisie journalière pour la paie. Clés : `driver_id`, `date`, `type_journee`, `heures` |
| `staff_documents` | Documents RH (contrats, permis…). Clés : `driver_id`, `nom`, `categorie`, `url` |
| `permissions` | RBAC : `role`, `module`, `access` (`none/read/write`) |

### Scolaire

| Table | Description |
|---|---|
| `circuits` | Circuits scolaires. Clés : `name`, `code`, `heure_debut`, `heure_fin` |
| `circuit_stops` | Arrêts d'un circuit. Clés : `circuit_id`, `address_id`, `ordre`, `heure_passage`, `label` |
| `calendrier_scolaire` | Périodes scolaires. Clés : `type` (`cours/vacances`), `date_debut`, `date_fin` |

### Atelier & Parc

| Table | Description |
|---|---|
| `vehicles` | Parc de véhicules. Clés : `plate`, `type` (`autocar/minibus`), `active`, `places` |
| `interventions` | Interventions d'entretien. Clés : `vehicle_id`, `date`, `type`, `description`, `cout` |
| `anomalies` | Anomalies signalées. Clés : `vehicle_id`, `date`, `description`, `statut`, `gravite` |
| `fuel_logs` | Logs de carburant. Clés : `vehicle_id`, `date`, `litres`, `km` |

### Dashboard

| Table | Description |
|---|---|
| `historique_ca` | Historique CA mensuel |
| `couts` | Coûts opérationnels |

---

## Circuit documentaire

```
Devis (DEV2026-001)
  │
  ├─[Marquer signé]─→ statut: "signe"
  │
  ├─[Transformer en facture]─→ type_document: "facture", statut: "emise", numero: F2026-001
  │     │
  │     ├─[Marquer envoyée]─→ statut: "envoyee"
  │     └─[Marquer payée]──→ statut: "payee"
  │
  └─[Générer BC PDF]─→ jsPDF client-side → téléchargement
```

Les commandes (`commandes`) sont des entités issues de `factures` (déclenchées par le gestionnaire commercial). Un BC confirmé peut être affecté à un conducteur depuis le planning.

---

## Moteur de planning (`src/lib/planningEngine.ts`)

Génère automatiquement le squelette d'une journée conducteur :

- **`genererSquelettePourCircuit(planningId, driverId, circuitId, existingSlots)`** : crée les créneaux PDS → HLP → service scolaire → FDS, avec distances OSRM.
- **`genererSquelettePourCommande(planningId, driverId, order)`** : idem pour une commande occasionnelle (PDS/HLP/service/MEP/FDS).
- **`recalculerJournee(planningId, driverId)`** : recalcule les tampons PDS/HLP/MEP/FDS autour des services existants.
- **`reassignSlotToDriver(slotId, fromDriverId, toDriverId, date)`** : réaffecte un créneau et recalcule les deux journées.

Les tampons standards sont : `PDS` (prise de service), `HLP` (haut-le-pied), `MEP` (mise en place), `FDS` (fin de service), `MAD` (mise à disposition).

---

## Authentification & permissions

- Auth gérée par Supabase Auth. Session accessible via `supabase.auth.getSession()`.
- `profiles` contient le rôle applicatif. Rôles : `super_admin`, `directeur` (accès total), `gestionnaire`, `conducteur`.
- Hook `useAuth(requiredModule?)` : vérifie la session et l'accès au module, redirige vers `/auth` ou `/acces-refuse`.
- RBAC via table `permissions` : `{ company_id, role, module, access }`. Les modules sont les clés de `MODULES` dans `src/lib/auth.js`.

---

## Conventions de code

### Constantes
Tout ce qui est partagé est dans `src/lib/constants.ts` et `src/lib/utils.ts`. Ne pas redéfinir localement `calcMontantHT`, `buildLignesAuto`, etc. — ils existent déjà dans utils.

### IDs
`generateId()` de `src/lib/utils.ts` génère des UUIDs v4 côté client. Tous les inserts Supabase passent par cet UUID explicite (pas d'auto-increment Postgres).

### Numérotation documents
`getNextNumero(docs, prefix)` → ex: `DEV2026-001`, `F2026-042`. Préfixe `DEV` pour devis, `F` pour factures.

### Styles
Toutes les pages utilisent **inline styles** (objet JS) — pas de classes Tailwind dans les composants métier. Tailwind est utilisé uniquement dans `app/layout.tsx` et `globals.css`.

### Palette de couleurs
| Rôle | Couleur |
|---|---|
| Fond app | `#ECEEF1` |
| Header/Sidebar | `#253044` |
| Texte primaire | `#1A2130` |
| Texte secondaire | `#4A5568` |
| Texte gris | `#8A95A3` |
| Bordures | `#D0D4DA` |
| Accent bleu | `#0E5AA7` |
| Accent violet (commercial) | `#7B3FB5` |
| Succès | `#1A9E50` |
| Danger | `#C62828` |
| Warning | `#D4720A` |

### Suppression
Toute suppression destructive est protégée par un mot de passe défini dans `src/lib/constants.ts`.

### Filtrage multi-société
Chaque requête Supabase filtre par `.eq('company_id', COMPANY_ID)`. `COMPANY_ID` est importé depuis `src/lib/constants.ts`.

### Pattern de chargement
Les pages chargent leurs données en parallèle via `Promise.all([...])` dans un `loadAll()` appelé au mount.
