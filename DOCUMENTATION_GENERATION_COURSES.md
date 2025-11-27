# Documentation : Génération des Courses - Structure et Logique

## Vue d'ensemble

La page `GenerateRacesPage.tsx` permet à l'utilisateur d'organiser manuellement les catégories en **séries** avant de générer automatiquement les courses. Chaque série peut contenir plusieurs catégories avec un nombre spécifique de participants par catégorie.

## Concepts clés

### 1. **Série (Series)**
Une série est un groupement de catégories qui seront regroupées dans une ou plusieurs courses. Une série peut contenir :
- **Plusieurs catégories différentes** (ex: "Senior Femme" + "Senior Homme")
- **Un nombre spécifique de participants par catégorie** dans cette série
- **Un nombre total de participants** qui ne peut pas dépasser le nombre de lignes d'eau configuré

### 2. **Règles métier importantes**

#### Règle de distance
- **Toutes les catégories dans une même série doivent avoir la même distance** (ex: toutes à 2000m)
- Si une catégorie a une distance différente, elle ne peut pas être ajoutée à une série existante
- Les catégories sans distance peuvent être mélangées avec d'autres

#### Règle de capacité
- Le nombre total de participants dans une série ne peut pas dépasser le `lane_count` (nombre de lignes d'eau)
- Si une catégorie a plus de participants que le `lane_count`, elle sera répartie sur plusieurs séries

#### Règle de répartition
- L'utilisateur peut ajuster manuellement le nombre de participants **par catégorie** dans chaque série
- Une catégorie peut être partagée entre plusieurs séries (ex: 15 équipages "Senior Femme" répartis sur 3 séries : 5 + 5 + 5)

## Structure des données côté frontend

### Interface `Series`
```typescript
interface Series {
  id: string;                    // Identifiant unique de la série (ex: "series-1234567890")
  categories: Record<string, number>;  // { categoryCode: numberOfParticipants }
  // Exemple: { "SF": 5, "SH": 3 } signifie 5 équipages "Senior Femme" et 3 "Senior Homme"
}
```

### Interface `Category`
```typescript
interface Category {
  id: string;
  code: string;                   // Code unique de la catégorie (ex: "SF", "SH")
  label: string;                 // Libellé (ex: "Senior Femme")
  crew_count: number;            // Nombre total d'équipages dans cette catégorie
  distance_id?: string;           // ID de la distance associée
  distance?: {
    id: string;
    meters: number;              // Distance en mètres (ex: 2000, 500, 1000)
    label?: string;
  };
}
```

## Exemple concret

### Scénario
- **Phase** : "Phase 1"
- **Lignes d'eau** : 6
- **Catégories disponibles** :
  - "Senior Femme" (SF) : 15 équipages, distance 2000m
  - "Senior Homme" (SH) : 8 équipages, distance 2000m
  - "Junior Femme" (JF) : 10 équipages, distance 1000m

### Organisation en séries

**Série 1** :
- SF: 5 équipages
- SH: 1 équipage
- Total: 6 participants (série complète)

**Série 2** :
- SF: 5 équipages
- SH: 1 équipage
- Total: 6 participants (série complète)

**Série 3** :
- SF: 5 équipages
- SH: 6 équipages
- Total: 11 participants → **ERREUR** (dépasse 6 lignes d'eau)

**Série 4** :
- JF: 6 équipages
- Total: 6 participants (série complète)

**Série 5** :
- JF: 4 équipages
- Total: 4 participants (série incomplète, 2 places disponibles)

### Résultat attendu
- **Course 1** : Série 1 → 5 SF + 1 SH (6 participants, 2000m)
- **Course 2** : Série 2 → 5 SF + 1 SH (6 participants, 2000m)
- **Course 3** : Série 3 → 5 SF + 1 SH (6 participants, 2000m) - Note: les 6 SH restants doivent être dans une nouvelle série
- **Course 4** : Série 4 → 6 JF (6 participants, 1000m)
- **Course 5** : Série 5 → 4 JF (4 participants, 1000m)

## Payload actuel (à améliorer)

Le payload actuel envoyé à `/races/generate` est :

```json
{
  "phase_id": "uuid-de-la-phase",
  "lane_count": 6,
  "start_time": "2024-01-15T09:00:00.000Z",  // Optionnel
  "interval_minutes": 5,
  "category_order": ["SF", "SH", "JF"]       // ❌ Ne contient pas les détails des séries
}
```

## Payload recommandé pour l'API

Le payload devrait être modifié pour inclure la structure complète des séries :

```json
{
  "phase_id": "uuid-de-la-phase",
  "lane_count": 6,
  "start_time": "2024-01-15T09:00:00.000Z",  // Optionnel, ISO 8601
  "interval_minutes": 5,
  "series": [
    {
      "id": "series-1234567890",
      "categories": {
        "SF": 5,  // 5 équipages de "Senior Femme" dans cette série
        "SH": 1   // 1 équipage de "Senior Homme" dans cette série
      }
    },
    {
      "id": "series-1234567891",
      "categories": {
        "SF": 5,
        "SH": 1
      }
    },
    {
      "id": "series-1234567892",
      "categories": {
        "SF": 5,
        "SH": 1
      }
    },
    {
      "id": "series-1234567893",
      "categories": {
        "JF": 6
      }
    },
    {
      "id": "series-1234567894",
      "categories": {
        "JF": 4
      }
    }
  ]
}
```

## Logique de génération attendue côté backend

### 1. Validation
- Vérifier que chaque série respecte le `lane_count` (somme des participants ≤ `lane_count`)
- Vérifier que toutes les catégories dans une même série ont la même distance (ou aucune distance)
- Vérifier que le nombre total de participants par catégorie ne dépasse pas le `crew_count` de la catégorie

### 2. Création des courses
Pour chaque série :
1. **Créer une course** avec :
   - `phase_id` : la phase sélectionnée
   - `distance_id` : la distance commune des catégories (si toutes ont la même distance)
   - `race_number` : numéro séquentiel dans la phase
   - `start_time` : calculé à partir de `start_time` + (`race_number - 1`) * `interval_minutes`

2. **Assigner les équipages** :
   - Pour chaque catégorie dans la série, sélectionner aléatoirement `N` équipages (où `N` est le nombre spécifié dans `series[i].categories[categoryCode]`)
   - Créer les `race_crews` pour chaque équipage sélectionné
   - Assigner les `lane_number` de manière séquentielle (1, 2, 3, ...)

### 3. Gestion des équipages non assignés
- Si une catégorie a des équipages non assignés (total assigné < `crew_count`), ils restent disponibles pour une assignation manuelle ultérieure

### 4. Ordre des courses
- Les courses sont créées dans l'ordre des séries (série 1 → course 1, série 2 → course 2, etc.)
- Les `race_number` sont incrémentés séquentiellement
- Les `start_time` sont calculés en fonction de `interval_minutes`

## Exemple de réponse attendue

```json
{
  "success": true,
  "message": "X courses générées avec succès",
  "data": {
    "races_created": 5,
    "crews_assigned": 32,
    "races": [
      {
        "id": "race-uuid-1",
        "race_number": 1,
        "start_time": "2024-01-15T09:00:00.000Z",
        "distance_id": "distance-uuid-2000m",
        "crews_count": 6
      },
      // ... autres courses
    ]
  }
}
```

## Points d'attention

1. **Sélection aléatoire des équipages** : Le backend doit sélectionner aléatoirement les équipages pour chaque catégorie dans chaque série, en respectant le nombre demandé.

2. **Gestion des erreurs** :
   - Si une série dépasse `lane_count`, retourner une erreur claire
   - Si des catégories dans une série ont des distances différentes, retourner une erreur
   - Si le nombre total de participants d'une catégorie dépasse `crew_count`, retourner une erreur

3. **Performance** : Si beaucoup de séries/catégories, optimiser les requêtes en base de données (batch inserts, transactions).

4. **Idempotence** : Si la génération est relancée pour la même phase, décider si on :
   - Supprime les courses existantes et recrée
   - Ignore et retourne une erreur
   - Met à jour les courses existantes

## Migration du payload actuel

Le code frontend actuel envoie `category_order` qui est un simple tableau de codes. Il faudra modifier le `handleGenerate` pour envoyer la structure `series` complète.

Voici ce qui devrait être modifié dans `GenerateRacesPage.tsx` :

```typescript
const payload = {
  phase_id: phaseId,
  lane_count: laneCount,
  start_time: startTime ? new Date(startTime).toISOString() : undefined,
  interval_minutes: intervalMinutes,
  series: series.map(s => ({
    id: s.id,
    categories: s.categories  // { categoryCode: numberOfParticipants }
  }))
};
```

## Questions pour le développeur backend

1. **Format de `start_time`** : Doit-il être en UTC ou en heure locale ? Le frontend envoie actuellement en ISO 8601.

2. **Gestion des courses existantes** : Que faire si des courses existent déjà pour cette phase ? Les supprimer et recréer, ou retourner une erreur ?

3. **Validation des distances** : Le backend doit-il aussi valider que les catégories dans une série ont la même distance, ou peut-on faire confiance au frontend ?

4. **Sélection des équipages** : Comment sélectionner les équipages ? Aléatoirement, ou y a-t-il un ordre de priorité (ex: par date d'inscription) ?

5. **Gestion des erreurs partielles** : Si une série échoue, doit-on continuer avec les autres ou tout annuler (transaction) ?

