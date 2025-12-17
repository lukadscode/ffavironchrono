## Spécification application mobile de chronométrage (Expo / React Native)

### 1. Objectif & contexte

Cette spécification décrit une application **mobile** (Expo / React Native) pour le **chronométrage à distance** d’événements gérés par `ffavironchrono`.

- **Un appareil = un timing point**
  - À l’ouverture, l’utilisateur saisit un **code de timing point**.
  - L’app est alors liée à ce timing point (jusqu’à déconnexion).
- **Chronométrage simple mais complet**
  - Deux modes de saisie :
    - **Mode direct** : temps pris et immédiatement affecté à un équipage (dossard/couloir).
    - **Mode brut** : impulsions “temps bruts” (sans équipage), affectation des équipages après coup.
  - Affichage clair de l’horloge serveur, de l’état réseau, des temps pris, et du statut de synchronisation.
- **Intégration forte avec l’API existante**
  - Réutilisation maximale des routes déjà présentes (`/timings`, `/races`, `/timing-points`, `/timing-assignments`, `/server-time`, etc.).
  - Calcul des temps relatifs côté serveur (cf. `API_SPECIFICATION_TIMING_RELATIVE_TIMES.md`).
- **Persistance sur l’appareil**
  - **AsyncStorage** pour la session et les préférences.
  - **SQLite** pour l’historique des passages (durée configurable, par défaut 30 jours).

---

## 2. Architecture générale

### 2.1 Pile technique front mobile

- **Framework** : React Native + Expo.
- **Navigation** : React Navigation (Stack + Tabs).
- **Etat serveur** : TanStack Query (React Query).
- **Persistance légère** : AsyncStorage.
- **Persistance lourde** : SQLite (via `expo-sqlite` ou équivalent).
- **Réseau** : Axios (client configuré pour `VITE_API_URL` du backend).
- **WebSocket** : socket.io-client (même API que la web app).

### 2.2 Structure de projet (proposition)

- `App.tsx`
- `src/`
  - `navigation/`
    - `RootNavigator.tsx`
    - `MainTabsNavigator.tsx`
  - `screens/`
    - `auth/TimingPointCodeScreen.tsx`
    - `dashboard/DashboardScreen.tsx`
    - `races/RacesListScreen.tsx`
    - `races/RaceDetailScreen.tsx`
    - `timing/TimingScreen.tsx`
    - `timing/BrutAssignmentScreen.tsx`
    - `sync/SyncScreen.tsx`
    - `settings/SettingsScreen.tsx`
  - `components/`
    - `TimingClock.tsx`
    - `PassageList.tsx`
    - `BigActionButton.tsx`
    - `ConnectionStatusBadge.tsx`
    - `RaceCard.tsx`
    - `NumericInput.tsx`
  - `context/`
    - `TimingContext.tsx` (session timing point, offset, course sélectionnée, file d’attente offline)
  - `hooks/`
    - `useServerTime.ts`
    - `useNetworkStatus.ts`
    - `useOfflineQueue.ts`
  - `services/`
    - `apiClient.ts`
    - `timingService.ts`
    - `storageService.ts`
    - `socketService.ts`
  - `theme/`
    - `colors.ts`
    - `spacing.ts`
    - `typography.ts`

---

## 3. Navigation & routes (mobile)

### 3.1 Stack & tabs

- **`RootStack`**
  - `Auth/TimingPointCodeScreen`
  - `MainTabs`

- **`MainTabs`**
  - `DashboardScreen`
  - `RacesListScreen`
  - `TimingScreen` (contexte course + timing point)
  - `SyncScreen`
  - `SettingsScreen`

### 3.2 Détail des écrans

- **`Auth/TimingPointCodeScreen`**
  - Route : `Auth/TimingPointCode`
  - Rôle : saisie du **token/code du timing point** (le `token` généré dans `TimingPointsPage`) + initialisation du contexte mobile.
  - Actions :
    - Saisie du token (`TextInput`).
    - Bouton “Se connecter”.
  - API :
    - **NOUVEL endpoint “résolution de token”** : voir §4.1 (ce n’est **pas** un vrai login utilisateur, juste une résolution `token → timing_point + event`).
  - Stockage :
    - AsyncStorage : `timingPointSession` (`{ token, timing_point_id, event_id, label, order_index, distance_m, device_id }`).

