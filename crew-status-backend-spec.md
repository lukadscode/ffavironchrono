## Spécification API backend pour optimiser la page de gestion des statuts d’équipages

Contexte : la page de gestion des statuts d’équipages (`/event/:eventId/crew-status` et la vue publique correspondante, par ex. [`https://timing.ffaviron.fr/event/c20b2e99-5c91-41ea-b2ca-f063bf8ed639/crew-status`](https://timing.ffaviron.fr/event/c20b2e99-5c91-41ea-b2ca-f063bf8ed639/crew-status)) est très lente lorsqu’il y a beaucoup d’équipages et de participants.  
Actuellement, le front fait :

- `GET /crews/event/:eventId`
- puis **un `GET /crews/:id` par équipage** pour récupérer les participants (pattern N+1).

Objectif : fournir des endpoints backend permettant :

- de **supprimer le N+1** et de récupérer les équipages + participants en une seule requête filtrable/paginée ;
- de préparer une **recherche en plusieurs phases** : participants → équipages → actions.

---

## 1. Endpoint liste d’équipages avec participants + recherche côté serveur

### Objectif

Remplacer le pattern actuel :

- `GET /crews/event/:eventId`
- puis, pour chaque équipage, `GET /crews/:id` pour charger les participants.

Par **un seul endpoint** qui renvoie directement les équipages avec leurs participants, avec filtrage et pagination côté serveur.

### Proposition d’API

- **Route**

  - `GET /crews/event/:eventId/with-participants`

- **Query params**

  - `search` *(optionnel, string)* :
    - utilisé pour filtrer sur :
      - `club_name`
      - `club_code`
      - catégorie (`category.code`, `category.label`)
      - noms/prénoms/licence des participants (`crew_participants[].participant.{first_name,last_name,license_number}`)
  - `page` *(optionnel, défaut 1)*
  - `pageSize` *(optionnel, défaut 50 ou 100, avec une limite maxi raisonnable, ex. 200)*

- **Format de réponse (suggestion)**

```json
{
  "data": [
    {
      "id": "crew-id",
      "club_name": "Club de Test",
      "club_code": "ABC",
      "status": "registered",
      "category": {
        "id": "cat-id",
        "code": "J18H2x",
        "label": "Juniors 18 Hommes 2x"
      },
      "crew_participants": [
        {
          "id": "crew-participant-id",
          "seat_position": 1,
          "is_coxswain": false,
          "participant": {
            "id": "participant-id",
            "first_name": "Jean",
            "last_name": "Dupont",
            "license_number": "123456"
          }
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 237
  }
}
```

### Contraintes / attentes côté front

- Tous les équipages renvoyés doivent avoir `crew_participants` déjà peuplé avec un objet `participant` complet (pas besoin de re‑fetch par id).
- La recherche doit être **case-insensitive** et tolérante aux espaces.
- Le tri par défaut peut être fait :
  - soit côté backend (par exemple `status` puis `club_name`),
  - soit laissé au front ; l’important est la **performance** et la **stabilité du format**.

---

## 2. Endpoints pour recherche multi‑phases (participants → équipages)

Pour une recherche plus efficace quand il y a énormément de données, le front veut pouvoir :

1. Rechercher un **participant** dans l’événement.
2. Voir uniquement les **équipages auxquels ce participant appartient**.
3. Appliquer ensuite les actions déjà existantes (DNS, DNF, forfait, changement d’équipage, changement de catégorie, etc.).

### 2.1. Recherche de participants d’un événement

- **Route**

  - `GET /participants/event/:eventId`

- **Query params**

  - `search` *(optionnel, string)* :
    - filtrage au moins sur :
      - `first_name`
      - `last_name`
      - `license_number`
      - `club_name`
  - `page`, `pageSize` *(comme pour les équipages)*

- **Réponse attendue (format normalisé souhaité)**

```json
{
  "data": [
    {
      "id": "participant-id",
      "first_name": "Jean",
      "last_name": "Dupont",
      "license_number": "123456",
      "club_name": "Club de Test",
      "gender": "Homme"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 1234
  }
}
```

> Remarque : aujourd’hui, le front gère plusieurs formats possibles (`data`, `participants`, etc.). Pour ces endpoints, il serait idéal de **stabiliser** le format ci‑dessus.

### 2.2. Récupération des équipages d’un participant

Pour la phase “Afficher les équipages de ce participant”, on propose :

- **Option A (préférée)**

  - Route : `GET /participants/:participantId/crews`

- **Option B**

  - Route : `GET /crews` avec un query param `participantId` (ou `participant_id`)

- **Réponse attendue**

Même structure que pour `GET /crews/event/:eventId/with-participants`, mais limitée aux équipages qui contiennent ce participant.  
Exemple :

```json
{
  "data": [
    {
      "id": "crew-id",
      "club_name": "Club de Test",
      "status": "registered",
      "category": {
        "id": "cat-id",
        "code": "J18H2x",
        "label": "Juniors 18 Hommes 2x"
      },
      "crew_participants": [
        {
          "id": "crew-participant-id",
          "seat_position": 1,
          "is_coxswain": false,
          "participant": {
            "id": "participant-id",
            "first_name": "Jean",
            "last_name": "Dupont",
            "license_number": "123456"
          }
        }
      ]
    }
  ]
}
```

---

## 3. Optimisations backend attendues

### 3.1. Éviter le N+1

- Les endpoints `with-participants` et `participants/:id/crews` doivent charger les données via **jointure** (eager loading) et non par boucle de requêtes individuelles.
- Exemple d’agrégations à charger ensemble :
  - `crews` + `category`
  - `crews` + `crew_participants` + `participants`

### 3.2. Indexation / performance

Prévoir (ou vérifier) les index suivants pour garder de bonnes performances :

- Sur les équipages :
  - `crews.event_id`
  - `crews.club_name`
  - `crews.club_code`
  - `crews.status`
  - éventuellement `crews.category_id`
- Sur les catégories :
  - `categories.code`
  - `categories.label`
- Sur les participants :
  - `participants.first_name`
  - `participants.last_name`
  - `participants.license_number`
  - `participants.club_name`

Si la volumétrie est très grande, envisager un **full‑text index** sur les champs de recherche principaux (nom, prénom, club).

---

## 4. Contraintes de compatibilité front

- Les statuts d’équipages attendus par le front sont ceux de `CrewStatus` :

  - `registered`
  - `dns`
  - `dnf`
  - `disqualified`
  - `changed`
  - `withdrawn`

- Pour les nouveaux endpoints, l’idéal est d’uniformiser les champs :

  - `crew_participants` pour la liste des participants d’équipage,
  - chaque entrée de `crew_participants` contient une propriété `participant` (et non plusieurs variantes comme `CrewParticipants`, `crewParticipants`, etc.).

- En cas d’erreur, le front s’attend à trouver un message lisible dans :

  - `response.data.message`

afin de pouvoir l’afficher dans les toasts.

---

## 5. Résumé pour l’équipe backend

1. Ajouter `GET /crews/event/:eventId/with-participants` avec :
   - filtrage par `search`,
   - pagination (`page`, `pageSize`),
   - données agrégées : équipage + catégorie + participants.
2. Normaliser et stabiliser `GET /participants/event/:eventId` avec :
   - filtrage par `search`,
   - pagination,
   - format `data + pagination`.
3. Ajouter un endpoint pour récupérer les équipages d’un participant :
   - idéalement `GET /participants/:participantId/crews` (ou à défaut `GET /crews?participantId=...`),
   - même structure de données que l’endpoint `with-participants`.
4. Optimiser les requêtes (eager loading) et les index pour supporter les gros volumes de données.

