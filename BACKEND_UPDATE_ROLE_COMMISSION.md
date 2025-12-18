# Mise à jour backend : Ajout du rôle "commission"

## Problème
Le frontend envoie le rôle `"commission"` au backend, mais la validation du schéma rejette cette valeur avec l'erreur :
```
"role" must be one of [user, admin, superadmin]
```

## Solution requise

### 1. Mise à jour du schéma de validation
Le schéma de validation du champ `role` doit être mis à jour pour accepter `"commission"` en plus de `"user"`, `"admin"` et `"superadmin"`.

**Exemple avec Zod :**
```typescript
// Avant
role: z.enum(["user", "admin", "superadmin"])

// Après
role: z.enum(["user", "commission", "admin", "superadmin"])
```

**Exemple avec Joi :**
```javascript
// Avant
role: Joi.string().valid("user", "admin", "superadmin")

// Après
role: Joi.string().valid("user", "commission", "admin", "superadmin")
```

### 2. Endroits à modifier
- Schéma de validation pour la création d'utilisateur (`POST /users`)
- Schéma de validation pour la mise à jour d'utilisateur (`PATCH /users/:id`)
- Tous les autres endroits où le rôle utilisateur est validé

### 3. Droits du rôle "commission"
Le rôle "commission" a les mêmes droits que "user" SAUF qu'il a accès à la page `/dashboard/club-rankings` (comme les admins).

**Résumé des droits :**
- ✅ Accès au dashboard de base (comme "user")
- ✅ Accès à `/dashboard/club-rankings` (comme "admin")
- ❌ Pas d'accès aux pages de gestion (events-management, categories-management, clubs-management, etc.)
- ❌ Pas d'accès à la gestion des utilisateurs

### 4. Note importante
Le rôle "commission" a déjà été ajouté en base de données. Il faut seulement mettre à jour la validation du schéma pour l'accepter.

