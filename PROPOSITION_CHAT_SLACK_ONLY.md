# 💬 Proposition : Chat via Slack (sans BDD)

## 🎯 Concept

**Slack comme unique stockage des messages** - Les organisateurs utilisent l'interface de l'application, mais tous les messages transitent et sont stockés dans Slack.

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────┐
│  Frontend App   │         │   Backend    │         │    Slack    │
│  (React)        │         │   (API)      │         │   (Canal)   │
└────────┬────────┘         └──────┬───────┘         └──────┬──────┘
         │                         │                        │
         │ Message organisateur    │                        │
         │────────────────────────>│                        │
         │                         │                        │
         │                         │ Post message to Slack  │
         │                         │───────────────────────>│
         │                         │                        │
         │                         │ Slack stocke le msg    │
         │                         │                        │
         │ Support répond sur Slack│                        │
         │<────────────────────────┼────────────────────────┤
         │                         │ Lit depuis Slack       │
         │                         │<───────────────────────│
         │                         │                        │
         │ Affiche dans l'app      │                        │
         │<────────────────────────│                        │
```

---

## ✅ Avantages

1. **Pas de stockage BDD** - Slack stocke tout
2. **Organisateurs n'ont pas besoin de Slack** - Interface native dans l'app
3. **Support utilise Slack normalement** - Pas besoin de changer leurs habitudes
4. **Historique automatique** - Slack conserve tout
5. **Recherche Slack** - L'équipe peut rechercher dans Slack
6. **Notifications Slack** - L'équipe reçoit les notifications Slack habituelles
7. **Threads Slack** - Possibilité d'utiliser les threads par événement

---

## 🔧 Fonctionnement Technique

### Architecture

#### 1. **Frontend (React)**
- Interface chat dans l'application
- L'organisateur tape et envoie comme un chat normal
- Messages affichés en temps réel

#### 2. **Backend (API)**
- Reçoit les messages depuis le frontend
- Envoie les messages vers Slack via l'API Slack
- Lit les messages depuis Slack pour les afficher dans l'app
- Webhook Slack pour recevoir les nouveaux messages en temps réel

#### 3. **Slack**
- Canal dédié par événement (ex: `#support-event-2699f295`)
- Stocke tous les messages
- L'équipe support répond normalement depuis Slack
- Webhook envoie les nouveaux messages au backend

---

## 🔌 Intégration Slack

### Étape 1 : Créer une App Slack

1. Aller sur https://api.slack.com/apps
2. Créer une nouvelle app "FFA Timing Support"
3. Permissions nécessaires :
   - `chat:write` - Écrire des messages
   - `channels:read` - Lire les canaux
   - `channels:history` - Lire l'historique
   - `channels:join` - Rejoindre des canaux
   - `users:read` - Lire les infos utilisateurs

### Étape 2 : Webhook pour recevoir les messages

1. Créer un **Event Subscription** dans Slack
2. Event : `message.channels` - Écouter les messages dans les canaux
3. URL du webhook : `https://votre-api.com/api/slack/webhook`
4. Quand un message arrive sur Slack → webhook → backend → Socket.io → frontend

### Étape 3 : Canal par événement

- Création automatique d'un canal Slack par événement
- Format : `#support-event-{eventId}` ou `#support-{nom-evenement}`
- Le bot rejoint automatiquement le canal

---

## 📝 Flux de Données

### Envoi d'un message (Organisateur → Slack)

```
1. Organisateur tape et envoie dans l'app
   ↓
2. Frontend : POST /api/events/:eventId/chat/messages
   {
     message: "Bonjour, j'ai un problème...",
     user_id: "...",
     event_id: "..."
   }
   ↓
3. Backend :
   - Récupère les infos utilisateur (nom, email)
   - Envoie vers Slack via Slack API:
     chat.postMessage({
       channel: '#support-event-{eventId}',
       text: `*[${userName}]* ${message}`,
       username: userName,
       icon_emoji: ':rowing_boat:'
     })
   ↓
4. Slack : Message apparaît dans le canal
   ↓
5. Backend : Émet via Socket.io pour mettre à jour le frontend
   ↓
6. Frontend : Affiche le message en temps réel
```

### Réception d'un message (Slack → Organisateur)

```
1. Équipe support répond dans Slack
   ↓
2. Slack envoie un webhook au backend
   POST /api/slack/webhook
   {
     event: {
       type: 'message',
       channel: 'C123456',
       text: 'Je peux vous aider...',
       user: 'U987654'
     }
   }
   ↓
3. Backend :
   - Vérifie que c'est le bon canal (par event_id)
   - Récupère les infos de l'utilisateur Slack
   - Identifie si c'est un message de support ou organisateur
   ↓
4. Backend : Émet via Socket.io
   socket.emit('newChatMessage', {
     message: "...",
     user: { name: "Support Team", role: "support" },
     from_slack: true
   })
   ↓
5. Frontend : Affiche le message dans le chat
```

### Chargement de l'historique (Au démarrage)

