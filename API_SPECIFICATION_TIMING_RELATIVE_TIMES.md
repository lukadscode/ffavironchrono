# Spécification API : Calcul des temps relatifs côté serveur

## 📋 Contexte et problème

### Problème actuel

Actuellement, le calcul des temps relatifs (temps écoulé depuis le départ) est effectué côté **frontend**. Cela pose plusieurs problèmes :

1. **Incohérence** : Si l'heure de départ est modifiée après coup, tous les temps relatifs deviennent incorrects
2. **Complexité frontend** : Le frontend doit gérer la logique de calcul, la synchronisation des timestamps, et la détection des erreurs
3. **Performance** : Calculs répétés côté client pour chaque affichage
4. **Fiabilité** : Risque d'erreurs dues aux décalages de temps client/serveur
5. **Maintenance** : Logique métier dispersée entre frontend et backend

### Exemple du problème

```
Course démarre à 10:00:00
- Équipage 1 passe à 10:05:30 → Temps relatif = 5:30.000 ✅

Mais si on corrige le départ à 10:00:05 :
- Le temps relatif devrait être 5:25.000
- Mais le frontend calcule toujours avec l'ancien départ → 5:30.000 ❌
```

---

## 🎯 Solution proposée

**Calculer les temps relatifs côté serveur (API)** et les fournir directement dans les réponses API.

### Principe

- L'API calcule toujours les temps relatifs **à la volée** en fonction du timing de départ actuel
- Si le timing de départ change, tous les temps relatifs sont automatiquement recalculés
- Le frontend n'a plus qu'à afficher les valeurs fournies par l'API

---

## 📝 Modifications nécessaires

### 1. Ajout du champ `relative_time_ms` dans les réponses

#### Endpoint : `GET /timings/event/:eventId`

**Réponse actuelle :**

```json
{
  "status": "success",
  "data": [
    {
      "id": "timing-123",
      "timestamp": "2024-01-15T10:05:30.000Z",
      "timing_point_id": "point-456",
      "manual_entry": false,
      "status": "assigned"
    }
  ]
}
```

**Réponse modifiée :**

```json
{
  "status": "success",
  "data": [
    {
      "id": "timing-123",
      "timestamp": "2024-01-15T10:05:30.000Z",
      "timing_point_id": "point-456",
      "manual_entry": false,
      "status": "assigned",
      "relative_time_ms": 330000, // ← NOUVEAU : Temps en millisecondes depuis le départ
      "crew_id": "crew-789", // ← NOUVEAU : ID de l'équipage (si assigné)
      "race_id": "race-abc" // ← NOUVEAU : ID de la course (si assigné)
    }
  ]
}
```

#### Endpoint : `GET /timings/race/:raceId`

**Réponse modifiée :**

```json
{
  "status": "success",
  "data": [
    {
      "id": "timing-123",
      "timestamp": "2024-01-15T10:05:30.000Z",
      "timing_point_id": "point-456",
      "relative_time_ms": 330000,
      "crew_id": "crew-789",
      "race_id": "race-abc"
    }
  ]
}
```

#### Endpoint : `GET /timing-assignments/race/:raceId`

**Réponse actuelle :**

```json
{
  "status": "success",
  "data": [
    {
      "id": "assignment-123",
      "timing_id": "timing-456",
      "crew_id": "crew-789"
    }
  ]
}
```

**Réponse modifiée (option 1 - enrichie) :**

```json
{
  "status": "success",
  "data": [
    {
      "id": "assignment-123",
      "timing_id": "timing-456",
      "crew_id": "crew-789",
      "timing": {
        // ← NOUVEAU : Timing enrichi
        "id": "timing-456",
        "timestamp": "2024-01-15T10:05:30.000Z",
        "timing_point_id": "point-456",
        "relative_time_ms": 330000
      }
    }
  ]
}
```

**OU réponse modifiée (option 2 - séparée) :**

```json
{
  "status": "success",
  "data": [
    {
      "id": "assignment-123",
      "timing_id": "timing-456",
      "crew_id": "crew-789",
      "relative_time_ms": 330000 // ← NOUVEAU : Temps relatif directement
    }
  ]
}
```

---

## 🔧 Logique de calcul côté serveur

### Algorithme de calcul