- **`DashboardScreen`**
  - Route : `Main/Dashboard`
  - Rôle :
    - Résumé du contexte :
      - Timing point actif (nom, distance, rôle départ/intermédiaire/arrivée).
      - Event courant (`event_id`).
      - Etat réseau (online/offline).
      - Offset horaire (`serverTimeOffset`).
      - Nombre de passages en attente de synchro locale.
    - Actions rapides :
      - “Voir les courses”.
      - “Aller au chronomètre”.
      - “Synchroniser l’heure”.

- **`RacesListScreen`**
  - Route : `Main/RacesList`
  - Rôle :
    - Afficher toutes les courses de l’événement liées à ce timing point (en pratique : toutes les courses de l’event, filtrées au besoin par statut).
  - API :
    - **GET** `/races/event/:eventId`.

- **`RaceDetailScreen`**
  - Route : `Main/RaceDetail/:raceId`
  - Rôle :
    - Présenter les détails de la course :
      - Nom, numéro, catégorie, distance, statut (`not_started`, `in_progress`, `non_official`, `official`).
      - Liste des **RaceCrews** (couloirs, clubs).
    - Action principale :
      - Bouton “Commencer le chronométrage” ⇒ `TimingScreen` avec `raceId`.
  - API :
    - Option 1 : réutiliser la réponse de `/races/event/:eventId` (déjà chargée).
    - Option 2 : **GET** `/races/:raceId` si besoin de détails supplémentaires.

- **`TimingScreen`**
  - Route : `Main/Timing/:raceId`
  - Rôle : **écran central de prise de temps** pour une course donnée et le timing point lié à l’appareil.
  - UI (3 zones) :
    - Zone haute :
      - Nom de la course + label du timing point.
      - Badges “Départ / Intermédiaire / Arrivée”.
      - Horloge serveur (HH:MM:SS.mmm) très lisible (composant `TimingClock`).
      - Indicateurs : `Online / Offline`, `Offset: +XX ms`.
    - Zone milieu :
      - Toggle deux modes :
        - **Mode direct (dossard + temps)**.
        - **Mode brut (temps brut + affectation ultérieure)**.
    - Zone basse :
      - Liste des **derniers passages** (temps + équipage si affecté + statut de synchro locale).

- **`BrutAssignmentScreen`** (ou modal dans `TimingScreen`)
  - Rôle :
    - Liste des temps bruts non affectés (synchro locale).
    - Pour chaque temps :
      - Sélection d’un équipage (par couloir / dossard).
      - Validation d’affectation.
  - API :
    - Même endpoints que pour l’affectation dans la web app (`/timing-assignments`, `/timings/:id`).

- **`SyncScreen`**
  - Route : `Main/Sync`
  - Rôle :
    - Bouton “Synchroniser l’heure”.
    - Affichage :
      - heure serveur actuelle,
      - heure locale,
      - offset calculé,
      - latence (facultatif : différence round-trip approximative).
  - API :
    - **GET** `/server-time`.

- **`SettingsScreen`**
  - Route : `Main/Settings`
  - Rôle :
    - Changement de thème (clair/sombre).
    - Informations :
      - version app,
      - `device_id`,
      - `timing_point_id`, `event_id`.
    - Bouton “Changer de timing point” (efface la session et renvoie sur `Auth/TimingPointCode`).

---

## 4. Correspondance avec l’API existante

Les routes ici sont celles déjà utilisées par la web app `ffavironchrono`, à l’exception d’un **nouveau endpoint** pour le login par code.

### 4.1 Résolution du token de timing point (nouveau, pas un “login” utilisateur)

Dans l’interface web `TimingPointsPage`, chaque timing point possède déjà un champ `token` :

```52:59:src/pages/event/TimingPointsPage.tsx
type TimingPoint = {
  id: string;
  event_id: string;
  label: string;
  order_index: number;
  distance_m: number;
  token: string;
};
```

