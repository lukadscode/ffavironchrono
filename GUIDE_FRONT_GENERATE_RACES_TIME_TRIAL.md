## Guide Front – Génération de courses en mode Parcours contre la montre

Ce guide explique comment utiliser le nouveau mode **« Parcours contre la montre »** depuis le front
pour générer des courses via l’endpoint `POST /races/generate-time-trial`.

L’idée générale :

- Mode **« course en ligne »** : comportement actuel (séries, lignes d’eau, plusieurs bateaux par course).
- Mode **« parcours contre la montre »** : une course (créneau) par équipage, départs décalés selon
  un intervalle en **secondes**.

---

### 1. Sélecteur de mode sur la page de génération

Sur la page de génération (ex : `GenerateRacesPage`), ajouter un état :

```ts
const [raceMode, setRaceMode] = useState<"line" | "time_trial">("line");
```

UI possible :

- **Radio buttons** ou un `Select` avec :
  - `Course en ligne` (valeur `"line"`) – mode actuel,
  - `Parcours contre la montre` (valeur `"time_trial"`).

Comportement recommandé :

- Si `raceMode === "line"` : garder toute l’interface actuelle (séries, lignes d’eau, DnD, etc.)
  et continuer à appeler `POST /races/generate-from-series` (ou `/races/generate`).
- Si `raceMode === "time_trial"` : afficher une UI simplifiée décrite ci‑dessous.

---

### 2. UI pour le mode « parcours contre la montre »

Lorsque `raceMode === "time_trial"` :

- **Choix de la phase** : réutiliser le composant/selector déjà utilisé pour la génération actuelle.
- **Heure de départ** de la première course :
  - champ `datetime-local` déjà présent si tu as un champ `start_time`,
  - côté front, convertir en ISO 8601 (ex : `new Date(value).toISOString()`).
- **Intervalle entre départs** :

  ```ts
  const [intervalMinutes, setIntervalMinutes] = useState(1);
  const [intervalSeconds, setIntervalSeconds] = useState(0);

  const intervalInSeconds = intervalMinutes * 60 + intervalSeconds;
  ```

  - autoriser les minutes **et** les secondes (ex : 1 min 15 s).
  - côté backend, on envoie **uniquement** `interval_seconds`.

- **Ordre des catégories** :
  - afficher une liste de catégories sélectionnées pour l’événement / la phase,
  - utilisable en drag & drop (par exemple réutiliser `SortableCategoryItem`),
  - **pas de notion de lignes d’eau ni de séries** ici, juste un ordre global.

- **Bouton** `Générer les départs (time trial)` :
  - déclenche l’appel à `POST /races/generate-time-trial`.

---

### 3. Appel API `POST /races/generate-time-trial`

Endpoint :

```text
POST /races/generate-time-trial
```

Body attendu :

```json
{
  "phase_id": "uuid-phase",
  "start_time": "2026-03-09T08:00:00.000Z",
  "interval_seconds": 75,
  "categories": [
    { "category_id": "uuid-cat-1", "order": 1 },
    { "category_id": "uuid-cat-2", "order": 2 }
  ]
}
```

#### Construction du payload côté front

À partir de :

- `selectedPhaseId` (phase choisie),
- `startTime` (valeur du champ `datetime-local`),
- `intervalMinutes`, `intervalSeconds`,
- la liste ordonnée des catégories (drag & drop), par ex. un tableau `orderedCategories`
  contenant des objets `{ id, code, label, ... }`.

Exemple TypeScript :

```ts
interface TimeTrialCategoryConfig {
  category_id: string;
  order: number;
}

async function generateTimeTrialRaces(params: {
  phaseId: string;
  startTimeLocal: string; // valeur du <input type="datetime-local">
  intervalMinutes: number;
  intervalSeconds: number;
  orderedCategories: { id: string }[];
  token: string;
}) {
  const { phaseId, startTimeLocal, intervalMinutes, intervalSeconds, orderedCategories, token } =
    params;

  const startDate = new Date(startTimeLocal);

  const body = {
    phase_id: phaseId,
    start_time: startDate.toISOString(),
    interval_seconds: intervalMinutes * 60 + intervalSeconds,
    categories: orderedCategories.map((cat, index) => ({
      category_id: cat.id,
      order: index + 1,
    })),
  };

  const response = await axios.post("/races/generate-time-trial", body, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
}
```