```typescript
function calculateRelativeTime(
  timing: Timing,
  raceId: string,
  crewId: string,
): number | null {
  // 1. Trouver le point de départ pour cette course
  const startPoint = getStartTimingPoint(raceId);
  if (!startPoint) return null;

  // 2. Trouver le timing de départ pour cet équipage
  const startTiming = getStartTiming(raceId, crewId, startPoint.id);
  if (!startTiming) return null;

  // 3. Si c'est le point de départ lui-même, retourner 0
  if (timing.timing_point_id === startPoint.id) {
    return 0;
  }

  // 4. Calculer la différence en millisecondes
  const startTime = new Date(startTiming.timestamp).getTime();
  const currentTime = new Date(timing.timestamp).getTime();
  const diffMs = currentTime - startTime;

  // 5. Vérifier que le temps est valide (positif et raisonnable)
  if (diffMs < 0 || diffMs > 1800000) {
    // 30 minutes max
    return null; // ou throw error selon la stratégie
  }

  return diffMs;
}
```

### Règles de calcul

1. **Point de départ** : `relative_time_ms = 0`
2. **Autres points** : `relative_time_ms = timestamp_actuel - timestamp_départ`
3. **Si pas de départ** : `relative_time_ms = null`
4. **Si temps négatif** : `relative_time_ms = null` (erreur de logique)
5. **Si temps > 30 minutes** : `relative_time_ms = null` (probablement une erreur)

### Cas particuliers

#### Cas 1 : Timing non assigné

```json
{
  "id": "timing-123",
  "timestamp": "2024-01-15T10:05:30.000Z",
  "timing_point_id": "point-456",
  "relative_time_ms": null, // Pas de crew_id, pas de calcul possible
  "crew_id": null,
  "race_id": null
}
```

#### Cas 2 : Pas de timing de départ

```json
{
  "id": "timing-123",
  "timestamp": "2024-01-15T10:05:30.000Z",
  "timing_point_id": "point-456",
  "relative_time_ms": null, // Pas de départ trouvé
  "crew_id": "crew-789",
  "race_id": "race-abc"
}
```

#### Cas 3 : Timing de départ lui-même

```json
{
  "id": "timing-123",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "timing_point_id": "start-point-id",
  "relative_time_ms": 0, // Toujours 0 pour le départ
  "crew_id": "crew-789",
  "race_id": "race-abc"
}
```

---

## 🔄 Gestion des modifications de départ

### Scénario : Modification du timing de départ

**Avant modification :**

```json
{
  "id": "start-timing-1",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "timing_point_id": "start-point",
  "crew_id": "crew-789"
}
```

**Timing intermédiaire :**

```json
{
  "id": "intermediate-timing-1",
  "timestamp": "2024-01-15T10:05:30.000Z",
  "relative_time_ms": 330000 // 5:30.000
}
```

**Après modification du départ à 10:00:05 :**

```json
{
  "id": "start-timing-1",
  "timestamp": "2024-01-15T10:00:05.000Z", // ← Modifié
  "timing_point_id": "start-point",
  "crew_id": "crew-789"
}
```

**Timing intermédiaire (recalculé automatiquement) :**

```json
{
  "id": "intermediate-timing-1",
  "timestamp": "2024-01-15T10:05:30.000Z",
  "relative_time_ms": 325000 // ← Recalculé : 5:25.000
}
```

### Implémentation recommandée

**Option A : Calcul à la volée (recommandé)**

- Calculer `relative_time_ms` à chaque requête
- Pas besoin de stocker la valeur en base
- Toujours à jour automatiquement

**Option B : Recalcul lors de modification**

- Stocker `relative_time_ms` en base
- Recalculer tous les timings d'une course quand le départ change
- Plus performant mais plus complexe

**Recommandation : Option A** (calcul à la volée)

---

## 📊 Exemples de réponses complètes

### Exemple 1 : Course avec plusieurs timings

**GET /timings/race/race-123**

```json
{
  "status": "success",
  "data": [
    {
      "id": "timing-1",
      "timestamp": "2024-01-15T10:00:00.000Z",
      "timing_point_id": "start-point",
      "relative_time_ms": 0,
      "crew_id": "crew-1",
      "race_id": "race-123",
      "status": "assigned"
    },
    {
      "id": "timing-2",
      "timestamp": "2024-01-15T10:05:30.000Z",
      "timing_point_id": "intermediate-point-1",
      "relative_time_ms": 330000,
      "crew_id": "crew-1",
      "race_id": "race-123",
      "status": "assigned"
    },
    {
      "id": "timing-3",
      "timestamp": "2024-01-15T10:10:15.500Z",
      "timing_point_id": "finish-point",
      "relative_time_ms": 615500,
      "crew_id": "crew-1",
      "race_id": "race-123",
      "status": "assigned"
    }
  ]
}
```

