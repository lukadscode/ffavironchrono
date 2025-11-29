# 📋 Modification API : Inclusion des splits_data dans l'endpoint public `/indoor-results/race/:raceId`

## 🎯 Objectif

L'endpoint public `/indoor-results/race/:raceId` doit inclure les données de splits (`splits_data`) pour chaque participant dans la réponse, afin que les pages publiques (`/public/event/:eventId/results` et `/public/event/:eventId/live`) puissent afficher les temps intermédiaires et les graphiques de splits.

## 📍 Endpoint concerné

**GET** `/indoor-results/race/:raceId`

**Accessibilité** : Public (accessible sans authentification pour les courses avec statut `"non_official"` ou `"official"`)

## 📦 Structure de réponse attendue

La réponse doit inclure `splits_data` dans chaque participant :

```json
{
  "data": {
    "id": "uuid-du-resultat",
    "race_id": "uuid-de-la-course",
    "participants": [
      {
        "id": "uuid-participant",
        "place": 1,
        "time_display": "3:45.123",
        "time_ms": 225123,
        "distance": 1000,
        "avg_pace": "1:52.5",
        "spm": 28,
        "calories": 45,
        "crew_id": "uuid-equipage",
        "crew": {
          "id": "uuid-equipage",
          "club_name": "Club Aviron",
          "club_code": "CLUB01",
          "category": {
            "id": "uuid-categorie",
            "code": "M1X",
            "label": "M1X"
          }
        },
        "splits_data": [
          {
            "split_distance": 250,
            "split_time": "625",
            "split_avg_pace": "2:05.0",
            "split_stroke_rate": 26
          },
          {
            "split_distance": 500,
            "split_time": "1250",
            "split_avg_pace": "2:05.0",
            "split_stroke_rate": 27
          },
          {
            "split_distance": 750,
            "split_time": "1875",
            "split_avg_pace": "2:05.0",
            "split_stroke_rate": 28
          },
          {
            "split_distance": 1000,
            "split_time": "2500",
            "split_avg_pace": "2:05.0",
            "split_stroke_rate": 29
          }
        ]
      }
    ]
  }
}
```

## 🔑 Champs `splits_data` requis

Chaque élément de `splits_data` doit contenir :

- **`split_distance`** (number, optionnel) : Distance du split en mètres (ex: 250, 500, 750, 1000)
- **`split_time`** (string ou number) : Temps du split en centièmes de seconde (ex: "625" = 62.5 secondes = 1:02.5)
- **`split_avg_pace`** (string, optionnel) : Allure moyenne du split (ex: "2:05.0")
- **`split_stroke_rate`** (number, optionnel) : Cadence du split en SPM (ex: 26, 27, 28)

### Format de `split_time`

Le champ `split_time` peut être :
- Un **string** représentant les centièmes de seconde (ex: "625" pour 62.5 secondes)
- Un **number** représentant les centièmes de seconde (ex: 625 pour 62.5 secondes)

Le frontend convertit automatiquement en format `M:SS.X` (ex: 625 → 1:02.5).

## ⚠️ Notes importantes

1. **Si un participant n'a pas de splits** : Le champ `splits_data` peut être :
   - `null`
   - `undefined`
   - Un tableau vide `[]`

2. **Cohérence avec l'endpoint authentifié** : L'endpoint authentifié `/indoor-results/race/:raceId` doit renvoyer la même structure avec `splits_data` inclus.

3. **Performance** : Les splits_data peuvent être volumineux. Assurez-vous que l'endpoint public peut gérer cette charge.

## 🧪 Test

Pour vérifier que les splits_data sont bien inclus :

```bash
# Test avec curl (remplacer RACE_ID par un ID réel)
curl -X GET "https://api-timing.ffaviron.fr/indoor-results/race/RACE_ID" \
  -H "Content-Type: application/json"

# Vérifier que la réponse contient splits_data pour au moins un participant
```

## 📝 Exemple de réponse complète

```json
{
  "data": {
    "id": "result-uuid",
    "race_id": "race-uuid",
    "participants": [
      {
        "id": "participant-1",
        "place": 1,
        "time_display": "3:45.123",
        "time_ms": 225123,
        "distance": 1000,
        "avg_pace": "1:52.5",
        "spm": 28,
        "calories": 45,
        "crew_id": "crew-uuid",
        "crew": {
          "id": "crew-uuid",
          "club_name": "Club Aviron",
          "club_code": "CLUB01"
        },
        "splits_data": [
          {
            "split_distance": 250,
            "split_time": "625",
            "split_avg_pace": "2:05.0",
            "split_stroke_rate": 26
          },
          {
            "split_distance": 500,
            "split_time": "1250",
            "split_avg_pace": "2:05.0",
            "split_stroke_rate": 27
          }
        ]
      },
      {
        "id": "participant-2",
        "place": 2,
        "time_display": "3:50.456",
        "time_ms": 230456,
        "distance": 1000,
        "avg_pace": "1:55.2",
        "spm": 27,
        "calories": 42,
        "crew_id": "crew-uuid-2",
        "crew": {
          "id": "crew-uuid-2",
          "club_name": "Autre Club",
          "club_code": "CLUB02"
        },
        "splits_data": null
      }
    ]
  }
}
```

## ✅ Checklist

- [ ] L'endpoint public `/indoor-results/race/:raceId` inclut `splits_data` dans chaque participant
- [ ] Les splits_data sont au format attendu (split_time en centièmes de seconde)
- [ ] Les participants sans splits ont `splits_data: null` ou `[]`
- [ ] L'endpoint authentifié inclut également `splits_data` (cohérence)
- [ ] Les tests passent avec des données réelles