Ce `token` est ce que tu veux que la personne **entre dans l’app mobile**.  
Il ne sert pas à authentifier un utilisateur, mais simplement à :

- retrouver le `timing_point` côté backend,
- en déduire `event_id` (et donc les courses accessibles),
- **donner accès uniquement aux opérations de timing** pour ce timing point (pas aux écrans d’admin).

**Nouveau endpoint à ajouter côté backend :**

- Exemple : **POST** `/public/timing-points/resolve-token`
  - (chemin exact à ta convenance, l’important est la sémantique “public/resolve”, pas “login”).

**Body (proposition) :**

```json
{
  "token": "TP-XYZ-001",
  "device_id": "uuid-mobile-1"
}
```

**Réponse (proposition) :**

```json
{
  "status": "success",
  "data": {
    "timing_point_id": "tp-uuid",
    "event_id": "event-uuid",
    "label": "Arrivée 2000m",
    "order_index": 3,
    "distance_m": 2000,
    "token": "TP-XYZ-001"
  }
}
```

**Notes :**

- `device_id` est un identifiant généré côté mobile (UUID) et conservé en AsyncStorage.
- Ce endpoint **ne crée pas de session utilisateur** :
  - il joue juste le rôle de “résolution du token” et de contrôle d’accès : on autorise ensuite ce device à appeler les routes de timing **pour cet event et ce timing point précis**.
- C’est la seule extension nécessaire pour connecter un mobile par **token** sans passer par les écrans admin web.

### 4.2 Récupération des courses pour un event

- **GET** `/races/event/:eventId`
  - Déjà utilisé dans `TimingPage` web.

```275:295:src/pages/event/TimingPage.tsx
const fetchRaces = async () => {
  const res = await api.get(`/races/event/${eventId}`);
  const mapped = res.data.data.map((race: any) => ({
    ...race,
    RaceCrews: (race.race_crews || []).map((rc: any) => ({
      id: rc.id,
      lane: rc.lane,
      Crew: rc.crew
        ? {
            id: rc.crew.id,
            club_name: rc.crew.club_name,
          }
        : null,
    })),
  }));
};
```

**Mobile :**

- Appelé après login pour remplir `RacesListScreen`.

### 4.3 Récupération des timing points pour un event

- **GET** `/timing-points/event/:eventId`

```257:265:src/pages/event/TimingPage.tsx
const fetchTimingPoints = async () => {
  const res = await api.get(`/timing-points/event/${eventId}`);
  const sorted = res.data.data.sort(
    (a: TimingPoint, b: TimingPoint) => a.order_index - b.order_index
  );
  setTimingPoints(sorted);
  const current = sorted.find((tp: TimingPoint) => tp.id === timingPointId);
  setCurrentTimingPoint(current || null);
};
```

**Mobile :**

- Optionnel : écran d’infos sur tous les timing points.
- Utile pour vérifier que le `timing_point_id` de la session existe bien et pour connaître `order_index` et `distance_m`.

### 4.4 Synchronisation horaire

- **GET** `/server-time`

```360:366:src/pages/event/TimingPage.tsx
const syncServerTime = async () => {
  const res = await api.get("/server-time");
  const serverTime = new Date(res.data.server_time).getTime();
  const localTime = Date.now();
  setServerTimeOffset(serverTime - localTime);
};
```

**Mobile :**

- Appelé :
  - au démarrage de l’app,
  - à l’ouverture de `SyncScreen`,
  - éventuellement toutes les X minutes.
- On stocke `offset_ms = serverTime - Date.now()` en mémoire + AsyncStorage.

### 4.5 Enregistrement d’un timing

- **POST** `/timings`

Actuel (web) :

```375:383:src/pages/event/TimingPage.tsx
const handleManualTiming = async () => {
  const timestamp = new Date(Date.now() + serverTimeOffset).toISOString();
  const res = await api.post("/timings", {
    timing_point_id: timingPointId,
    timestamp,
    manual_entry: true,
    status: "pending",
  });
};
```

**Mobile – même principe :**

- Mode brut (sans équipage) :