```
1. Frontend : GET /api/events/:eventId/chat/messages
   ↓
2. Backend :
   - Identifie le canal Slack correspondant à l'événement
   - Récupère l'historique depuis Slack:
     conversations.history({
       channel: 'C123456',
       limit: 100
     })
   ↓
3. Backend : Transforme les messages Slack en format app
   - Enrichit avec les infos utilisateur
   - Identifie qui est organisateur vs support
   ↓
4. Frontend : Affiche l'historique
```

---

## 💻 Implémentation Backend

### Installation

```bash
npm install @slack/web-api @slack/events-api
```

### Code Backend (Exemple Node.js/Express)

```typescript
import { WebClient } from '@slack/web-api';
import { createEventAdapter } from '@slack/events-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackEvents = createEventAdapter(slackSigningSecret);

// Créer ou récupérer un canal Slack pour un événement
async function getOrCreateEventChannel(eventId: string, eventName: string) {
  const channelName = `support-event-${eventId.slice(0, 8)}`;
  
  try {
    // Chercher si le canal existe déjà
    const channels = await slack.conversations.list();
    const existingChannel = channels.channels?.find(
      ch => ch.name === channelName
    );
    
    if (existingChannel) {
      return existingChannel.id;
    }
    
    // Créer le canal
    const channel = await slack.conversations.create({
      name: channelName,
      is_private: false,
    });
    
    // Inviter le bot
    await slack.conversations.invite({
      channel: channel.channel?.id,
      users: process.env.SLACK_BOT_USER_ID,
    });
    
    // Message de bienvenue
    await slack.chat.postMessage({
      channel: channel.channel?.id,
      text: `*Canal de support créé pour l'événement : ${eventName}*\nLes organisateurs peuvent maintenant poser leurs questions ici.`,
    });
    
    return channel.channel?.id;
  } catch (error) {
    console.error('Erreur création canal Slack:', error);
    throw error;
  }
}

