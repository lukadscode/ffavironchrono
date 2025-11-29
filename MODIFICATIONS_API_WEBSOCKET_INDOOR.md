# Modifications API Backend - WebSocket pour Résultats Indoor

## Contexte

Actuellement, les résultats indoor sont importés via l'endpoint `/indoor-results/import` mais il n'y a pas de notifications en temps réel via websocket. Pour que la page Live affiche les résultats indoor en temps réel, il faut ajouter des événements websocket spécifiques.

## Événements WebSocket à ajouter

### 1. `indoorResultsImported`

Émis quand des résultats indoor sont importés pour une course.

**Quand émettre :**
- Après un import réussi via `/indoor-results/import`
- Quand la course passe en statut "non_official" après l'import

**Données à envoyer :**
```typescript
{
  race_id: string;
  event_id: string;
  participants_count: number;
  linked_crews_count: number;
  race_status: string; // "non_official" ou "official"
}
```

**Où émettre :**
- Dans la room `publicEvent:${event_id}` (pour la page Live publique)
- Dans la room `race:${race_id}` (pour les pages de détail de course)

### 2. `indoorParticipantUpdate`

Émis quand un participant indoor termine sa course (si ErgRace envoie des mises à jour en temps réel).

**Quand émettre :**
- Quand un nouveau participant termine sa course
- Quand les résultats d'un participant sont mis à jour

**Données à envoyer :**
```typescript
{
  race_id: string;
  event_id: string;
  participant: {
    id: string;
    place: number;
    time_display: string;
    time_ms: number;
    distance: number;
    avg_pace: string;
    spm: number;
    calories: number;
    crew_id?: string | null;
    crew?: {
      id: string;
      club_name: string;
      club_code: string;
      category?: {
        id: string;
        code: string;
        label: string;
      };
    } | null;
  };
}
```

**Où émettre :**
- Dans la room `publicEvent:${event_id}` (pour la page Live publique)
- Dans la room `race:${race_id}` (pour les pages de détail de course)

### 3. `indoorRaceResultsComplete`

Émis quand tous les résultats d'une course indoor sont disponibles (optionnel, pour notifier que la course est terminée).

**Quand émettre :**
- Quand tous les participants ont terminé
- Quand la course passe en statut "official"

**Données à envoyer :**
```typescript
{
  race_id: string;
  event_id: string;
  total_participants: number;
  race_status: string;
}
```

## Modifications à faire dans le backend

### 1. Endpoint `/indoor-results/import`

Après un import réussi, émettre l'événement `indoorResultsImported` :

```javascript
// Après avoir sauvegardé les résultats indoor
await indoorResultsService.importResults(payload);

// Émettre l'événement websocket
io.to(`publicEvent:${event_id}`).emit('indoorResultsImported', {
  race_id: raceId,
  event_id: eventId,
  participants_count: result.participants_count,
  linked_crews_count: result.linked_crews_count,
  race_status: 'non_official'
});

io.to(`race:${raceId}`).emit('indoorResultsImported', {
  race_id: raceId,
  event_id: eventId,
  participants_count: result.participants_count,
  linked_crews_count: result.linked_crews_count,
  race_status: 'non_official'
});
```

### 2. Si ErgRace envoie des mises à jour en temps réel

Si ErgRace peut envoyer des mises à jour en temps réel (via webhook ou autre), créer un endpoint pour recevoir ces mises à jour et émettre `indoorParticipantUpdate`.

### 3. Quand la course passe en statut "official"

Émettre `indoorRaceResultsComplete` quand la course est validée par les arbitres.

## Modifications côté Frontend

### Live.tsx

Ajouter les listeners pour les nouveaux événements :

```typescript
// Écouter les résultats indoor importés
socket.on("indoorResultsImported", async ({ race_id, event_id, participants_count }) => {
  // Recharger les résultats de la course
  // Ou mettre à jour directement si on a les données
});

// Écouter les mises à jour de participants indoor
socket.on("indoorParticipantUpdate", ({ race_id, participant }) => {
  // Mettre à jour les résultats de la course en temps réel
  setRaces((prev) =>
    prev.map((race) => {
      if (race.id !== race_id) return race;
      // Mettre à jour les résultats indoor
      return { ...race, indoorResults: updatedResults };
    })
  );
});
```

## Notes importantes

1. **Compatibilité** : Les événements websocket existants (`raceIntermediateUpdate`, `raceFinalUpdate`) ne doivent pas être modifiés pour ne pas casser les courses normales.

2. **Rooms** : Utiliser les mêmes rooms que pour les courses normales :
   - `publicEvent:${event_id}` pour les pages publiques
   - `race:${race_id}` pour les pages de détail

3. **Format des données** : Les données envoyées doivent correspondre au format des résultats indoor déjà utilisé dans l'API REST.

4. **Performance** : Pour les événements avec beaucoup de participants, considérer d'envoyer seulement les mises à jour incrémentielles plutôt que tous les résultats à chaque fois.

