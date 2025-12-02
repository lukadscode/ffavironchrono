# 💬 Proposition : Système de Chat en Direct pour Organisateurs

## 📋 Contexte et Besoins

Actuellement, les organisateurs d'événements d'aviron ont besoin d'un moyen de communication en temps réel avec l'équipe technique/support pour :
- Poser des questions techniques pendant un événement
- Signaler des problèmes urgents
- Demander de l'aide pour utiliser certaines fonctionnalités
- Coordonner avec l'équipe support qui peut être sur Slack

## 🎯 Objectifs

1. **Chat en temps réel** accessible uniquement aux organisateurs et responsables techniques
2. **Intégration avec Slack** (optionnel) pour que l'équipe support puisse répondre depuis Slack
3. **Historique des conversations** par événement
4. **Notifications** pour les nouveaux messages
5. **Interface simple et intuitive** intégrée dans l'application

## 🔧 Options Techniques

### Option 1 : Socket.io Natif (Recommandé) ⭐

**Avantages :**
- ✅ Infrastructure WebSocket déjà en place (Socket.io installé et configuré)
- ✅ Pas de coût supplémentaire
- ✅ Contrôle total sur les fonctionnalités
- ✅ Données hébergées sur votre serveur
- ✅ Intégration facile avec l'authentification existante

**Inconvénients :**
- ⚠️ Nécessite développement backend pour la persistance des messages
- ⚠️ Pas d'intégration Slack native (nécessiterait un bot Slack personnalisé)

**Fonctionnalités proposées :**
- Chat par événement (chaque événement = un canal de discussion)
- Support multi-utilisateurs (plusieurs organisateurs peuvent discuter)
- Distinction visuelle entre organisateurs et responsables techniques
- Messages en temps réel
- Historique des conversations sauvegardé en base de données
- Indicateurs de présence (en ligne/hors ligne)
- Notifications sonores optionnelles

**Coût de développement :**
- Frontend : ~2-3 jours
- Backend (API + Socket.io) : ~3-4 jours
- Intégration Slack (optionnel) : ~2-3 jours supplémentaires

---

### Option 2 : Solution Tierce (Pusher, Ably, Stream Chat)

**Avantages :**
- ✅ Infrastructure gérée (pas de maintenance serveur)
- ✅ Fonctionnalités avancées (typing indicators, reactions, etc.)
- ✅ Évolutif facilement
- ✅ Intégrations tierces disponibles

**Inconvénients :**
- ⚠️ Coût mensuel (entre 49€/mois et plusieurs centaines selon usage)
- ⚠️ Dépendance à un service externe
- ⚠️ Moins de contrôle sur les données

**Exemples :**
- **Pusher Chatkit** : ~49-99€/mois
- **Stream Chat** : ~99-499€/mois (fonctionnalités avancées)
- **Ably Chat** : ~49€/mois

---

### Option 3 : Intégration Slack Directe

**Avantages :**
- ✅ Équipe support déjà sur Slack
- ✅ Pas besoin de nouvelle interface
- ✅ Fonctionnalités Slack complètes (threads, réactions, etc.)

**Inconvénients :**
- ⚠️ Les organisateurs doivent avoir Slack installé
- ⚠️ Nécessite un bot Slack et configuration workspace
- ⚠️ Moins intégré dans l'application

**Fonctionnement proposé :**
- Création automatique d'un canal Slack par événement
- Lien Slack intégré dans l'interface organisateur
- Bot Slack qui synchronise avec l'application

---

### Option 4 : Solution Hybride (Slack + Chat Natif)

**Fonctionnement :**
- Chat natif dans l'application pour les organisateurs
- Synchronisation bidirectionnelle avec un canal Slack dédié
- L'équipe support répond depuis Slack
- Les messages Slack apparaissent dans l'application

**Avantages :**
- ✅ Meilleur des deux mondes
- ✅ Organisateurs : interface simple dans l'app
- ✅ Support : utilise Slack comme d'habitude

**Inconvénients :**
- ⚠️ Plus complexe à développer
- ⚠️ Nécessite bot Slack + backend de synchronisation

---

## 🎨 Design de l'Interface (Option 1 - Socket.io Natif)

### Composants proposés :

1. **Widget Chat flottant** (coin inférieur droit)
   - Badge avec nombre de messages non lus
   - Icône de chat qui s'ouvre en modal/fenêtre

2. **Fenêtre de chat principale**
   - Zone de messages avec scroll automatique
   - Distinction visuelle des utilisateurs (avatar, nom, rôle)
   - Distinction organisateurs (bleu) / support technique (vert)
   - Zone de saisie avec bouton envoyer
   - Indicateur "en train de taper..."

3. **Page dédiée `/event/:eventId/support-chat`** (optionnel)
   - Chat en pleine page
   - Historique complet
   - Paramètres (notifications, etc.)

### Exemple de structure :