// Envoyer un message depuis l'app vers Slack
app.post('/api/events/:eventId/chat/messages', async (req, res) => {
  const { eventId } = req.params;
  const { message, user_id } = req.body;
  
  // Récupérer les infos utilisateur
  const user = await getUserById(user_id);
  const event = await getEventById(eventId);
  
  // Créer ou récupérer le canal Slack
  const channelId = await getOrCreateEventChannel(eventId, event.name);
  
  // Envoyer vers Slack
  const slackMessage = await slack.chat.postMessage({
    channel: channelId,
    text: message,
    username: `${user.name} (Organisateur)`,
    icon_emoji: ':rowing_boat:',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${user.name}* (${user.email})\n${message}`,
        },
      },
    ],
  });
  
  // Émettre via Socket.io pour mise à jour temps réel
  io.to(`event:${eventId}:chat`).emit('newChatMessage', {
    id: slackMessage.ts,
    message: message,
    user: {
      id: user_id,
      name: user.name,
      role: 'organiser',
    },
    created_at: new Date(),
    from_slack: false,
  });
  
  res.json({
    success: true,
    message_id: slackMessage.ts,
  });
});

// Webhook pour recevoir les messages depuis Slack
slackEvents.on('message', async (event) => {
  // Ignorer les messages du bot lui-même
  if (event.subtype === 'bot_message' || !event.user) {
    return;
  }
  
  // Vérifier si c'est un canal de support d'événement
  const channelName = await getChannelName(event.channel);
  if (!channelName.startsWith('support-event-')) {
    return;
  }
  
  // Extraire l'event_id du nom du canal
  const eventId = extractEventIdFromChannel(channelName);
  
  // Récupérer les infos de l'utilisateur Slack
  const slackUser = await slack.users.info({ user: event.user });
  
  // Vérifier si c'est l'équipe support ou un organisateur
  const isSupport = await isSupportTeamMember(event.user);
  
  // Émettre via Socket.io
  io.to(`event:${eventId}:chat`).emit('newChatMessage', {
    id: event.ts,
    message: event.text,
    user: {
      id: event.user,
      name: slackUser.user?.real_name || slackUser.user?.name,
      role: isSupport ? 'support' : 'organiser',
    },
    created_at: new Date(parseFloat(event.ts) * 1000),
    from_slack: true,
  });
});

// Récupérer l'historique depuis Slack
app.get('/api/events/:eventId/chat/messages', async (req, res) => {
  const { eventId } = req.params;
  const { limit = 100 } = req.query;
  
  // Récupérer le canal
  const channelId = await getChannelIdForEvent(eventId);
  if (!channelId) {
    return res.json({ messages: [] });
  }
  
  // Récupérer l'historique depuis Slack
  const result = await slack.conversations.history({
    channel: channelId,
    limit: parseInt(limit as string),
  });
  
  // Transformer les messages Slack en format app
  const messages = await Promise.all(
    (result.messages || []).map(async (msg) => {
      if (msg.bot_id || !msg.user) {
        return null; // Ignorer les messages du bot
      }
      
      const slackUser = await slack.users.info({ user: msg.user });
      const isSupport = await isSupportTeamMember(msg.user);
      
      return {
        id: msg.ts,
        message: msg.text || '',
        user: {
          id: msg.user,
          name: slackUser.user?.real_name || slackUser.user?.name,
          role: isSupport ? 'support' : 'organiser',
        },
        created_at: new Date(parseFloat(msg.ts || '0') * 1000),
        from_slack: true,
      };
    })
  );
  
  res.json({
    messages: messages.filter(Boolean).reverse(), // Plus ancien en premier
  });
});

// Attacher le webhook Slack
app.use('/api/slack/webhook', slackEvents.requestListener());
```

---

## 🎨 Interface Frontend

L'interface reste identique à l'option 1, mais les messages proviennent de Slack au lieu de la BDD.

### Distinction visuelle

- **Messages organisateurs** : Bleu, icône 🚣
- **Messages support** : Vert, icône 👨‍💻, badge "Support"

---

## 🔐 Sécurité

### Variables d'environnement nécessaires

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_BOT_USER_ID=U123456
SLACK_SUPPORT_TEAM_IDS=U987654,U123456,U456789
```

### Permissions

- Seuls les organisateurs peuvent envoyer des messages depuis l'app
- Le bot peut lire tous les messages du canal
- L'équipe support répond directement dans Slack

---

## ⚠️ Limitations et Points d'Attention

### Limitations Slack

1. **Rate Limits Slack API**
   - 1 message/seconde par défaut
   - Peut nécessiter une queue si beaucoup de messages

2. **Limite historique**
   - Slack conserve l'historique selon le plan (Free/Pro)
   - Messages très anciens peuvent disparaître

3. **Recherche**
   - La recherche dans l'app nécessite d'interroger Slack API
   - Moins performant qu'une BDD SQL

### Points d'attention

1. **Dépendance à Slack**
   - Si Slack est down, le chat ne fonctionne pas
   - Nécessite une gestion d'erreur

2. **Création de canaux**
   - Nombre limité de canaux publics (Free: 10k, Pro: illimité)
   - Suppression automatique des canaux après événement ?

3. **Coût Slack**
   - Plan Free : OK pour commencer
   - Si besoin de fonctionnalités avancées → Plan Pro

---

## 🆚 Comparaison : Slack vs BDD

| Critère | Slack (proposé) | BDD (option 1) |
|---------|-----------------|----------------|
| **Stockage** | Slack | MySQL |
| **Coût** | Gratuit (Free) ou ~7€/mois/user (Pro) | Gratuit (votre serveur) |
| **Organisateur a besoin Slack ?** | ❌ Non | ❌ Non |
| **Support utilise Slack ?** | ✅ Oui (normalement) | ❌ Non (dans l'app) |
| **Historique** | Dépend du plan Slack | Illimité |
| **Recherche** | Via Slack | SQL performant |
| **Dépendance** | Slack externe | Votre infrastructure |
| **Backup** | Géré par Slack | À faire vous-même |

---

## 💡 Recommandation

**Cette approche est excellente si :**
- ✅ Votre équipe support utilise déjà Slack
- ✅ Vous voulez éviter de gérer du stockage supplémentaire
- ✅ Vous acceptez la dépendance à Slack
- ✅ Vous avez un plan Slack (Free peut suffire pour commencer)

**Avantages clés :**
- Pas de développement de stockage BDD
- Support travaille dans Slack comme d'habitude
- Organisateurs n'ont pas besoin de Slack
- Historique géré par Slack

---

## 🚀 Plan d'Implémentation

### Phase 1 : Setup Slack (1-2 jours)
- ✅ Créer l'app Slack
- ✅ Configurer les permissions
- ✅ Setup webhook

### Phase 2 : Backend (2-3 jours)
- ✅ API pour envoyer vers Slack
- ✅ Webhook pour recevoir depuis Slack
- ✅ Récupération historique
- ✅ Socket.io pour temps réel

### Phase 3 : Frontend (2-3 jours)
- ✅ Interface chat
- ✅ Affichage messages
- ✅ Envoi messages
- ✅ Distinction support/organisateur

**Total : ~1 semaine**

---

## ❓ Questions à Valider

1. **Quel plan Slack utilisez-vous ?**
   - Free (10k messages d'historique)
   - Pro (historique illimité)

2. **Faut-il supprimer les canaux après l'événement ?**
   - Garder pour historique
   - Supprimer automatiquement après X jours

3. **Qui fait partie de l'équipe support ?**
   - Liste d'utilisateurs Slack à identifier automatiquement
   - Ou tous les utilisateurs d'un workspace Slack dédié ?

4. **Faut-il un canal par événement ou un canal global ?**
   - Recommandé : 1 canal par événement (plus organisé)
   - Alternative : 1 canal global avec threads par événement

---

## ✅ Conclusion

Cette approche **Slack comme stockage unique** est très pertinente :
- ✅ Simplifie l'architecture (pas de BDD chat)
- ✅ Support utilise ses outils habituels
- ✅ Organisateurs ont une interface simple
- ✅ Historique géré automatiquement

**Souhaitez-vous que je commence l'implémentation de cette solution ?**

