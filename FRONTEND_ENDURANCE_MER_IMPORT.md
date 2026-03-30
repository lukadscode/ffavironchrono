# Guide Frontend : Import résultats Endurance Mer (ENDURO / BRS)

Documentation pour intégrer dans le frontend l’**import des résultats** par fichier Excel (un fichier par événement) et l’**affichage du classement par club** pour les régates d’aviron de mer (ENDURO, Beach Rowing Sprint), selon la réglementation FFAviron 2026.

---

## 1. Vue d’ensemble

### 1.1 Objectif

- Permettre à l’utilisateur de **déposer un fichier Excel** de remontée des résultats (modèle FFAviron « Remontée résultats régates ») pour un **événement** déjà créé.
- Afficher les **résultats importés** (liste par épreuve / par club) et le **classement des clubs** (calculé à la volée avec les règles 2026 : barème, pondération, plafond 2 équipages par épreuve par club).

### 1.2 Parcours utilisateur type

1. L’utilisateur choisit un **événement** (liste ou détail d’événement).
2. Depuis la fiche ou la liste d’événements, il accède à la section **« Résultats Endurance Mer »** ou **« Import résultats ENDURO/BRS »**.
3. Il **sélectionne un fichier Excel** (.xlsx), optionnellement choisit le **format** (enduro / brs), le **niveau** (territorial / championnat de France) et coche **« Remplacer les résultats précédents »** si besoin.
4. Il lance l’**import**. L’API retourne le nombre de lignes importées et la liste des épreuves traitées.
5. Il peut consulter la **liste des résultats** (avec filtres épreuve / club) et le **classement par club** (tableau rang, club, points).

### 1.3 Points importants

- **Authentification** : l’**import** (POST) nécessite un **token JWT** ; la **lecture** des résultats et du classement (GET) peut rester publique.
- **Fichier** : un **seul fichier par événement**, au format **Excel (.xlsx)** fourni par la FFAviron (une feuille par épreuve : SF1X, SH1X, U19M2X, etc.).
- **Classement** : calculé **à la volée** par l’API (pas de stockage dans une table de classement) ; un simple appel GET suffit pour afficher le classement à jour.

---

## 2. Routes API à utiliser

Base URL des événements : **`/events/:eventId`** (remplacer `:eventId` par l’UUID de l’événement).

| Action | Méthode | URL | Auth |
|--------|--------|-----|------|
| Importer le fichier Excel | `POST` | `/events/:eventId/endurance-mer/import` | Oui |
| Récupérer les résultats importés | `GET` | `/events/:eventId/endurance-mer/import-results` | Non |
| Récupérer le classement par club | `GET` | `/events/:eventId/endurance-mer/ranking` | Non |

---

## 3. Détail des endpoints

### 3.1 Import du fichier Excel

**`POST /events/:eventId/endurance-mer/import`**

- **Authentification** : requise. Envoyer le token dans le header :  
  `Authorization: Bearer <token>`
- **Content-Type** : `multipart/form-data` (formulaire avec fichier).

**Paramètres du formulaire (form-data)** :

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `file` | Fichier | Oui | Fichier Excel `.xlsx` (remontée résultats FFAviron). |
| `event_format` | string | Non | `enduro` (défaut) ou `brs`. |
| `event_level` | string | Non | `territorial` (défaut) ou `championnat_france`. |
| `replace_previous` | string / boolean | Non | `true` pour supprimer les résultats déjà importés pour cet événement avant d’insérer les nouveaux. Sinon les nouvelles lignes s’ajoutent aux existantes. |

**Exemple de requête (JavaScript avec `FormData`)** :

```javascript
const eventId = "uuid-de-l-evenement";
const fileInput = document.querySelector('input[type="file"]');
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("event_format", "enduro");
formData.append("event_level", "territorial");
formData.append("replace_previous", "true");

const response = await fetch(`/api/events/${eventId}/endurance-mer/import`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    // Ne pas mettre Content-Type : le navigateur fixe multipart/form-data + boundary
  },
  body: formData,
});
```

**Réponse succès (201)** :

```json
{
  "status": "success",
  "message": "123 résultat(s) importé(s)",
  "data": {
    "event_id": "uuid-de-l-evenement",
    "inserted": 123,
    "epreuves": ["SF1X", "SH1X", "M40F1X", "SH2X", "U19M2X", "..."],
    "errors": []
  }
}
```

- `data.inserted` : nombre de lignes insérées en base.
- `data.epreuves` : liste des codes d’épreuves (feuilles) traitées.
- `data.errors` : tableau de messages d’erreur pour les lignes échouées (si vide, aucune erreur).

**Réponse erreur (400)** :

```json
{
  "status": "error",
  "message": "Fichier Excel requis (champ 'file')"
}
```

