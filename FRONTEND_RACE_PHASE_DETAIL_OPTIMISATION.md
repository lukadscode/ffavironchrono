## Optimisation de `RacePhaseDetailPage` – Endpoints agrégés

Cette documentation explique comment **réduire drastiquement le nombre d’appels API** et le travail au rendu
sur la page de détail de phase (`RacePhaseDetailPage`) en utilisant les nouveaux endpoints agrégés.

Objectifs :

- Passer de **centaines** de requêtes (1 par course, 1 par équipage…) à **1–2** appels.
- Charger en une fois : courses d’une phase + équipages + participants.
- Préparer le terrain pour la **virtualisation** et l’affichage condensé, surtout en mode **time trial**.

---

## 1. Problème actuel (à éviter)

Sur une grosse phase (50–100 courses, 200+ équipages), le front faisait typiquement :

- `GET /races/event/:eventId`
- Pour chaque course : `GET /race-crews/:raceId`
- `GET /crews/event/:eventId`
- Pour chaque équipage : `GET /crews/:id`

Conséquences :

- Plusieurs **centaines de requêtes**.
- Beaucoup de travail de jointure/merging côté front.
- Rendus React lourds (beaucoup de données à manipuler à chaque changement).

---

## 2. Nouveaux endpoints agrégés à utiliser

### 2.1. Courses d’une phase **avec** équipages et participants

Endpoint :

```text
GET /race-phases/:phaseId/races-with-crews
```

Usage :

- Récupère **toutes les courses** de la phase, avec :
  - la course (`Race`) : `id`, `name`, `race_type`, `race_number`, `start_time`, `lane_count`, `distance`, …
  - les `race_crews` : `id`, `lane`, `status`, …
  - pour chaque `race_crews`, l’`equipage` (`crew`) :
    - `id`, `club_name`, `club_code`, `temps_pronostique`, `category`, …
    - `crew_participants` + `participant` (détail rameurs).

Réponse type (simplifiée) :

```json
{
  "status": "success",
  "data": [
    {
      "id": "race-1",
      "name": "TT – J16H1x – #1",
      "race_type": "time_trial",
      "race_number": 12,
      "start_time": "2026-03-09T08:00:00.000Z",
      "lane_count": 1,
      "distance": {
        "id": "distance-uuid",
        "meters": 1000
      },
      "race_crews": [
        {
          "id": "rc-1",
          "lane": 1,
          "status": null,
          "crew": {
            "id": "crew-1",
            "club_name": "Club Aviron",
            "club_code": "ABC",
            "temps_pronostique": 123456,
            "category": {
              "id": "cat-1",
              "code": "J16H1x",
              "label": "J16 Homme 1x"
            },
            "crew_participants": [
              {
                "id": "cp-1",
                "participant": {
                  "id": "p-1",
                  "first_name": "Jean",
                  "last_name": "Dupont",
                  "license_number": "123456",
                  "gender": "M",
                  "club_name": "Club Aviron"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### 2.2. Équipages d’un événement **avec** participants

Endpoint (existe déjà) :

```text
GET /crews/event/:eventId/with-participants
```

Usage :

- Vue globale de **tous les équipages de l’événement** avec :
  - `category`,
  - `crew_participants` + `participant`,
  - pagination et recherche (`search`, `page`, `pageSize`).

Sur `RacePhaseDetailPage`, tu peux :

- soit n’utiliser que `GET /race-phases/:phaseId/races-with-crews` (souvent suffisant),
- soit combiner avec `/crews/event/:eventId/with-participants` pour des écrans plus globaux (ex : liste latérale d’équipages non assignés).

---

## 3. Nouveau flux recommandé pour `RacePhaseDetailPage`

### 3.1. Ancien flux (à remplacer)

- `GET /races/event/:eventId`
- `GET /race-crews/:raceId` pour chaque course.
- `GET /crews/event/:eventId`
- `GET /crews/:id` pour chaque équipage (pour avoir les participants).

### 3.2. Nouveau flux

- 1 appel principal :

```text
GET /race-phases/:phaseId/races-with-crews
```

- Optionnel : 1 appel complémentaire (vue plus globale) :

```text
GET /crews/event/:eventId/with-participants
```

Tu peux ensuite :

- Construire la **timeline** uniquement à partir de `data` de `races-with-crews`.
- Calculer les équipages non assignés en comparant l’ensemble des `crews` de l’événement avec ceux présents dans `race_crews`.

---

## 4. Exemple de code front (React + TypeScript)

Supposons que tu aies :

- `phaseId` : ID de la phase sélectionnée.
- `eventId` : ID de l’événement (pour d’autres écrans si besoin).
- un client HTTP type `axios`.

### 4.1. Hook de chargement agrégé pour la phase

```ts
import { useEffect, useState } from "react";
import axios from "axios";

