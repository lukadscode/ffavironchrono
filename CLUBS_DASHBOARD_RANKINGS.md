# Dashboard classements clubs (`GET /rankings/clubs/dashboard`)

Documentation pour le front et les intégrations : **un seul appel** pour récupérer le **classement par compétition** (`byEvent`) et le **classement général** (`global`) selon le discipline (`indoor`, `mer`, `rivière`).

## Objectif

- Remplacer l’enchaînement `GET /events` + _N_ appels par type + recalcul du général côté navigateur.
- Centraliser barèmes, filtres et agrégations **côté API**.
- Exposer pour chaque club une **liste de contributions** (points + compétition / règle) lorsque c’est pertinent.

**Authentification :** Bearer (même middleware que les autres routes `/rankings/*`).

---

## Requête

```
GET /rankings/clubs/dashboard?type={indoor|mer|riviere}&season={...}&include_territorial_bonus={true|false}
```

### Paramètres query

| Paramètre                   | Obligatoire | Défaut                          | Description                                                                                                                                        |
| --------------------------- | ----------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                      | **Oui**     | —                               | `indoor`, `mer` ou `riviere`.                                                                                                                      |
| `season`                    | Non         | Année UTC courante (ex. `2026`) | **Mer :** année calendaire de la saison sportive (filtre sur `events.start_date`). **Indoor :** valeur du champ `events.season` (ex. `2025-2026`). |
| `include_territorial_bonus` | Non         | `true`                          | **Uniquement pour `type=mer`** : inclut les lignes actives de `endurance_mer_territorial_bonus` pour la saison.                                    |

### Erreurs

- **400** : `type` absent ou non reconnu (message : _Query obligatoire : type=indoor|mer|riviere_).
- **500** : erreur serveur (template indoor manquant, BDD, etc.).

---

## Enveloppe de réponse

```json
{
  "status": "success",
  "data": { ... },
  "meta": {
    "type": "mer",
    "season": "2026",
    "include_territorial_bonus": true
  }
}
```

Le contenu de `data` dépend de `type` (voir ci‑dessous).

---

## `type=mer`

### Règles métier (global)

Pour chaque club, le **total** est la somme de :

1. **4 meilleures** compétitions **ENDURO** de niveau **territorial** (points issus de l’import Excel mer par événement).
2. **1 meilleure** compétition **BRS** **territoriale**.
3. **Somme** de **toutes** les compétitions **Championnat de France** au format **ENDURO** (import `event_level=championnat_france`, `event_format=enduro`).
4. **Somme** de **toutes** les compétitions **Championnat de France** au format **BRS**.
5. **Bonus territorial mer** (table dédiée, saison), si `include_territorial_bonus=true`.

Les compétitions et formats sont déterminés par les métadonnées enregistrées sur les lignes d’import (`endurance_mer_import_results` : `event_level`, `event_format`).

### Structure `data`

| Champ             | Type    | Description                                                                               |
| ----------------- | ------- | ----------------------------------------------------------------------------------------- |
| `type`            | `"mer"` |                                                                                           |
| `season`          | string  | Saison demandée.                                                                          |
| `rules_summary`   | object  | Textes explicatifs des blocs (enduro territorial, BRS territorial, CF enduro/BRS, bonus). |
| `byEvent`         | array   | Une entrée par événement ayant au moins un import mer dans la fenêtre de saison.          |
| `global.rankings` | array   | Classement général clubs.                                                                 |

#### Élément de `byEvent`

```json
{
  "event": {
    "id": "uuid",
    "name": "...",
    "location": "...",
    "start_date": "...",
    "end_date": "...",
    "race_type": "..."
  },
  "rankings": [
    {
      "club_code": "C029028",
      "club_name": "...",
      "total_points": 123.45,
      "rank": 1
    }
  ]
}
```

`rankings` : même logique que `GET /events/:eventId/endurance-mer/ranking` (agrégation par club sur l’événement).

#### Élément de `global.rankings`