```json
{
  "timing_point_id": "tp-uuid",
  "timestamp": "2025-12-17T14:23:12.345Z",
  "manual_entry": true,
  "status": "pending"
}
```

- Mode direct (dossard) :
  - Option recommandée (cohérente avec webs) :
    1. `POST /timings` comme ci-dessus.
    2. Récupérer `timing.id` pour faire un `POST /timing-assignments` (cf. 4.7).

### 4.6 Lecture des timings d’une course

- **GET** `/timings/race/:raceId`

```342:349:src/pages/event/TimingPage.tsx
const res = await api.get(`/timings/race/${selectedRaceId}`);
const allTimings = res.data.data || [];
const filtered = allTimings.filter(
  (t: any) => t.timing_point_id === timingPointId
);
setTimings(filtered);
```

**Mobile :**

- Même filtrage par `timing_point_id`.
- Affiche :
  - `timestamp` (heure absolue),
  - `relative_time_ms` (temps relatif, déjà calculé par le backend selon `API_SPECIFICATION_TIMING_RELATIVE_TIMES.md`),
  - `status` (`pending`, `assigned`, `hidden`).

### 4.7 Affectation des timings aux équipages

**Endpoints existants :**

- **GET** `/timing-assignments/race/:raceId`
- **POST** `/timing-assignments`
- **DELETE** `/timing-assignments/:id`
- **PUT** `/timings/:id` (pour changer `status`)

Exemples actuels (web) :

```221:233:src/components/timing/TimingTable.tsx
const res = await api.post("/timing-assignments", {
  timing_id: nextTiming.id,
  crew_id: raceCrew.Crew.id,
});

await api.put(`/timings/${nextTiming.id}`, { status: "assigned" });
```

**Mobile – Mode direct :**

1. L’utilisateur choisit un équipage (ex: couloir 3).
2. L’app crée d’abord un timing (voir 4.5).
3. Avec l’`id` du timing retourné :
   - `POST /timing-assignments` :

```json
{
  "timing_id": "timing-uuid",
  "crew_id": "crew-uuid"
}
```

4. Puis `PUT /timings/:id` avec `{ "status": "assigned" }`.

**Mobile – Mode brut :**

1. L’utilisateur tape sur “Prendre un temps brut” (sans équipage).
2. L’app :
   - Crée un `Timing` avec `status: "pending"` (POST `/timings`) OU stocke d’abord uniquement localement et repousse la création serveur après affectation (au choix).
3. Plus tard, dans `BrutAssignmentScreen` :
   - L’utilisateur sélectionne un dossard/équipage pour ce temps.
   - L’app :
     - Si le `Timing` n’a pas encore été créé sur le serveur :
       - `POST /timings` (avec le timestamp originairement pris).
     - Ensuite :
       - `POST /timing-assignments` + `PUT /timings/:id` (`status: "assigned"`).

### 4.8 Gestion des statuts de course (départ / arrivée)

Actuellement gérée côté web dans `TimingTable` :

```71:81:src/components/timing/TimingTable.tsx
// Départ
const res = await api.get(`/races/${selectedRaceId}`);
if (currentRace.status === "not_started") {
  await api.put(`/races/${selectedRaceId}`, { status: "in_progress" });
}
```

```142:147:src/components/timing/TimingTable.tsx
// Arrivée
if (finishedCrews.size === totalCrews && currentRace.status === "in_progress") {
  await api.put(`/races/${selectedRaceId}`, { status: "non_official" });
}
```

**Mobile (optionnel) :**

- Reprendre la même logique :
  - Sur la première affectation d’un timing au timing point de départ :
    - passer la course de `not_started` à `in_progress`.
  - Quand tous les équipages ont un temps assigné au timing point d’arrivée :
    - passer la course en `non_official`.
- API :
  - **GET** `/races/:raceId`
  - **PUT** `/races/:raceId`

### 4.9 WebSocket

`src/lib/socket.ts` et `TimingPage` montrent les évènements WebSocket existants :

```5:10:src/lib/socket.ts
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3010";
socket = io(API_URL);
```

Évènements :