**Réponse erreur (404)** : événement introuvable (si `eventId` invalide).

**Réponse erreur (500)** : fichier Excel invalide ou erreur serveur (ex. `"Fichier Excel invalide : ..."`).

---

### 3.2 Liste des résultats importés

**`GET /events/:eventId/endurance-mer/import-results`**

- **Authentification** : non requise.
- **Query params (optionnels)** :
  - `epreuve_code` : filtrer par code d’épreuve (ex. `SF1X`, `U19M2X`).
  - `club_code` : filtrer par code club (ex. `C064027`).

**Exemples d’URL** :

- Tous les résultats :  
  `GET /events/uuid-evenement/endurance-mer/import-results`
- Filtrer par épreuve :  
  `GET /events/uuid-evenement/endurance-mer/import-results?epreuve_code=SF1X`
- Filtrer par club :  
  `GET /events/uuid-evenement/endurance-mer/import-results?club_code=C064027`

**Réponse succès (200)** :

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "event_id": "uuid-evenement",
      "epreuve_code": "SF1X",
      "epreuve_libelle": null,
      "place": 1,
      "club_code": "C064027",
      "club_name": "HENDAYE EAE",
      "crew_name": null,
      "time_raw": null,
      "time_seconds": null,
      "is_mixed_clubs": false,
      "club_codes_mixed": null,
      "points_attributed": "30.00",
      "event_format": "enduro",
      "event_level": "territorial",
      "partants_count": 10,
      "import_batch_id": "uuid",
      "created_at": "2026-03-19T12:00:00.000Z"
    }
  ]
}
```

Chaque élément du tableau contient au minimum : `epreuve_code`, `place`, `club_code`, `club_name`, `points_attributed`, `partants_count`. Utiliser ces champs pour afficher un tableau (avec filtres côté UI si besoin).

**Réponse erreur (404)** : événement introuvable.

---

### 3.3 Classement par club

**`GET /events/:eventId/endurance-mer/ranking`**

- **Authentification** : non requise.
- **Comportement** : l’API agrège les points par club, applique le plafond ENDURO (au plus 2 équipages par club et par épreuve), puis retourne les clubs triés par total de points décroissant avec un rang (1, 2, 3, …).

**Réponse succès (200)** :

```json
{
  "status": "success",
  "data": [
    { "club_code": "C064027", "club_name": "HENDAYE EAE", "total_points": 125.5, "rank": 1 },
    { "club_code": "C064021", "club_name": "ST-JEAN-DE-LUZ UR YOKO", "total_points": 98.25, "rank": 2 },
    { "club_code": "C035045", "club_name": "ST-MALO SNBSM", "total_points": 67.5, "rank": 3 }
  ]
}
```

Champs de chaque entrée : `club_code`, `club_name`, `total_points`, `rank`. Idéal pour un tableau « Classement » (Rang, Club, Points).

**Réponse erreur (404)** : événement introuvable.

---

## 4. Écrans et composants à prévoir

### 4.1 Où placer la fonctionnalité

- Dans la **fiche d’un événement** : onglet ou section **« Résultats Endurance Mer »** / **« Import ENDURO/BRS »**.
- Ou dans un **menu dédié** (ex. « Import résultats ») avec choix de l’événement en premier.

### 4.2 Bloc « Import »

- **Sélection de fichier** : input `type="file"` acceptant `.xlsx` (et éventuellement `.xls`).
- **Options** :
  - **Format** : liste ou boutons `Enduro` / `BRS` (valeur envoyée : `event_format`).
  - **Niveau** : liste ou boutons `Territorial` / `Championnat de France` (valeur : `event_level`).
  - **Case à cocher** : « Remplacer les résultats déjà importés » → `replace_previous=true` si cochée.
- **Bouton** : « Importer » (désactivé tant qu’aucun fichier n’est choisi). Au clic : envoi du `FormData` vers `POST .../endurance-mer/import`.
- **États** :
  - **Chargement** : pendant l’appel API (spinner ou désactivation du bouton).
  - **Succès** : message du type « X résultat(s) importé(s) » + éventuellement liste des épreuves traitées ; afficher `data.errors` s’il y a des erreurs partielles.
  - **Erreur** : afficher `message` retourné par l’API (400, 404, 500).

### 4.3 Bloc « Résultats importés »

- **Bouton ou lien** : « Voir les résultats » ou chargement automatique après import réussi.
- **Appel** : `GET .../endurance-mer/import-results` (avec ou sans `epreuve_code` / `club_code`).
- **Affichage** : tableau avec colonnes par exemple : **Épreuve**, **Place**, **Code club**, **Nom club**, **Points**. Filtres optionnels (liste déroulante épreuve, champ recherche club) en refaisant l’appel avec les query params.

### 4.4 Bloc « Classement par club »

- **Appel** : `GET .../endurance-mer/ranking`.
- **Affichage** : tableau avec colonnes **Rang**, **Club** (nom et/ou code), **Points**. Pas de pagination nécessaire si le nombre de clubs reste raisonnable ; sinon paginer ou limiter côté front.

---

## 5. Exemples de code (fetch / axios)

### 5.1 Import (POST avec FormData)

```javascript
async function importEnduranceMerFile(eventId, file, options = {}) {
  const { event_format = "enduro", event_level = "territorial", replace_previous = false } = options;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("event_format", event_format);
  formData.append("event_level", event_level);
  formData.append("replace_previous", replace_previous);

  const res = await fetch(`${API_BASE}/events/${eventId}/endurance-mer/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Erreur import");
  return json.data;
}
```

### 5.2 Récupérer les résultats (GET avec filtres optionnels)

```javascript
async function getEnduranceMerResults(eventId, filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const url = `${API_BASE}/events/${eventId}/endurance-mer/import-results${params ? `?${params}` : ""}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Erreur chargement résultats");
  return json.data;
}

// Exemples d’appel :
// getEnduranceMerResults(eventId)
// getEnduranceMerResults(eventId, { epreuve_code: "SF1X" })
// getEnduranceMerResults(eventId, { club_code: "C064027" })
```

### 5.3 Récupérer le classement (GET)

```javascript
async function getEnduranceMerRanking(eventId) {
  const res = await fetch(`${API_BASE}/events/${eventId}/endurance-mer/ranking`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Erreur chargement classement");
  return json.data;
}
```

---

## 6. Validation et gestion d’erreurs côté frontend

### 6.1 Avant l’import

- Vérifier qu’un **fichier** est bien sélectionné.
- Vérifier l’**extension** (`.xlsx` ou `.xls`) si vous restreignez les types.
- Vérifier que l’**événement** est bien sélectionné (eventId non vide).

### 6.2 Messages d’erreur API à gérer

| Code HTTP | Message type | Action côté front |
|-----------|--------------|-------------------|
| 400 | `Fichier Excel requis (champ 'file')` | Afficher « Veuillez sélectionner un fichier Excel ». |
| 401 | Non authentifié | Rediriger vers la connexion ou afficher « Session expirée ». |
| 404 | Événement introuvable | Afficher « Événement introuvable » / retour à la liste. |
| 500 | `Fichier Excel invalide : ...` | Afficher le message et indiquer d’utiliser le modèle FFAviron. |
| 500 | Autre | Afficher un message générique et éventuellement les détails en mode debug. |

### 6.3 Après import réussi

- Si `data.errors.length > 0` : afficher un encart « Import terminé avec X erreur(s) » et lister les messages (ou un résumé).
- Rafraîchir (ou charger) la **liste des résultats** et le **classement** pour que l’utilisateur voie immédiatement le résultat.

---

## 7. Structure du fichier Excel attendu (rappel)

Pour informer l’utilisateur ou afficher une aide :

- **Un fichier par événement**, au format **Excel (.xlsx)** du type « Remontée résultats régates » FFAviron.
- **Une feuille par épreuve** : le **nom de la feuille** = code épreuve (ex. `SF1X`, `SH1X`, `U19M2X`, `U17F4X+`). La feuille « Organisateur » est ignorée.
- **Colonnes** (feuilles standard) : **Classement** (place), **Code Club**, **NOM CLUB**. À partir de la 6ᵉ ligne : les données.
- Pour les **feuilles U17** (équipages mixtes) : colonnes supplémentaires (Code Club 2, nombre d’équipiers par club). Les points sont gérés côté API.

Vous pouvez proposer un **lien de téléchargement** vers le modèle officiel FFAviron s’il est disponible.

---

## 8. Récapitulatif des données à afficher

### 8.1 Tableau « Résultats importés »

| Colonne | Source API |
|---------|------------|
| Épreuve | `epreuve_code` |
| Place | `place` |
| Code club | `club_code` |
| Nom club | `club_name` |
| Points | `points_attributed` |
| Partants | `partants_count` (optionnel) |

Filtres utiles : **Épreuve** (liste dérivée de `epreuve_code` distincts), **Club** (recherche sur `club_code` ou `club_name`).

### 8.2 Tableau « Classement par club »

| Colonne | Source API |
|---------|------------|
| Rang | `rank` |
| Club | `club_name` (et/ou `club_code`) |
| Points | `total_points` |

Tri : déjà fait par l’API (ordre décroissant des points, rang 1, 2, 3…).

---

## 9. Voir aussi

- **API (backend)** : `docs/API_ENDURANCE_MER_IMPORT.md`
- **Règles et barèmes complets** : `docs/IMPORT_RESULTATS_EXCEL_ENDURANCE_MER_2026.md`
