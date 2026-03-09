## Génération de courses – Parcours contre la montre (time trial)

Cette documentation décrit l’endpoint backend dédié à la génération de courses en **mode parcours contre la montre**.

L’objectif est de générer **une course (ou créneau) par équipage**, avec des heures de départ décalées dans le temps à partir d’une heure de départ initiale et d’un **intervalle en secondes**.

---

### Endpoint

```text
POST /races/generate-time-trial
```

**Authentification** : Bearer Token (`Authorization: Bearer <token>`)

---

### Body (JSON)

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

- **phase_id** (`string`, **requis**)  
  ID de la phase pour laquelle générer les courses.

- **start_time** (`string`, **requis**)  
  Heure de départ de la première course, au format ISO 8601 (`date-time`).  
  Exemple : `"2026-03-09T08:00:00.000Z"`.

- **interval_seconds** (`integer`, **requis**, `>= 1`)  
  Intervalle en **secondes** entre deux départs successifs.  
  Exemple : `75` = 1 minute 15 secondes.

- **categories** (`array`, **requis**, min. 1 élément)  
  Liste ordonnée des catégories à traiter.  
  Chaque élément est un objet :

  ```json
  {
    "category_id": "uuid-cat-1",
    "order": 1
  }
  ```

  - **category_id** (`string`, **requis**) : ID de la catégorie.
  - **order** (`integer`, **requis**, `>= 1`) : ordre de passage de la catégorie  
    (1 = première catégorie, 2 = deuxième, etc.).

---

### Règles de génération

- Les catégories sont parcourues dans l’**ordre croissant de `order`**.
- Pour chaque catégorie :
  - On récupère tous les équipages de l’événement pour cette catégorie.
  - On exclut les équipages **déjà assignés** à des courses de la même phase.
  - On trie les équipages par **temps pronostique** (`temps_pronostique`) lorsque disponible :
    - équipages avec temps pronostique en premier (du plus rapide au plus lent) ;
    - puis équipages sans temps pronostique.
- On construit une liste globale d’équipages `E = [e0, e1, e2, ...]` dans cet ordre.
- Pour chaque équipage `ei` (indice global `i`), on crée **une course** :

  - `race.start_time = start_time + i * interval_seconds`
  - `race.race_type = "time_trial"`
  - `race.lane_count = 1`
  - `race.distance_id = distance_id de la catégorie` (ou `null` si la catégorie n’a pas de distance)
  - `RaceCrew` unique avec `lane = 1`

- Le nom de la course suit le format :

  ```text
  "TT – [CODE_CATEGORIE] – #[index]"
  ```

  Exemple : `TT – J16H1x – #3`.

- Le **numéro de course** (`race_number`) est choisi comme suit :
  - on récupère le `race_number` maximum déjà existant dans la phase (si présent) ;
  - les nouvelles courses utilisent les numéros suivants (`max + 1`, `max + 2`, …) ;
  - si aucune course n’existe, la première course sera `race_number = 1`.

---

### Comportement vis-à-vis des courses existantes

- L’endpoint **ne supprime pas** les courses existantes.
- Les équipages **déjà assignés** à des courses de la même phase sont **exclus** de la génération time trial.
- Cela permet :
  - de compléter une phase avec des départs contre la montre en plus de courses déjà créées ;
  - de relancer la génération sans dupliquer des équipages déjà affectés.

Si tu veux repartir de zéro pour une phase donnée, il reste possible de supprimer les courses de cette phase via les outils existants (backend ou front) avant d’appeler cet endpoint.

---

### Réponse – Succès

**Status code** : `200 OK`

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
      },
      {
        "id": "race-uuid-2",
        "race_number": 6,
        "name": "TT – J16H1x – #2",
        "start_time": "2026-03-09T08:01:15.000Z",
        "distance_id": "distance-uuid-1000m",
        "crews_count": 1
      }
    ]
  }
}
```

#### Champs principaux

- **status** : `"success"` en cas de succès.
- **message** : message lisible indiquant combien de courses ont été générées.
- **data.races_created** : nombre de courses créées.
- **data.crews_assigned** : nombre total d’équipages assignés (en time trial, = `races_created`).
- **data.races** : liste des courses créées :
  - **id** : ID de la course.
  - **race_number** : numéro de la course dans la phase.
  - **name** : nom de la course (`TT – [CODE] – #[index]`).
  - **start_time** : heure de départ (ISO 8601).
  - **distance_id** : ID de la distance (ou `null`).
  - **crews_count** : toujours `1` dans la version actuelle.

---

### Réponses d’erreur

#### 400 – Erreurs de validation

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

Exemples de cas :

- `phase_id` inexistant ou invalide.
- `categories` vide ou non conforme.
- `category_id` qui ne correspond à aucune catégorie.
- aucune catégorie n’a d’équipage disponible pour l’événement.

#### 404 – Phase introuvable

```json
{
  "status": "error",
  "message": "Phase introuvable"
}
```

#### 500 – Erreur serveur

```json
{
  "status": "error",
  "message": "Message d'erreur détaillé"
}
```

---

### Notes / Évolution possible

- Le paramètre `interval_seconds` permet déjà une grande flexibilité (combinaisons minutes + secondes).
- Si besoin, on pourra ajouter plus tard des options comme :
  - `max_crews_per_start` pour grouper plusieurs bateaux sur un même créneau time trial ;
  - un mode de tri alternatif (tirage aléatoire, par numéro, par classement, etc.).

Pour le moment, le comportement par défaut est **un équipage par course** avec des départs espacés régulièrement, parfaitement adapté à un parcours contre la montre classique.