| Champ                      | Description                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rank`                     | Rang général.                                                                                                                                                                                                                                                                                                                                             |
| `club_code`, `club_name`   | Identifiants club.                                                                                                                                                                                                                                                                                                                                        |
| `total_points`             | Total saison (arrondi 2 décimales).                                                                                                                                                                                                                                                                                                                       |
| `breakdown`                | `enduro_top4`, `brs_top1`, `championnat_france_enduro`, `championnat_france_brs`, `championnat_france` (= enduro + brs CF), `territorial_bonus`.                                                                                                                                                                                                          |
| `contributions`            | Liste ordonnée des **lignes qui alimentent le total** : chaque objet a un `kind` (`enduro_territorial`, `brs_territorial`, `championnat_france_enduro`, `championnat_france_brs`, `territorial_bonus`), une `rule` (clé lisible), et pour les compétitions : `event_id`, `event_name`, `start_date`, `points` ; pour le top 4 / top 1 : `selection_rank`. |
| `other_enduro_territorial` | Compétitions enduro territoriales **non** retenues dans le top 4 (audit / affichage).                                                                                                                                                                                                                                                                     |
| `other_brs_territorial`    | Compétitions BRS territoriales **non** retenues dans le top 1.                                                                                                                                                                                                                                                                                            |

### Exemple d’appel

```http
GET /rankings/clubs/dashboard?type=mer&season=2026&include_territorial_bonus=true
Authorization: Bearer <token>
```

---

## `type=indoor`

### Règles métier (global)

Identiques à `GET /rankings/indoor/season/:season` :

- **Meilleur** meeting « standard » (barème _Points Indoor_) sur la saison ;
- **Somme** des points sur les événements `indoor_ranking_scope = championnat_france_indoor` ;
- **Somme des N meilleurs** scores « défis capitaux » (N depuis le template BDD).

### Structure `data`

| Champ                     | Type           | Description                                                                            |
| ------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| `type`                    | `"indoor"`     |                                                                                        |
| `season`                  | string         | Repris du calcul indoor.                                                               |
| `rules_summary`           | object         | Idem route indoor saison.                                                              |
| `defis_capitaux_template` | object \| null | Métadonnées template défis (id, nom, nombre comptabilisé).                             |
| `byEvent`                 | array          | Événements avec `events.season` = `season`, ayant au moins un classement club calculé. |
| `global.rankings`         | array          | Même base que la route indoor, avec en plus **`contributions`** par club.              |

#### `contributions` (indoor)

Chaque club peut avoir des entrées de type :

- `meeting_standard_max` — meilleur meeting, avec `event_id`, `event_name`, `points` ;
- `championnat_france_indoor` — points agrégés CF indoor (pas encore ventilés course par course dans cette version) ;
- `defis_capitaux` — points agrégés défis, avec `defis_events_rencontres` et la règle `top_N_meilleurs_defis_saison`.

### Exemple d’appel

```http
GET /rankings/clubs/dashboard?type=indoor&season=2025-2026
Authorization: Bearer <token>
```

**Prérequis indoor :** champs `season` et `indoor_ranking_scope` sur les événements ; migration `012_add_event_season_indoor_ranking_scope.sql` ; template _Points Indoor_ en base.

---

## `type=riviere`

Placeholder : **`byEvent`** et **`global.rankings`** sont vides ; **`rules_summary.note`** indique que l’agrégation rivière n’est pas implémentée (en attente barème et source de données).

```http
GET /rankings/clubs/dashboard?type=riviere&season=2026
Authorization: Bearer <token>
```

---

## Liens avec les autres routes

| Besoin                                  | Route existante                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global mer seul (liste plate)           | `GET /events/endurance-mer/global-ranking?season=...` — la réponse inclut désormais aussi `breakdown` détaillé CF + `contributions` (même moteur que le dashboard). |
| Classement mer d’un événement           | `GET /events/:eventId/endurance-mer/ranking`                                                                                                                        |
| Indoor saison seul                      | `GET /rankings/indoor/season/:season`                                                                                                                               |
| Indoor par type d’événement (race_type) | `GET /rankings/clubs/by-type/:event_type`                                                                                                                           |

---

## OpenAPI

Chemin documenté dans `src/docs/ranking.yaml` : `/rankings/clubs/dashboard`.

---

## Évolutions possibles (hors périmètre actuel)

- Indoor : ventiler `championnat_france_indoor` et `defis_capitaux` **par événement** dans `contributions` (comme pour le mer).
- Rivière : implémentation quand le modèle de données et le règlement sont figés.