```140:181:src/pages/event/TimingPage.tsx
socket.emit("watchTimingPoint", { timing_point_id: timingPointId });
socket.on("timingPointViewerCount", ({ timing_point_id, count }) => { ... });
socket.emit("unwatchTimingPoint", { timing_point_id: timingPointId });

socket.emit("joinRoom", { event_id: eventId, race_id: selectedRaceId });
socket.on("timingImpulse", (data: Timing) => { ... });
socket.on("timingAssigned", ({ timing_id, crew_id }) => { ... });
socket.emit("leaveRoom", { event_id: eventId, race_id: selectedRaceId });
```

**Mobile :**

- Peut se connecter au même WebSocket pour :
  - afficher le compteur de postes connectés à ce timing point (`timingPointViewerCount`),
  - recevoir les `timingImpulse` venant d’autres appareils,
  - réagir à `timingAssigned`.

---

## 5. Persistance locale (AsyncStorage + SQLite)

### 5.1 AsyncStorage

Clés proposées :

- `timingPointSession` :
  - `{ code, timing_point_id, event_id, label, order_index, distance_m, device_id }`.
- `serverTimeOffset` :
  - `number` en ms (offset avec l’horloge serveur).
- `lastSelectedRaceId` :
  - permet d’ouvrir directement la dernière course utilisée.
- `userPreferences` :
  - thème, langue, options d’UI.

### 5.2 SQLite – Table `passages`

Utilisée pour **tout conserver localement** même en cas de coupure réseau, de redémarrage téléphone, etc.

Schéma proposé :

```sql
CREATE TABLE passages (
  id_local TEXT PRIMARY KEY,
  race_id TEXT NOT NULL,
  timing_point_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  crew_id TEXT NULL,           -- null = temps brut non affecté
  timestamp TEXT NOT NULL,     -- ISO (utilisé pour POST /timings)
  mode TEXT NOT NULL,          -- 'direct' | 'brut'
  synced INTEGER NOT NULL,     -- 0 = pas encore synchronisé, 1 = synchro OK
  remote_timing_id TEXT NULL,  -- id du timing côté serveur
  created_at INTEGER NOT NULL  -- Date.now()
);
```

Logique :

- À chaque prise de temps (clic sur un bouton) :
  - Insérer une ligne dans `passages` avec `synced = 0`.
  - Tenter immédiatement :
    - `POST /timings`.
    - En cas de succès :
      - mettre `remote_timing_id` et `synced = 1`.
    - En cas d’échec réseau :
      - laisser `synced = 0` pour un retry auto.
- Processus de retry (`useOfflineQueue`) :
  - Sur retour en ligne ou toutes les X secondes :
    - lire les lignes où `synced = 0`.
    - tenter `POST /timings` (et ensuite les affectations éventuelles).

### 5.3 Durée de conservation

- Politique recommandée :
  - Conserver tous les passages **synchros** pendant 30 jours.
  - Tâche de nettoyage (au lancement ou à heure fixe) :

```sql
DELETE FROM passages
WHERE synced = 1 AND created_at < (Date.now() - 30 jours);
```

- Les passages non synchros (`synced = 0`) **ne sont jamais supprimés** automatiquement.

---

## 6. UX / UI de chronométrage

### 6.1 Horloge & statut

- Composant `TimingClock` :
  - Utilise `serverTimeOffset` pour afficher l’heure serveur.
  - Rafraîchissement toutes les 50 ms (comme dans `TimingPage` web).
  - Style moderne, police mono, gros chiffres.

- Composant `ConnectionStatusBadge` :
  - Indique :
    - `Online` (vert) ou `Offline` (rouge/orange),
    - Nombre de passages en attente (`pending local`),
    - Optionnel : mini-icône si WebSocket connecté.

### 6.2 Mode direct (dossard + temps)

- Présentation par **liste d’équipages** (comme dans le tableau web) :
  - Chaque entrée : “Couloir X – Club Nom”.
  - Bouton “Passage” pour chaque ligne.
- Alternative : champ numérique `dossard` en haut + bouton “Valider passage”.

Flow :