### Exemple 2 : Timing non assigné

```json
{
  "id": "timing-4",
  "timestamp": "2024-01-15T10:05:45.000Z",
  "timing_point_id": "intermediate-point-1",
  "relative_time_ms": null,
  "crew_id": null,
  "race_id": null,
  "status": "pending"
}
```

### Exemple 3 : Pas de départ trouvé

```json
{
  "id": "timing-5",
  "timestamp": "2024-01-15T10:05:30.000Z",
  "timing_point_id": "intermediate-point-1",
  "relative_time_ms": null, // Pas de départ pour cet équipage
  "crew_id": "crew-2",
  "race_id": "race-123",
  "status": "assigned"
}
```

---

## 🎨 Format d'affichage côté frontend

Le frontend recevra `relative_time_ms` en millisecondes et devra le formater :

```typescript
function formatTime(ms: number | null): string {
  if (ms === null) return '-';

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

// Exemple : 330000 ms → "5:30.000"
// Exemple : 615500 ms → "10:15.500"
```

---

## ✅ Avantages de cette solution

1. **Source de vérité unique** : Le serveur est la seule source de calcul
2. **Cohérence automatique** : Si le départ change, tous les temps sont recalculés
3. **Simplicité frontend** : Plus besoin de gérer la logique de calcul
4. **Performance** : Calcul une seule fois côté serveur
5. **Fiabilité** : Pas de problème de décalage client/serveur
6. **Maintenance** : Logique métier centralisée

---

## 🚀 Plan de migration

### Phase 1 : Ajout du champ (rétrocompatible)

- Ajouter `relative_time_ms` dans les réponses
- Le frontend peut continuer à calculer en parallèle pour vérification
- **Pas de breaking change**

### Phase 2 : Migration frontend

- Le frontend utilise `relative_time_ms` de l'API
- Suppression de la logique de calcul côté frontend
- **Simplification du code**

### Phase 3 : Optimisation

- Optimiser les requêtes pour inclure les timings de départ
- Mise en cache si nécessaire
- **Performance améliorée**

---

## 📋 Checklist de validation

- [ ] Le champ `relative_time_ms` est présent dans toutes les réponses de timings
- [ ] Le calcul est correct pour tous les points (départ = 0, autres = différence)
- [ ] Si pas de départ, `relative_time_ms = null`
- [ ] Si temps négatif ou > 30 min, `relative_time_ms = null`
- [ ] Quand le départ change, tous les temps sont recalculés
- [ ] Les timings non assignés ont `relative_time_ms = null`
- [ ] Les performances sont acceptables (calcul à la volée)
- [ ] Documentation API mise à jour

---

## 🔍 Tests à effectuer

### Test 1 : Calcul basique

```
Départ : 10:00:00.000
Intermédiaire : 10:05:30.000
Attendu : relative_time_ms = 330000 (5:30.000)
```

### Test 2 : Point de départ

```
Départ : 10:00:00.000
Attendu : relative_time_ms = 0
```

### Test 3 : Modification du départ

```
Départ initial : 10:00:00.000
Intermédiaire : 10:05:30.000 → relative_time_ms = 330000

Départ modifié : 10:00:05.000
Intermédiaire : 10:05:30.000 → relative_time_ms = 325000 (recalculé)
```

### Test 4 : Pas de départ

```
Intermédiaire : 10:05:30.000
Pas de départ trouvé
Attendu : relative_time_ms = null
```

### Test 5 : Timing non assigné

```
Timing : 10:05:30.000
Pas de crew_id
Attendu : relative_time_ms = null
```

---

## 📞 Questions / Points à clarifier

1. **Performance** : Le calcul à la volée est-il acceptable pour toutes les courses simultanées ?
2. **Cache** : Faut-il mettre en cache les timings de départ pour optimiser ?
3. **Historique** : Faut-il garder l'historique des temps relatifs si le départ change ?
4. **WebSocket** : Les événements WebSocket doivent-ils aussi inclure `relative_time_ms` ?
5. **Compatibilité** : Faut-il maintenir l'ancien format pendant une période de transition ?

---

## 📝 Notes techniques

- **Type de données** : `relative_time_ms` est un `number | null` (millisecondes)
- **Précision** : Millisecondes (3 décimales à l'affichage)
- **Limite** : 30 minutes maximum (1800000 ms) pour une course normale
- **Null safety** : Toujours vérifier `null` avant affichage

---

**Date de création** : 2024-01-15  
**Version** : 1.0  
**Auteur** : Spécification pour l'équipe backend