---

### 4. Comportement attendu côté backend (rappel)

Résumé (détaillé dans `docs/GENERATE_RACES_TIME_TRIAL.md`) :

- Les catégories sont traitées dans l’ordre croissant de `order`.
- Pour chaque catégorie :
  - on récupère tous les équipages de l’événement,
  - on exclut ceux déjà assignés à une course de la phase,
  - on trie par temps pronostique (`temps_pronostique`) si disponible.
- On construit une liste globale d’équipages `E = [e0, e1, e2, ...]`.
- Pour chaque équipage `ei` (indice global `i`), le backend crée **une course** avec :
  - `start_time = start_time_initial + i * interval_seconds`,
  - `race_type = "time_trial"`,
  - `lane_count = 1`,
  - `distance_id` = distance de la catégorie (ou `null`),
  - 1 seul `RaceCrew` avec `lane = 1`.
- Le nom de la course est de la forme : `TT – [code_catégorie] – #[index]`.

Les courses existantes de la phase ne sont **pas supprimées**, et les équipages déjà affectés
à d’autres courses de la phase sont **exclus** de la génération time trial.

---

### 5. Gestion des réponses et erreurs côté front

#### Succès

Réponse type :

```json
{
  "status": "success",
  "message": "32 courses contre la montre générées avec succès",
  "data": {
    "races_created": 32,
    "crews_assigned": 32,
    "races": [
      {
        "id": "race-uuid-1",
        "race_number": 5,
        "name": "TT – J16H1x – #1",
        "start_time": "2026-03-09T08:00:00.000Z",
        "distance_id": "distance-uuid-1000m",
        "crews_count": 1
      }
    ]
  }
}
```

Recommandations UI :

- Afficher un toast / message de succès avec `data.races_created`.
- Optionnel : rafraîchir la liste des courses de la phase après génération.

#### Erreurs de validation (400)

```json
{
  "status": "error",
  "message": "Erreurs de validation",
  "errors": [
    "Catégorie introuvable pour category_id=\"uuid-invalide\"",
    "La catégorie \"J16H1x\" n'a aucun équipage disponible pour cet événement"
  ]
}
```

Comportement recommandé :

- Si `errors` est présent : afficher la liste dans un composant type `Alert` multi-lignes.
- Exemple d’affichage :
  - `• Catégorie introuvable pour category_id="..."`,
  - `• La catégorie "J16H1x" n'a aucun équipage disponible pour cet événement`.

#### Phase introuvable (404) / Erreur serveur (500)

Même pattern que pour les autres routes : afficher un message d’erreur générique, avec éventuellement
le `message` renvoyé par l’API si tu souhaites le surface côté admin.

---

### 6. Intégration avec la page existante

Proposition d’organisation dans `GenerateRacesPage` :

- **Haut de page** :
  - Sélecteur de phase,
  - Sélecteur de mode (`Course en ligne` / `Parcours contre la montre`).

- **Bloc central** :
  - Si `raceMode === "line"` : UI existante (séries, lignes d’eau, etc.).
  - Si `raceMode === "time_trial"` :
    - champs `start_time`, `intervalMinutes`, `intervalSeconds`,
    - liste ordonnable des catégories,
    - bouton `Générer les départs (time trial)` relié à `POST /races/generate-time-trial`.

- **Bas de page** :
  - Résumé / feedback (nombre de courses créées, erreurs éventuelles, etc.).

En résumé : le mode **time trial** se greffe proprement sur la page actuelle, en partageant la sélection
de phase et les catégories, tout en gardant une logique d’appel API distincte et très simple côté front.

