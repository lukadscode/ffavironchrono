# Documentation : Import de Course ErgRace

## Vue d'ensemble

Cette fonctionnalité permet d'importer une course qui a été créée dans ErgRace mais qui n'a pas été créée via le site web. L'utilisateur peut importer un fichier `.rac2` (format ErgRace) et configurer la course avec les bonnes informations (distance, catégorie, équipages).

## Fonctionnalités Frontend

### Composant : `ImportErgRaceRaceDialog`

Le composant se trouve dans `src/components/races/ImportErgRaceRaceDialog.tsx` et est intégré dans la page `IndoorPage.tsx`.

#### Étapes du processus d'import

1. **Upload du fichier** :
   - L'utilisateur sélectionne un fichier `.rac2` ou `.json`
   - Le fichier est parsé pour extraire les informations de la course
   - Détection automatique de la distance et de la catégorie si possible

2. **Configuration de la course** :
   - Nom de la course (pré-rempli depuis le fichier)
   - Numéro de course
   - Heure de départ (optionnel)
   - Phase (requis)
   - Distance (requis) - sélection depuis les distances disponibles de l'événement
   - Catégorie (requis) - sélection depuis les catégories disponibles de l'événement

3. **Mapping des équipages** :
   - Pour chaque équipage dans le fichier `.rac2`, l'utilisateur doit l'associer à un équipage existant dans le système
   - Recherche d'équipages par nom, club, ou catégorie
   - Auto-matching basique basé sur les noms des participants

#### Structure du fichier .rac2

Le fichier `.rac2` est un fichier JSON avec la structure suivante :

```json
{
  "race_definition": {
    "name_long": "Nom long de la course",
    "name_short": "Nom court",
    "race_id": "ID de la course ErgRace",
    "duration": 2000,
    "duration_type": "meters" | "time",
    "race_type": "individual" | "team" | "relay",
    "boats": [
      {
        "id": "boat-id",
        "lane_number": 1,
        "name": "Nom de l'équipage",
        "class_name": "Catégorie ErgRace",
        "affiliation": "Code club",
        "participants": [
          {
            "id": "participant-id",
            "name": "NOM, Prénom"
          }
        ]
      }
    ]
  }
}
```

## Besoins API Backend

### Endpoints existants utilisés

Les endpoints suivants sont déjà utilisés et doivent être disponibles :

1. **GET `/distances/event/:eventId`**
   - Récupère toutes les distances disponibles pour un événement
   - Réponse attendue : `{ data: Distance[] }`

2. **GET `/categories/event/:eventId/with-crews`**
   - Récupère toutes les catégories disponibles pour un événement avec le nombre d'équipages
   - Réponse attendue : `{ data: Category[] }`

3. **GET `/race-phases/:eventId`**
   - Récupère toutes les phases de course pour un événement
   - Réponse attendue : `{ data: Phase[] }`

