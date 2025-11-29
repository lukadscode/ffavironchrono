# Modification API Backend - Endpoint Public pour Résultats Indoor

## Problème

L'endpoint `/indoor-results/race/${raceId}` retourne actuellement une erreur **401 (Unauthorized)** lorsqu'il est appelé depuis les pages publiques (sans authentification).

## Solution nécessaire

Il faut créer un endpoint public pour les résultats indoor, similaire aux autres endpoints publics existants.

## Options

### Option 1 : Rendre l'endpoint existant accessible publiquement (recommandé)

Modifier l'endpoint `/indoor-results/race/${raceId}` pour qu'il soit accessible publiquement **uniquement pour les courses avec statut "non_official" ou "official"**.

**Logique de sécurité :**
- Vérifier que la course existe
- Vérifier que la course a le statut "non_official" ou "official"
- Si oui, retourner les résultats sans authentification
- Sinon, retourner 401 ou 403

### Option 2 : Créer un nouvel endpoint public

Créer un nouvel endpoint `/public/indoor-results/race/${raceId}` qui est explicitement public.

## Structure de réponse attendue

L'endpoint doit retourner la même structure que l'endpoint authentifié :

```json
{
  "data": {
    "race_result": {
      "id": "string",
      "race_id": "string",
      "race_start_time": "string",
      "race_end_time": "string",
      "duration": number,
      "raw_data": object
    },
    "participants": [
      {
        "id": "string",
        "place": number,
        "time_display": "string",
        "time_ms": number,
        "distance": number,
        "avg_pace": "string",
        "spm": number,
        "calories": number,
        "machine_type": "string",
        "logged_time": "string",
        "ergrace_participant_id": "string",
        "crew_id": "string | null",
        "crew": {
          "id": "string",
          "club_name": "string",
          "club_code": "string",
          "category": {
            "id": "string",
            "code": "string",
            "label": "string"
          } | null
        } | null
      }
    ]
  }
}
```

## Exemple d'implémentation (Option 1)

```javascript
// Dans le contrôleur ou route
router.get('/indoor-results/race/:raceId', async (req, res) => {
  try {
    const { raceId } = req.params;
    
    // Récupérer la course pour vérifier son statut
    const race = await Race.findByPk(raceId);
    
    if (!race) {
      return res.status(404).json({ error: 'Course non trouvée' });
    }
    
    // Vérifier que la course est accessible publiquement
    const isPublicStatus = race.status === 'non_official' || race.status === 'official';
    
    // Si la course n'est pas publique, vérifier l'authentification
    if (!isPublicStatus) {
      // Vérifier l'authentification (middleware ou vérification manuelle)
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Non autorisé' });
      }
      // Vérifier le token...
    }
    
    // Récupérer les résultats indoor
    const indoorResults = await IndoorRaceResult.findOne({
      where: { race_id: raceId },
      include: [
        {
          model: IndoorParticipantResult,
          include: [
            {
              model: Crew,
              include: [Category]
            }
          ],
          order: [['place', 'ASC']]
        }
      ]
    });
    
    if (!indoorResults) {
      return res.status(404).json({ error: 'Résultats non trouvés' });
    }
    
    // Formater la réponse
    const response = {
      race_result: {
        id: indoorResults.id,
        race_id: indoorResults.race_id,
        race_start_time: indoorResults.race_start_time,
        race_end_time: indoorResults.race_end_time,
        duration: indoorResults.duration,
        // Ne pas inclure raw_data pour les requêtes publiques (optionnel)
        // raw_data: indoorResults.raw_data
      },
      participants: indoorResults.participants.map(p => ({
        id: p.id,
        place: p.place,
        time_display: p.time_display,
        time_ms: p.time_ms,
        distance: p.distance,
        avg_pace: p.avg_pace,
        spm: p.spm,
        calories: p.calories,
        machine_type: p.machine_type,
        logged_time: p.logged_time,
        ergrace_participant_id: p.ergrace_participant_id,
        crew_id: p.crew_id,
        crew: p.crew ? {
          id: p.crew.id,
          club_name: p.crew.club_name,
          club_code: p.crew.club_code,
          category: p.crew.category ? {
            id: p.crew.category.id,
            code: p.crew.category.code,
            label: p.crew.category.label
          } : null
        } : null
      }))
    };
    
    res.json({ data: response });
  } catch (error) {
    console.error('Erreur récupération résultats indoor:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
```

## Test

Une fois l'endpoint modifié, tester avec :

```bash
# Test sans authentification (doit fonctionner pour courses non_official/official)
curl https://api-timing.ffaviron.fr/indoor-results/race/46916f84-f780-488c-813d-a5475142f86e

# Test avec authentification (doit fonctionner pour toutes les courses)
curl -H "Authorization: Bearer TOKEN" https://api-timing.ffaviron.fr/indoor-results/race/46916f84-f780-488c-813d-a5475142f86e
```

## Notes importantes

1. **Sécurité** : Ne rendre publics que les résultats des courses avec statut "non_official" ou "official"
2. **Performance** : Considérer le cache pour les résultats publics
3. **Données sensibles** : Ne pas exposer `raw_data` dans les réponses publiques (optionnel)