1. L’utilisateur identifie l’équipage (visuellement).
2. Clic sur “Passage” ou saisie de dossard + clic.
3. L’app :
   - calcule le timestamp serveur (`Date.now() + offset`),
   - crée un enregistrement SQLite (ligne dans `passages`),
   - tente `POST /timings` puis `POST /timing-assignments` puis `PUT /timings/:id` (`assigned`),
   - affiche le résultat dans la liste des derniers passages.

### 6.3 Mode brut (temps sans dossard)

- Gros bouton central **“Prendre un temps brut”**.
- Chaque clic :
  - génère un enregistrement SQLite `mode = 'brut'`, `crew_id = NULL`.
  - si online : `POST /timings` (sans `crew_id`), `status: "pending"`.
- En bas de l’écran :
  - Liste des temps bruts non affectés (heure + éventuel id local).
- Pour affecter :
  - Soit un tap sur un temps brut ouvre un sélecteur d’équipage.
  - Soit un écran `BrutAssignmentScreen` liste tous les temps bruts avec un champ de sélection d’équipage par ligne.

Une fois affecté :

1. Si besoin, créer le `Timing` serveur (si pas déjà créé).
2. `POST /timing-assignments`.
3. `PUT /timings/:id` avec `status: "assigned"`.

### 6.4 Feedback utilisateur

- Vibration légère à chaque enregistrement de temps.
- Toaster type :
  - “Temps enregistré – Couloir 3 – 14:23:12.345”.
- Codes couleur :
  - Vert = temps + assignation OK.
  - Orange = temps en attente de synchro serveur.
  - Rouge = erreur (API, réseau).

---

## 7. Synthèse des endpoints utilisés

- **Nouveau** :
  - `POST /public/timing-points/resolve-token`
- **Existants (déjà utilisés par la web app)** :
  - `GET /events/:eventId`
  - `GET /races/event/:eventId`
  - `GET /races/:raceId`
  - `PUT /races/:raceId`
  - `GET /timing-points/event/:eventId`
  - `GET /timings/race/:raceId`
  - `POST /timings`
  - `PUT /timings/:id`
  - `GET /timing-assignments/race/:raceId`
  - `POST /timing-assignments`
  - `DELETE /timing-assignments/:id`
  - `GET /server-time`
  - WebSocket :
    - `watchTimingPoint` / `unwatchTimingPoint`
    - `joinRoom` / `leaveRoom`
    - Events : `timingImpulse`, `timingAssigned`, `timingPointViewerCount`, `assignTiming`

---

## 8. Étapes de mise en œuvre (roadmap)

1. **Backend**
   - Ajouter `POST /timing-points/login-by-code`.
   - (Optionnel) accepter `device_id` dans `POST /timings` pour traçabilité.
2. **Projet Expo**
   - Créer projet Expo + navigation de base (`RootStack`, `MainTabs`).
   - Implémenter `apiClient` et `socketService` calqués sur `src/lib/axios.ts` et `src/lib/socket.ts`.
3. **Auth mobile**
   - Écran `TimingPointCodeScreen`.
   - Intégration `login-by-code` + stockage AsyncStorage.
4. **Chargement Event / Races**
   - Écrans `RacesListScreen` + `RaceDetailScreen`.
   - API `/races/event/:eventId` et `/races/:raceId`.
5. **TimingScreen – prise de temps + horloge**
   - Intégrer `/server-time`, `/timings`, `/timings/race/:raceId`.
   - Implementer les 2 modes (direct + brut).
6. **Affectation des temps**
   - Écran/modal d’affectation (`BrutAssignmentScreen`).
   - API `/timing-assignments`, `PUT /timings/:id`.
7. **Offline + SQLite**
   - Création de la table `passages`.
   - Gestion de la file d’attente et du retry automatique.
   - Nettoyage après N jours.
8. **Finitions UI**
   - Thème moderne (clair + sombre).
   - Animation légère, feedback haptique, messages d’erreur clairs.

Ce fichier sert de **référence centrale** pour implémenter l’application mobile en restant parfaitement aligné avec ton backend `ffavironchrono` actuel.


