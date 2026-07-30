# TODO — Backoffice `ffavironchrono`

> Refonte complète du frontend/backoffice React (chronométrage FFAviron).
> Stack : React 19 · Vite 7 · TypeScript · Tailwind 3 · shadcn/ui · React Router 7 · Axios · Socket.io.

## Comment utiliser ce fichier
- Coche les cases `- [ ]` → `- [x]` au fur et à mesure.
- Chaque tâche indique **Pourquoi**, les **Fichiers** concernés et un **Fait quand** (critère de fin).
- Priorités : **P0** bloquant · **P1** important · **P2** qualité · **P3** confort.
- Ne pas supprimer les tâches terminées : les garder cochées pour l'historique.

## Avancement global
- [ ] P0 — Corrections bloquantes (6/6)
- [ ] P0/P1 — Chronométrage : fiabilité & métier aviron (23/23)
- [ ] P1 — Refonte design FFAviron (7/8)
- [ ] P1 — Sécurité front (3/6)
- [ ] P2 — Fonctionnalités (1/4)
- [ ] P3 — Nettoyage & confort (0/5)

---

## P0 — Corrections bloquantes

- [x] **Corriger l'accès admin par événement** (`EventAdminLayout`)
  - Pourquoi : `EventAdminLayout` n'autorise que `admin`/`superadmin`, alors que `DashboardHome` propose « Accéder à l'administration » à tous les rôles et que `EventProtectedRoute` définit des permissions pour `organiser`, `editor`, `referee`, `timing`, `viewer`. → **les organisateurs non-admin sont bloqués**.
  - Fichiers : `src/components/layout/EventAdminLayout.tsx` (L80-95), `src/router/EventProtectedRoute.tsx`, `src/hooks/useEventRole.ts`, `src/pages/dashboard/DashboardHome.tsx`.
  - Fait quand : un utilisateur `organiser` d'un événement accède à `/event/:id/*` sans être admin global ; les menus s'adaptent à son rôle.

- [x] **Unifier la déconnexion**
  - Pourquoi : `EventAdminLayout` fait `localStorage.clear()` (efface aussi le thème et autres clés) alors que `AuthContext.logout()` ne retire que `authTokens`. Comportement incohérent.
  - Fichiers : `src/components/layout/EventAdminLayout.tsx`, `src/context/AuthContext.tsx`.
  - Fait quand : un seul chemin de logout, qui préserve le thème/préférences.

- [x] **Retirer les logs de tokens en clair**
  - Pourquoi : `AuthContext` loggue `access_token`/`refresh_token` dans la console (fuite).
  - Fichiers : `src/context/AuthContext.tsx` (≈ L15, L32, L37).
  - Fait quand : aucun token n'apparaît en console, même en dev.

- [x] **Compléter ou fusionner `EventsPage`**
  - Pourquoi : `src/pages/dashboard/EventsPage.tsx` est un stub de ~10 lignes (placeholder) mais routé.
  - Fichiers : `src/pages/dashboard/EventsPage.tsx`, `src/router/index.tsx`, `src/pages/dashboard/DashboardHome.tsx`.
  - Fait quand : la route affiche un vrai contenu ou est supprimée/redirigée.

- [x] **Localisation & branding de base**
  - Pourquoi : `index.html` a `lang="en"` (app en français), favicon = `vite.svg`, pas de métas de partage.
  - Fichiers : `index.html`, `public/`.
  - Fait quand : `lang="fr"`, favicon FFAviron, titre + métas OpenGraph corrects.

- [x] **Supprimer le contournement TypeScript**
  - Pourquoi : le script `build:skip-ts` permet de livrer avec des erreurs TS.
  - Fichiers : `package.json`.
  - Fait quand : `npm run build` échoue si le typage est cassé ; `build:skip-ts` retiré.

---

## Chronométrage — fiabilité & métier aviron