4. **GET `/crews/event/:eventId`**
   - Récupère tous les équipages disponibles pour un événement
   - Réponse attendue : `{ data: Crew[] }`
   - Chaque équipage doit inclure :
     - `id`, `club_code`, `club_name`
     - `category` (avec `id`, `code`, `label`)
   - **Note actuelle** : Le frontend enrichit chaque équipage avec un appel supplémentaire à `GET /crews/:crewId` pour récupérer les `crew_participants`
   - **Amélioration recommandée** : Retourner directement les `crew_participants` dans la réponse de `/crews/event/:eventId` pour éviter N requêtes supplémentaires (où N = nombre d'équipages)

5. **POST `/races`**
   - Crée une nouvelle course
   - Payload attendu :
     ```json
     {
       "phase_id": "string",
       "name": "string",
       "race_number": number,
       "start_time": "string (ISO 8601, optionnel)",
       "distance_id": "string",
       "lane_count": number,
       "race_type": "string"
     }
     ```
   - **Note** : `event_id` n'est pas nécessaire car il peut être déduit depuis `phase_id`
   - Réponse attendue : `{ data: { id: string, ... } }` ou `{ id: string, ... }`

6. **POST `/race-crews`**
   - Crée une association entre une course et un équipage
   - Payload attendu :
     ```json
     {
       "race_id": "string",
       "crew_id": "string",
       "lane": number
     }
     ```
   - Réponse attendue : `{ data: { id: string, ... } }` ou `{ id: string, ... }`

### Validation et règles métier

Le backend doit valider :

1. **Création de la course** :
   - Le `phase_id` doit exister et appartenir à l'événement
   - Le `distance_id` doit exister et appartenir à l'événement
   - Le `race_number` doit être unique dans la phase (ou géré automatiquement)
   - Le `lane_count` doit être cohérent avec le nombre d'équipages

2. **Création des race-crews** :
   - Le `race_id` doit exister
   - Le `crew_id` doit exister et appartenir à l'événement
   - Le `lane` doit être unique dans la course (ou géré automatiquement)
   - L'équipage doit être dans le statut "registered" pour être assigné

3. **Cohérence des données** :
   - Tous les équipages assignés doivent avoir la même catégorie que celle sélectionnée (ou validation souple)
   - Tous les équipages assignés doivent avoir la même distance que celle sélectionnée (ou validation souple)

### Améliorations possibles (optionnel)

1. **Optimisation de `/crews/event/:eventId`** :
   - **Problème actuel** : Le frontend doit faire N requêtes supplémentaires (`GET /crews/:crewId`) pour récupérer les participants de chaque équipage
   - **Solution** : Modifier l'endpoint pour retourner directement les `crew_participants` dans la réponse
   - **Bénéfice** : Réduction drastique du nombre de requêtes (de N+1 à 1 seule requête)
   - **Format suggéré** :
     ```json
     {
       "data": [
         {
           "id": "string",
           "club_code": "string",
           "club_name": "string",
           "category": { "id": "string", "code": "string", "label": "string" },
           "crew_participants": [
             {
               "seat_position": number,
               "participant": {
                 "id": "string",
                 "first_name": "string",
                 "last_name": "string"
               }
             }
           ]
         }
       ]
     }
     ```

2. **Endpoint bulk pour race-crews** :
   - Créer un endpoint `POST /race-crews/bulk` pour créer plusieurs race-crews en une seule requête
   - Payload :
     ```json
     {
       "race_id": "string",
       "race_crews": [
         { "crew_id": "string", "lane": number },
         ...
       ]
     }
     ```
   - Cela améliorerait les performances lors de l'import de courses avec beaucoup d'équipages

3. **Auto-matching amélioré** :
   - Endpoint `POST /crews/match` pour trouver automatiquement les équipages correspondants
   - Payload :
     ```json
     {
       "participants": [
         { "first_name": "string", "last_name": "string" },
         ...
       ],
       "category_id": "string (optionnel)",
       "club_code": "string (optionnel)"
     }
     ```
   - Réponse : Liste des équipages correspondants avec un score de correspondance

## Flux d'utilisation

1. L'utilisateur clique sur "Importer une course ErgRace" dans la page Indoor
2. Il sélectionne un fichier `.rac2`
3. Le système parse le fichier et pré-remplit les champs
4. L'utilisateur configure la course (nom, distance, catégorie, phase)
5. L'utilisateur mappe chaque équipage du fichier avec un équipage existant
6. L'utilisateur valide l'import
7. Le système crée la course et les associations race-crews
8. La course apparaît dans la liste des courses

## Gestion des erreurs

Le frontend gère les erreurs suivantes :

- Fichier invalide ou format incorrect
- Champs requis manquants
- Équipages non mappés
- Erreurs API (affichées via toast)

Le backend doit retourner des messages d'erreur clairs pour :
- Validation des données
- Conflits (ex: lane déjà occupée)
- Équipages non trouvés ou non disponibles