interface Participant {
  id: string;
  first_name: string;
  last_name: string;
  license_number?: string | null;
  gender?: string | null;
  club_name?: string | null;
}

interface CrewParticipant {
  id: string;
  participant: Participant;
}

interface Category {
  id: string;
  code: string;
  label: string;
  age_group?: string;
  gender?: string;
}

interface Crew {
  id: string;
  club_name: string;
  club_code: string;
  temps_pronostique?: number | null;
  category?: Category | null;
  crew_participants: CrewParticipant[];
}

interface RaceCrew {
  id: string;
  lane: number | null;
  status?: string | null;
  crew: Crew | null;
}

interface Distance {
  id: string;
  meters?: number;
  is_time_based?: boolean;
  duration_seconds?: number;
}

interface RaceWithCrews {
  id: string;
  name: string | null;
  race_type: string | null;
  race_number: number | null;
  start_time: string | null;
  lane_count: number | null;
  distance: Distance | null;
  race_crews: RaceCrew[];
}

interface UsePhaseRacesResult {
  loading: boolean;
  error: string | null;
  races: RaceWithCrews[];
}

export function usePhaseRacesWithCrews(phaseId: string | null): UsePhaseRacesResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [races, setRaces] = useState<RaceWithCrews[]>([]);

  useEffect(() => {
    if (!phaseId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    axios
      .get<{ status: string; data: RaceWithCrews[] }>(`/race-phases/${phaseId}/races-with-crews`)
      .then((res) => {
        if (cancelled) return;
        setRaces(res.data.data || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || "Erreur lors du chargement des courses");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [phaseId]);

  return { loading, error, races };
}
```

### 4.2. Utilisation dans `RacePhaseDetailPage`

Exemple d’intégration très simplifiée :

```tsx
function RacePhaseDetailPage({ phaseId }: { phaseId: string }) {
  const { loading, error, races } = usePhaseRacesWithCrews(phaseId);

  if (loading) return <div>Chargement des courses…</div>;
  if (error) return <div>Erreur : {error}</div>;

  return (
    <div>
      {races.map((race) => (
        <div key={race.id} className="race-card">
          <div className="race-header">
            <span>{race.race_number}</span>
            <span>{race.name}</span>
            <span>{race.race_type}</span>
            <span>{race.start_time}</span>
          </div>

          <div className="race-crews">
            {race.race_crews.map((rc) => (
              <div key={rc.id} className="race-crew-row">
                <span>Lane {rc.lane}</span>
                {rc.crew && (
                  <>
                    <span>{rc.crew.club_name}</span>
                    <span>{rc.crew.category?.code}</span>
                    <span>
                      {rc.crew.temps_pronostique != null
                        ? `${rc.crew.temps_pronostique} ms (pronostic)`
                        : "—"}
                    </span>
                    {/* Participants en mode “détail” seulement si besoin */}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

Dans la version réelle de la page, tu pourras :

- **virtualiser** la liste de `races` (par ex. `react-window`) pour ne rendre que les courses visibles,
- utiliser un affichage **condensé** (surtout en `time_trial`) et n’afficher les participants détaillés
  que dans un panneau latéral ou un accordéon au clic.

---

## 5. Synthèse pour l’équipe front

- **À faire maintenant** :
  - Remplacer le pattern :
    - `GET /races/event/:eventId` + `GET /race-crews/:raceId` + `GET /crews/:id`
  - par :
    - `GET /race-phases/:phaseId/races-with-crews`
    - (optionnel) `GET /crews/event/:eventId/with-participants` pour d’autres écrans.

- **Ensuite** :
  - Utiliser ce payload unique comme source de vérité pour la timeline.
  - Ajouter la virtualisation et l’affichage condensé pour les grosses phases / time trial.

Avec ce changement, la page `RacePhaseDetailPage` passe d’un profil “beaucoup d’IO + beaucoup de JS”
à un profil “peu d’IO, logique claire, data déjà agrégée”, ce qui devrait régler la plupart des lenteurs
et lags observés sur les gros événements. 

