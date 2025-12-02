# Diagnostic : Problème de persistance des distances

## Comment diagnostiquer le problème

Quand vous cliquez sur "Enregistrer les changements", ouvrez la **console du navigateur** (F12) et regardez les logs. Vous devriez voir :

### 1. Logs d'envoi API (📤)

```
📤 ENVOI API category NomCatégorie (id):
  - endpoint: /categories/xxx
  - payload: { distance_id: "yyy" }
  - from: null (ou ancienne distance)
  - to: "yyy" (nouvelle distance)
```

### 2. Logs de réponse API (📥)

```
📥 RÉPONSE API category NomCatégorie (id):
  - status: 200
  - returnedDistanceId: "yyy" (ce que l'API a retourné)
  - expected: "yyy" (ce qu'on attendait)
  - match: true/false
```

### 3. Vérification immédiate

Si `match: false` dans la réponse API, **l'API ne sauvegarde pas correctement** et retourne déjà une mauvaise valeur !

### 4. Vérifications de persistance (🔍)

```
✅ Tentative 1: category NomCatégorie - distance_id: yyy - OK
```

ou

```
⚠️ Tentative 1: category NomCatégorie - ÉCHEC
  expected: yyy
  actual: null (ou autre valeur)
```

## Points à vérifier côté API

Si le problème vient de l'API, vérifier :

### 1. Les endpoints PUT supportent-ils `distance_id` ?

- `PUT /categories/:id` doit accepter `{ distance_id: string | null }`
- `PUT /races/:id` doit accepter `{ distance_id: string | null }`

### 2. Les endpoints mettent-ils vraiment à jour la base de données ?

- Vérifier que le code backend fait bien un `UPDATE` en base
- Vérifier qu'il n'y a pas de rollback de transaction
- Vérifier les logs backend pour voir si les UPDATE sont bien exécutés

### 3. Les endpoints retournent-ils les bonnes données ?

- Après le PUT, l'API doit retourner l'objet mis à jour avec le bon `distance_id`
- Si l'API retourne déjà une mauvaise valeur, le problème est côté backend

### 4. Problème de cache côté backend ?

- L'API peut avoir un cache qui retourne d'anciennes valeurs
- Vérifier si les GET après PUT retournent les bonnes données

## Actions à prendre

1. **Ouvrir la console du navigateur** (F12) et tester l'enregistrement
2. **Copier tous les logs** qui commencent par 📤, 📥, ✅, ⚠️, ❌
3. **Vérifier les logs backend** si possible
4. **Tester directement avec l'API** :
   - Faire un PUT manuel avec Postman/curl
   - Faire un GET immédiatement après
   - Vérifier si la valeur est bien en base

## Solution alternative : Endpoint batch

Si le problème vient de l'API et qu'on ne peut pas le corriger rapidement, on pourrait créer un endpoint batch :

```
POST /categories/batch-update-distances
Body: [
  { id: "xxx", distance_id: "yyy" },
  { id: "zzz", distance_id: null }
]
```

Cet endpoint ferait toutes les mises à jour en une seule transaction, ce qui garantit la cohérence.