> Le socle est bon (points multiples, temps relatifs calculés côté API, live WebSocket, validation arbitre). Il manque la couche « métier aviron » et il reste des bugs de fiabilité à corriger en priorité.
> Fichiers principaux : `src/pages/event/TimingPage.tsx`, `src/components/timing/TimingTable.tsx`, `src/components/timing/TimeTrialPanel.tsx`, `src/components/timing/ServerClock.tsx`, `src/components/timing/CourseSelect.tsx`, `src/components/timing/DebugTimings.tsx`, `src/pages/event/ArbitresPage.tsx`, `src/pages/event/TimingPointsPage.tsx`, `src/pages/timing/TimingOverviewPage.tsx`, `src/constants/crewStatus.ts`, `src/utils/formatTime.ts`.
> ⚠️ Certaines tâches ont un pendant API (voir `ffavironchrono_api/TODO_API.md`, section « Chronométrage »).

### P0 — Bugs & fiabilité terrain

- [x] **Ne plus perdre les impulsions `pending` au rechargement** — [dépend API]
  - Pourquoi : `GET /timings/race/:id` ne renvoie que les timings **assignés** (filtre `required:true` sur les assignations) → les temps bruts non affectés disparaissent après refresh.
  - Fichiers : `src/pages/event/TimingPage.tsx`, `src/components/timing/TimingTable.tsx` (+ API `timingController.getTimingsByRace`).
  - Fait quand : après rechargement, les impulsions non assignées sont toujours présentes et affectables.

- [x] **Resynchroniser l'horloge périodiquement**
  - Pourquoi : la sync `/server-time` n'est faite **qu'une fois** au montage → dérive d'horloge sur une longue session de chrono.
  - Fichiers : `src/pages/event/TimingPage.tsx`, `src/components/timing/ServerClock.tsx` ; utiliser `GET /server-time-offset` (déjà dispo côté API, non utilisé).
  - Fait quand : l'offset est recalculé à intervalle régulier + à la reconnexion réseau.

- [x] **Corriger `ServerClock.tsx`**
  - Pourquoi : lit `res.data.time` au lieu de `res.data.server_time` → composant non fonctionnel.
  - Fichiers : `src/components/timing/ServerClock.tsx`.
  - Fait quand : l'horloge affiche l'heure serveur correcte.

- [x] **Corriger `DebugTimings.tsx`**
  - Pourquoi : appelle `/api/timings/...` en relatif (fetch) au lieu du client axios configuré → cassé en prod.
  - Fichiers : `src/components/timing/DebugTimings.tsx`.
  - Fait quand : les actions debug passent par le client `api` et fonctionnent (ou la page est retirée si obsolète).

- [x] **Uniformiser le statut `non_official`**
  - Fichiers : `src/components/timing/CourseSelect.tsx`.
  - Fait quand : un seul libellé de statut partout.

