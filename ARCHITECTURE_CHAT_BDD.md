# 🗄️ Architecture de Persistance - Chat Organisateurs

## Principe de Fonctionnement

Avec l'option 1 (Socket.io natif), **TOUS les messages sont stockés en base de données** de manière permanente. Socket.io sert uniquement à la **diffusion en temps réel**, mais la BDD est la source de vérité.

---

## 📊 Flux de Données Complet

### 1. Envoi d'un message

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐         ┌─────────────┐
│  Frontend   │         │    Backend   │         │    Socket   │         │     BDD     │
│  (React)    │         │    (API)     │         │     .io     │         │  (MySQL)    │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                        │                       │
       │ 1. POST /chat/message │                        │                       │
       │──────────────────────>│                        │                       │
       │                       │                        │                       │
       │                       │ 2. Sauvegarde message  │                       │
       │                       │────────────────────────┼──────────────────────>│
       │                       │                        │                       │
       │                       │ 3. Retour: message_id  │                       │
       │                       │<───────────────────────┼───────────────────────│
       │                       │                        │                       │
       │ 4. Réponse avec msg   │                        │                       │
       │<──────────────────────│                        │                       │
       │                       │                        │                       │
       │                       │ 5. Émission Socket.io  │                       │
       │                       │───────────────────────>│                       │
       │                       │                        │                       │
       │ 6. Broadcast à tous   │                        │                       │
       │<──────────────────────┼────────────────────────┤                       │
```

### 2. Récupération de l'historique

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Frontend   │         │    Backend   │         │     BDD     │
│  (React)    │         │    (API)     │         │  (MySQL)    │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │ 1. GET /chat/messages │                        │
       │──────────────────────>│                        │
       │                       │                        │
       │                       │ 2. SELECT * FROM ...   │
       │                       │───────────────────────>│
       │                       │                        │
       │                       │ 3. Retour: messages[]  │
       │                       │<───────────────────────│
       │                       │                        │
       │ 4. Réponse JSON       │                        │
       │<──────────────────────│                        │
```

---

## 🗃️ Structure de la Base de Données

### Table : `event_chat_messages`

```sql
CREATE TABLE event_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Contenu du message
  message TEXT NOT NULL,
  
  -- Métadonnées
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Statut de lecture
  read_by JSONB DEFAULT '[]', -- Liste des user_ids qui ont lu le message
  
  -- Indicateurs
  is_system_message BOOLEAN DEFAULT FALSE, -- Messages système (ex: "X a rejoint")
  is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete
  
  -- Index pour performance
  INDEX idx_event_chat_event_id (event_id),
  INDEX idx_event_chat_created_at (created_at),
  INDEX idx_event_chat_user_id (user_id)
);
```

### Table : `event_chat_participants` (optionnel - pour tracking présence)

```sql
CREATE TABLE event_chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Statut de présence
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP DEFAULT NOW(),
  
  -- Métadonnées
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(event_id, user_id),
  INDEX idx_chat_participants_event (event_id),
  INDEX idx_chat_participants_user (user_id)
);
```

---

## 🔄 Rôles Respectifs

### Base de Données (MySQL)
- ✅ **Source de vérité** - Tous les messages sont sauvegardés
- ✅ **Persistance permanente** - Les messages restent même après redémarrage
- ✅ **Historique complet** - Peut récupérer tous les messages d'un événement
- ✅ **Requêtes complexes** - Statistiques, recherche, export

### Socket.io (WebSocket)
- ✅ **Temps réel uniquement** - Diffusion instantanée des nouveaux messages
- ✅ **Performance** - Pas besoin de poller l'API toutes les secondes
- ✅ **Événements live** - "en train de taper...", présence en ligne
- ❌ **Pas de stockage** - Les messages ne sont pas stockés par Socket.io

---

## 📝 Exemple de Code Backend

### Route API : Sauvegarder un message