```
┌─────────────────────────────────────┐
│  Support Technique - Événement XYZ  │
├─────────────────────────────────────┤
│                                     │
│  [Support] Bonjour, comment puis-   │
│           je vous aider ?           │
│           ─ 14:32                   │
│                                     │
│                    [Vous] J'ai un   │
│                    problème avec... │
│                    ─ 14:35          │
│                                     │
│  [Support] Pouvez-vous me donner... │
│           ─ 14:36                   │
│                                     │
├─────────────────────────────────────┤
│  Tapez votre message...          [📤]│
└─────────────────────────────────────┘
```

---

## 🔐 Sécurité et Permissions

### Accès au chat :
- ✅ **Organisateurs** d'événements : peuvent voir et envoyer des messages
- ✅ **Responsables techniques** (admin/superadmin) : peuvent répondre depuis l'app
- ✅ **Support Slack** : peut répondre via Slack (si intégration)
- ❌ **Editeurs/Referees/Timing** : pas d'accès au chat (uniquement organisateurs)

### Données stockées :
- Messages sauvegardés en base de données
- Association message ↔ événement
- Association message ↔ utilisateur
- Timestamps pour historique

---

## 📦 Implémentation Technique (Option 1)

### Frontend :

**Nouveaux composants :**
- `src/components/chat/ChatWidget.tsx` - Widget flottant
- `src/components/chat/ChatWindow.tsx` - Fenêtre de chat principale
- `src/components/chat/ChatMessage.tsx` - Composant message individuel
- `src/components/chat/ChatInput.tsx` - Zone de saisie
- `src/hooks/useEventChat.ts` - Hook personnalisé pour la logique chat

**Nouvelle page (optionnel) :**
- `src/pages/event/SupportChatPage.tsx`

**Mise à jour du socket :**
- Extension de `src/lib/socket.ts` pour gérer les événements chat

### Backend (à développer) :

**Nouvelles routes API :**
```
GET    /api/events/:eventId/chat/messages     - Récupérer l'historique
POST   /api/events/:eventId/chat/messages     - Envoyer un message
GET    /api/events/:eventId/chat/participants - Liste des participants
```

**Nouveaux événements Socket.io :**
```
joinEventChat          - Rejoindre le chat d'un événement
leaveEventChat         - Quitter le chat
chatMessage            - Nouveau message reçu
typing                 - Indicateur de frappe
userOnline             - Utilisateur en ligne
userOffline            - Utilisateur hors ligne
```

**Nouvelle table base de données :**
```sql
CREATE TABLE event_chat_messages (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  read_by JSONB DEFAULT '[]' -- Liste des user_ids qui ont lu
);
```

---

## 📅 Plan d'Implémentation

### Phase 1 : Chat Natif de Base (1 semaine)
- ✅ Backend API pour messages
- ✅ Socket.io pour temps réel
- ✅ Widget chat frontend
- ✅ Historique basique

### Phase 2 : Améliorations UX (3-4 jours)
- ✅ Indicateurs de présence
- ✅ Indicateur "en train de taper"
- ✅ Notifications
- ✅ Badge messages non lus

### Phase 3 : Intégration Slack (optionnel - 1 semaine)
- ✅ Bot Slack
- ✅ Synchronisation bidirectionnelle
- ✅ Configuration workspace

---

## 💡 Recommandation Finale

**Je recommande l'Option 1 (Socket.io Natif) avec intégration Slack optionnelle :**

1. **Avantage coût** : Pas de coût mensuel récurrent
2. **Contrôle** : Contrôle total sur les données et fonctionnalités
3. **Infrastructure existante** : Socket.io déjà installé
4. **Évolutif** : Peut ajouter Slack plus tard si besoin

**Plan d'action suggéré :**
- Commencer par le chat natif (Phase 1 + Phase 2)
- Tester avec les organisateurs
- Ajouter Slack plus tard si nécessaire (Phase 3)

---

## ❓ Questions à Valider

1. **Le chat doit-il être accessible uniquement pendant l'événement ou aussi avant/après ?**
   - Pendant l'événement uniquement ? ✅
   - Aussi en amont/préparation ? 🤔
   - Aussi après pour suivi/post-mortem ? 🤔

2. **Faut-il une intégration Slack dès le départ ou on commence sans ?**
   - Chat natif d'abord, Slack plus tard ? ✅ (recommandé)
   - Slack dès le départ ? 🤔

3. **Qui peut accéder au chat côté support ?**
   - Uniquement admin/superadmin ? ✅
   - Un rôle spécifique "support" à créer ? 🤔

4. **Faut-il limiter le nombre de messages par événement ?**
   - Non, illimité ? ✅
   - Limite (ex: 1000 messages) ? 🤔

---

## 🚀 Prochaines Étapes

Une fois cette proposition validée, je pourrai :
1. Créer les composants frontend du chat
2. Définir précisément les endpoints backend nécessaires
3. Implémenter la logique Socket.io
4. Tester et itérer selon vos retours

**Souhaitez-vous que je commence l'implémentation de l'Option 1, ou préférez-vous discuter d'abord des options ?**