- [x] **Verrou anti-conflit multi-arbitres** — [dépend API]
  - Fichiers : `src/components/timing/TimingTable.tsx` (gérer le 409 renvoyé par l'API).
  - Fait quand : une assignation concurrente est rejetée proprement avec message clair et rafraîchissement.

- [x] **Intégrer les statuts d'équipage dans le chrono**
  - Fichiers : `src/components/timing/TimingTable.tsx`, `src/constants/crewStatus.ts`, `src/api/races.ts`.
  - Fait quand : les DNS/withdrawn sont exclus du décompte « tous arrivés » ; boutons rapides DNS/DNF/DSQ depuis l'écran de chrono.

- [x] **UI d'édition / suppression d'un temps**
  - Fichiers : `src/components/timing/TimingEditDialog.tsx`, `src/components/timing/TimingTable.tsx`.
  - Fait quand : correction du timestamp, suppression, recalcul visible, avec confirmation.

### P1 — Fonctionnalités chrono professionnelles

- [x] **Workflow « Top départ » (gun start) dédié**
  - Fichiers : `src/pages/event/TimingPage.tsx`, `src/api/races.ts`.
  - Fait quand : 1 action pose le départ commun, renseigne `Race.start_time` et passe la course en `in_progress`.

- [x] **Gestion du faux départ**
  - Fichiers : `src/pages/event/TimingPage.tsx`, `src/api/races.ts`.
  - Fait quand : possibilité d'annuler le départ, remettre la course en `not_started` et reprendre la séquence proprement.

- [x] **Gestion des ex-aequo (dead heat)**
  - Fichiers : `src/pages/event/ArbitresPage.tsx`, `src/utils/ranking.ts`.
  - Fait quand : deux temps identiques partagent la même place (règle FISA).

- [x] **Pénalités & bonifications** — [dépend API]
  - Sous-tâches :
    - [x] API : `adjustment_ms` + `adjustment_reason` sur `RaceCrew`, `PATCH /race-crews/:id/adjustment`
    - [x] UI arbitre pour saisir pénalité/bonification (`AdjustmentDialog`, `ArbitresPage`)
  - Fait quand : ajout/retrait de secondes reflété dans le temps final et le classement, avec motif.

- [x] **Vitesse & splits par segment**
  - Fichiers : `TimingTable.tsx`, API `segmentCalculator.js`.
  - Fait quand : affichage du temps par segment et de la vitesse (m/s, allure /500m) sur les points intermédiaires.

- [x] **Verrouillage des temps après validation officielle**
  - Fichiers : `ArbitresPage.tsx`, `TimingTable.tsx`, `TimingEditDialog.tsx` (+ API).
  - Fait quand : une course `official` est en lecture seule.

- [x] **Signature / traçabilité de la validation arbitre** — [dépend API]
  - Fichiers : `POST /races/:id/validate`, migration `017_add_race_validation_fields.sql`.
  - Fait quand : la validation enregistre qui a validé et quand et l'affiche.

- [x] **Traçabilité des prises de temps** — [dépend API]
  - Fichiers : `src/utils/deviceId.ts`, `TimingPage.tsx`, `useOfflineTimingQueue.ts`.
  - Fait quand : chaque impulsion web envoie un `device_id` stable ; l'API renseigne `entered_by`.

- [x] **Double chrono / réconciliation** — [dépend API]
  - Fichiers : `ReconciliationPanel.tsx`, `src/api/timings.ts`, API `timingReconciliationUtils.js`.
  - Fait quand : détection des impulsions proches multi-appareils + choix de la source à conserver.

- [x] **Mode contre-la-montre (time trial)**
  - Fichiers : `src/components/timing/TimeTrialPanel.tsx`, `src/utils/timeTrial.ts`, `src/pages/event/TimingPage.tsx`.
  - Fait quand : file d'attente des départs, compte à rebours, auto-sélection/avance et top départ au créneau.

- [x] **Supprimer/brancher `TimingControls`**
  - Composant obsolète supprimé (doublon de `TimingPage`).

### P2 — Robustesse & formats avancés

- [x] **File d'attente offline côté web**
  - Fichiers : `src/hooks/useOfflineTimingQueue.ts`, `src/pages/event/TimingPage.tsx`.
  - Fait quand : une coupure réseau met les impulsions en file (localStorage) + retry auto à la reconnexion, avec indicateur.

- [x] **Relais chronométrés**
  - Fichiers : `RelayLegBadge.tsx`, `raceDistance.ts`, `TimingPage.tsx`.
  - Fait quand : affichage du relais courant (leg/total) selon le point de chrono et la distance `is_relay`.

- [x] **Épreuves au temps (`is_time_based`)**
  - Fichiers : `TimeBasedCountdownPanel.tsx`, `TimingPage.tsx`.
  - Fait quand : compte à rebours visible sur l'écran de chrono pour les courses au temps.

- [x] **Import FinishLynx (photo-finish)**
  - Fichiers : `src/utils/finishLynxParser.js`, `src/services/finishLynxImportService.js`, `src/controllers/finishLynxController.js`, `src/pages/event/FinishLynxImportPage.tsx`, `src/api/finishLynx.ts`.
  - Endpoints : `POST /races/:id/finishlynx/preview`, `POST /races/:id/finishlynx/import`.
  - Fait quand : import `.lif` avec aperçu couloir→équipage, statuts DNS/DNF, remplacement optionnel des arrivées existantes.

---

## P1 — Sécurité front

- [ ] **Sécuriser le stockage des JWT**
  - Pourquoi : tokens en `localStorage` → vulnérables au XSS.
  - Fichiers : `src/lib/axios.ts`, `src/context/AuthContext.tsx`.
  - Fait quand : passage à un cookie `httpOnly` (nécessite coordination API) OU durcissement documenté + CSP.

- [ ] **Ne pas exposer `VITE_API_BEARER_TOKEN` dans le bundle**
  - Pourquoi : token statique injecté côté client s'il est défini → présent dans le build.
  - Fichiers : `src/lib/axios.ts`, `.env.example`.
  - Fait quand : plus aucun secret partagé côté client ; auth uniquement via session utilisateur.

- [x] **Protéger / retirer les pages debug en prod**
  - Fichiers : `SuperAdminRoute.tsx`, `TimingPage.tsx`, `router/index.tsx`.
  - Fait quand : WebSocketTest réservé superadmin ; DebugTimings accessible dev/superadmin uniquement.

- [x] **Spinner pendant l'auto-login**
  - Fichiers : `ProtectedRoute.tsx` (utilise `loading` de `AuthContext`).
  - Fait quand : état de chargement visible tant que l'auth est en cours.

- [ ] **Validation des formulaires (zod + react-hook-form)**
  - Pourquoi : `zod` et `react-hook-form` installés mais **jamais utilisés** ; validation actuelle en `useState` minimale.
  - Fichiers : formulaires auth (`AdminLogin`, `Register`, `ForgotPassword`, `ResetPasswordPage`), formulaires CRUD critiques.
  - Fait quand : les formulaires sensibles valident via schémas zod + messages d'erreur clairs.

---

## P1/P2 — Architecture & qualité de code

- [ ] **Couche API typée + types partagés**
  - Pourquoi : appels `api.get/post` directement dans les pages ; types `Crew`, `Race`, `Category`… redéfinis localement dans chaque page.
  - Fichiers : étendre `src/api/`, créer `src/types/`.
  - Fait quand : chaque domaine (events, crews, races, timings, indoor…) a un module API typé + types centralisés.

- [ ] **Activer TanStack Query (ou le retirer)**
  - Pourquoi : `@tanstack/react-query` installé mais **0 usage** ; ~50+ patterns `useEffect + api.get` sans cache/retry/invalidation.
  - Fichiers : `src/main.tsx` (QueryClientProvider), remplacement progressif dans les pages.
  - Fait quand : les listes/détails passent par React Query (cache + invalidation), OU la dépendance est retirée si non retenue.

- [ ] **Découper les fichiers monolithiques (> 1000 lignes)**
  - Pourquoi : maintenance impossible, logique + UI mélangées.
  - Cibles principales :
    - [ ] `src/pages/event/ExportPage.tsx` (~2579)
    - [ ] `src/pages/event/IndoorRaceDetailPage.tsx` (~2282)
    - [ ] `src/pages/event/GenerateRacesPage.tsx` (~2154)
    - [ ] `src/pages/event/CrewStatusManagementPage.tsx` (~2073)
    - [ ] `src/pages/event/ImportErgRaceResultsWithRacePage.tsx` (~1948)
    - [ ] `src/components/event/DistancesManager.tsx` (~1861)
    - [ ] `src/pages/event/RacePhaseDetailPage.tsx` (~1643)
    - [ ] `src/pages/crews/CrewWizardPage.tsx` (~1386)
    - [ ] `src/pages/event/EventStatisticsPage.tsx` (~1214)
    - [ ] `src/pages/dashboard/ClubRankingsPage.tsx` (~1140)
  - Fait quand : logique extraite en hooks/services, UI en sous-composants, fichiers < ~400 lignes.

- [ ] **Éradiquer les `any` (~400 occurrences)**
  - Pourquoi : `strict: true` mais `any` massif (AuthContext entièrement `any`, `useEventRole`, `useState<any>` partout).
  - Fichiers : `src/context/AuthContext.tsx`, `src/hooks/useEventRole.ts`, la majorité des pages.
  - Fait quand : `AuthContext` typé, plus de `any` implicite ni explicite non justifié.

- [ ] **Supprimer le code mort**
  - Pourquoi : fichiers jamais importés / dupliqués.
  - Cibles : `src/App.tsx` + `App.css` (template Vite), `src/pages/.../Login.tsx` (duplicata de `AdminLogin`), `Dashboard.tsx`, composants `src/components/dashboard/*` (app-sidebar, nav-*) et `src/components/ui/sidebar.tsx` s'ils restent inutilisés.
  - Fait quand : plus aucun module orphelin ; build inchangé.

- [ ] **Nettoyer les `console.log` (~55 fichiers)**
  - Pourquoi : bruit + fuite potentielle en prod.
  - Fichiers : notamment `AuthContext`, `DistancesManager`, `ExportPage`, `TimingTable`, `Live`, `Results`, `IndoorRaceDetailPage`, `CrewStatusManagementPage`.
  - Fait quand : logs de debug retirés ou passés derrière un logger conditionné à l'env.

- [ ] **Mettre en place des tests**
  - Pourquoi : **0 test** aujourd'hui.
  - Fichiers : config Vitest + `@testing-library/react`, tests prioritaires : auth/routing/imports critiques.
  - Fait quand : `npm run test` existe et couvre les flux critiques.

- [ ] **Réactiver `React.StrictMode`**
  - Pourquoi : désactivé en workaround Radix dans `main.tsx`.
  - Fichiers : `src/main.tsx`.
  - Fait quand : StrictMode réactivé sans régression visible.

---

## P1 — Refonte design (identité FFAviron)

> Objectif : sortir du look « généré par IA » (gradients bleu/violet, cards arrondies partout) pour une identité pro et sobre de fédération sportive.

- [x] **Définir le design system FFAviron**
  - Palette institutionnelle (bleu marine / rouge fédération), tokens dans `src/index.css`.
  - Fait quand : couleurs officielles appliquées globalement (primary, accent, sidebar).

- [x] **Composants layout unifiés (`AdminPage` + `StatCard`)**
  - Fichiers : `src/components/layout/AdminPage.tsx`, `StatCard.tsx`.
  - Fait quand : toutes les pages admin utilisent le même en-tête et les stats neutres.

- [x] **Supprimer les cards stats colorées génériques**
  - Fichiers : `CategoriesPage`, `RacePhasesPage`, dashboard, event pages…
  - Fait quand : cards neutres avec `StatCard` et tokens design system.

- [x] **Refondre `HomePage`**
  - Fichiers : `src/pages/HomePage.tsx`.
  - Fait quand : palette FFAviron navy/rouge, plus de style emerald/SaaS.

- [x] **Refondre le layout dashboard / sidebar**
  - `DashboardLayout`, `EventAdminLayout` : fond `bg-background`, nav active `bg-primary`.

- [x] **PageHeader / AdminPage sur toutes les pages admin**
  - Dashboard, event, races, chrono, imports, websocket — migration complète.

- [ ] **Supprimer les avatars ronds gradient** (restes ponctuels dans composants enfants)

- [ ] **États vides, skeletons, micro-animations**
  - Fichiers : composants de liste + `framer-motion` (à ajouter).
  - Fait quand : chargements avec skeletons, empty states soignés, transitions sobres.

---

## P2 — Fonctionnalités

- [ ] **Chat organisateurs**
  - Pourquoi : specs `PROPOSITION_CHAT_ORGANISATEURS.md`, `PROPOSITION_CHAT_SLACK_ONLY.md`, `ARCHITECTURE_CHAT_BDD.md` présentes mais **0 code**.
  - Fait quand : messagerie fonctionnelle (à cadrer avec l'API : BDD vs Slack).

- [ ] **UI de permissions par événement**
  - Pourquoi : doit refléter le RBAC backend une fois implémenté.
  - Fichiers : `src/pages/event/EventPermissionsPage.tsx`.
  - Fait quand : attribution des rôles (`organiser`, `editor`, `referee`, `timing`, `viewer`) claire et fonctionnelle.

- [x] **Tableau de bord temps réel amélioré**
  - Fichiers : `src/components/event/EventLiveDashboard.tsx` (intégré à `EventOverviewPage`).
  - Fait quand : suivi live des courses (en cours, à valider, prochains départs) via API + WebSocket.

- [ ] **Internationalisation (i18n)**
  - Fait quand : fr par défaut, structure prête pour une 2e langue.

---

## P3 — Nettoyage & confort

- [ ] Retirer les dépendances inutilisées : `sonner`, `pdfkit`, `shadcn-ui` (package atypique), et `react-query`/`react-hook-form`/`zod` si non retenus.
- [ ] Ajouter un script `format` (Prettier est présent sans script dédié).
- [ ] Activer `noUnusedLocals`/`noUnusedParameters` dans `tsconfig.app.json` pour détecter le code mort.
- [ ] Remplacer le TODO restant dans `IndoorRaceDetailPage.tsx` (« Remplacer par la route API appropriée »).
- [ ] Documenter le `README` (setup, scripts, variables d'env, conventions).