```typescript
// Backend (NestJS/Express)
app.post('/api/events/:eventId/chat/messages', async (req, res) => {
  const { eventId } = req.params;
  const { message } = req.body;
  const userId = req.user.id; // Depuis JWT
  
  // 1. Sauvegarder en BDD
  const savedMessage = await db.query(`
    INSERT INTO event_chat_messages (event_id, user_id, message)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [eventId, userId, message]);
  
  // 2. Enrichir avec les infos utilisateur
  const messageWithUser = {
    ...savedMessage,
    user: await getUserById(userId)
  };
  
  // 3. Diffuser via Socket.io
  io.to(`event:${eventId}:chat`).emit('newChatMessage', messageWithUser);
  
  // 4. Retourner le message sauvegardé
  res.json(messageWithUser);
});
```

### Route API : Récupérer l'historique

```typescript
app.get('/api/events/:eventId/chat/messages', async (req, res) => {
  const { eventId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  
  // Récupérer depuis la BDD
  const messages = await db.query(`
    SELECT 
      ecm.*,
      u.name as user_name,
      u.email as user_email,
      u.role as user_role
    FROM event_chat_messages ecm
    LEFT JOIN users u ON ecm.user_id = u.id
    WHERE ecm.event_id = $1
      AND ecm.is_deleted = FALSE
    ORDER BY ecm.created_at DESC
    LIMIT $2 OFFSET $3
  `, [eventId, limit, offset]);
  
  res.json({
    messages: messages.reverse(), // Plus ancien en premier
    total: await getTotalMessages(eventId),
    hasMore: messages.length === limit
  });
});
```

---

## ✅ Garanties de Persistance

### Scénarios de récupération :

1. **Utilisateur se reconnecte** → Charge l'historique depuis la BDD
2. **Page rechargée** → Tous les messages sont récupérés depuis la BDD
3. **Serveur redémarre** → Rien n'est perdu, tout est en BDD
4. **Connexion WebSocket perdue** → L'historique reste accessible via API REST
5. **Export de conversation** → Possible grâce à la BDD
6. **Recherche dans les messages** → Requête SQL sur la BDD

### Stratégie hybride :

```
┌─────────────────────────────────────────────────────┐
│                 Frontend (React)                     │
├─────────────────────────────────────────────────────┤
│  Au chargement de la page :                          │
│  ├─ GET /chat/messages → Charge historique (BDD)    │
│  └─ Socket.io.connect → Écoute nouveaux messages    │
│                                                       │
│  Envoi d'un message :                                │
│  ├─ POST /chat/messages → Sauvegarde (BDD)          │
│  └─ Socket.io broadcast → Temps réel                │
│                                                       │
│  Réception d'un message :                            │
│  ├─ Socket.io event → Affiche immédiatement         │
│  └─ (Optionnel) Recharge depuis BDD si besoin       │
└─────────────────────────────────────────────────────┘
```

---

## 🔍 Avantages de cette Architecture

1. **Fiabilité** : Les messages ne sont jamais perdus
2. **Historique complet** : Accès à tous les messages passés
3. **Performance** : Socket.io pour le temps réel, BDD pour l'historique
4. **Scalabilité** : Peut paginer les messages (100, 1000, etc.)
5. **Recherche** : Requêtes SQL pour chercher dans les messages
6. **Export** : Facile d'exporter les conversations
7. **Analytics** : Statistiques sur les messages (nombre, temps de réponse, etc.)

---

## 📊 Exemple de Données Stockées

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "event_id": "2699f295-f018-4346-b58b-42f215ee6452",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Bonjour, j'ai un problème avec l'affichage des résultats",
  "created_at": "2024-01-15T14:32:15Z",
  "read_by": [
    "123e4567-e89b-12d3-a456-426614174000",
    "987e6543-e21b-43d5-a789-123456789012"
  ],
  "is_system_message": false,
  "is_deleted": false
}
```

---

## ⚠️ Points d'Attention

### Taille de la base de données
- Les messages peuvent s'accumuler
- **Solution** : Archivage périodique (ex: messages > 1 an dans une table séparée)
- **Solution** : Limite de messages conservés par événement (ex: 5000 max)

### Performance
- Si beaucoup de messages, pagination nécessaire
- **Solution** : Charger les 50 derniers, puis lazy-load au scroll
- **Solution** : Index sur `event_id` et `created_at`

### Confidentialité
- Les messages sont stockés en clair en BDD
- **Option** : Chiffrement au niveau BDD (MySQL encryption)
- **Option** : Chiffrement applicatif (chiffrer avant insertion)

---

## 🎯 Résumé

**OUI, avec l'option 1, TOUT est stocké en base de données :**
- ✅ Chaque message est sauvegardé immédiatement en BDD
- ✅ Socket.io sert uniquement à la diffusion temps réel
- ✅ L'historique complet est disponible depuis la BDD
- ✅ Rien n'est perdu, même en cas de déconnexion
- ✅ Possibilité de récupérer, rechercher, exporter les messages

**La BDD = source de vérité**
**Socket.io = système de notification temps réel**

