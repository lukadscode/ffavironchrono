## Spécification – Import de participants et équipages par fichier (CSV / Excel)

Objectif : permettre à un organisateur d’un événement d’importer en masse des **participants** et leurs **équipages** à partir d’un fichier (CSV ou Excel), avec :

- création / mise à jour des participants,
- création / mise à jour des équipages,
- affectation automatique des participants aux équipages et catégories,
- un **modèle Excel** avec un 2ᵉ onglet listant les catégories disponibles pour l’événement.

---

## 1. Modèle de fichier (CSV / Excel)

### 1.1. Principe général

- Le fichier représente des **équipages** et leurs **participants**.
- **1 ligne = 1 participant dans un équipage** donné.
- Tous les champs sont sur une même ligne (pas de header multi‑ligne).
- Pour Excel, on utilise un classeur avec :
  - **Onglet 1** : `Participants` → utilisé pour l’import.
  - **Onglet 2** : `Categories` → liste de référence des catégories pour l’événement (lecture seule pour l’utilisateur).

### 1.2. Onglet 1 – `Participants`

Nom des colonnes et rôle :

- **Colonnes obligatoires**
  - `category_code`  
    - Code de catégorie, doit correspondre à une catégorie de l’événement (voir onglet `Categories`).
    - Exemple : `J18H2x`, `SH4-`, etc.
  - `club_name`  
    - Nom du club de l’équipage.
  - `seat_position`  
    - Numéro de place dans le bateau : 1, 2, 3, …  
  - `is_coxswain`  
    - `0/1` ou `true/false` (ou `oui/non` – à normaliser côté back).
  - `participant_first_name`
  - `participant_last_name`

- **Colonnes fortement recommandées**
  - `club_code`  
    - Code court du club (permet de matcher plus sûrement le club existant).
  - `participant_license_number`  
    - Numéro de licence FFA (clé principale pour retrouver un participant existant).

- **Colonnes optionnelles**
  - `crew_external_id`  
    - Identifiant texte de l'équipage dans le fichier (permet de regrouper manuellement les lignes).
    - Exemple : `Bateau 1`, `EQUIPAGE-001`, etc.
    - Toutes les lignes avec le même `crew_external_id` décrivent **le même équipage**.
    - **Si absent** : le système génère automatiquement un ID basé sur `category_code + club_name + numéro séquentiel`.
  - `participant_gender`
  - `participant_email`
  - `participant_club_name`  
    - Si différent de `club_name` (cas de prêts entre clubs).
  - `temps_pronostique`  
    - Temps pronostique (en secondes ou dans un format clair, à définir : ex. `mm:ss` → converti en secondes).

### 1.3. Onglet 2 – `Categories`

Rempli **automatiquement** par le backend dans le template :

- Colonnes proposées :
  - `code`
  - `label`
  - `age_group`
  - `gender`
  - éventuellement `boat_seats`, `has_coxswain`
- Contenu :
  - toutes les catégories configurées pour l’événement (`/categories/event/:event_id`), en lecture seule.

Cet onglet sert uniquement d’aide à la saisie pour l’utilisateur.  
**L’import ne lit que l’onglet `Participants`.**

---

## 2. Comportement métier lors de l’import

### 2.1. Résolution des clubs

- Si `club_code` est présent :
  - on tente d’identifier un club existant par `club_code`.
  - si non trouvé, on peut :
    - soit créer un “club libre” (si feature existante),
    - soit marquer la ligne en erreur (préférable pour éviter les doublons).
- Sinon, on essaie de matcher sur `club_name` (tolérant, insensible à la casse).

### 2.2. Résolution des catégories

- `category_code` doit correspondre à une catégorie de l’événement :
  - recherche sur `code` (exact, insensible à la casse).
  - si non trouvé → ligne en erreur.

### 2.3. Résolution / création des participants

Pour chaque ligne :

1. Si `participant_license_number` est fourni :
   - on cherche un participant de l’événement avec ce numéro.
   - si trouvé → on réutilise ce participant.
2. Sinon :
   - on peut chercher un participant par `(first_name, last_name, club_name)` (optionnel, en mode tolérant).
3. Si aucun participant correspondant n’est trouvé :
   - on **crée** un nouveau participant avec les informations :
     - `first_name`, `last_name`, `license_number`, `club_name` / `participant_club_name`, `gender`, `email`.

### 2.4. Création / mise à jour des équipages

Les lignes sont regroupées par :

- Si `crew_external_id` est présent : regroupement par `crew_external_id` (toutes les lignes avec le même ID = même équipage).
- Si `crew_external_id` est absent : regroupement automatique par **ordre séquentiel de `seat_position`** :
  - Les lignes consécutives avec des `seat_position` qui se suivent (1, 2, 3, ...) forment un équipage.
  - Un nouvel équipage commence quand `seat_position` revient à `1` ou quand `category_code` change.
  - **Note :** Le `club_name` et `club_code` ne sont **pas** utilisés pour le regroupement automatique.

Pour chaque groupe :

- On cherche s’il existe déjà un équipage dans l’événement correspondant à ce trio :
  - **Mode `create_only`** :
    - si l’équipage existe déjà → le groupe est ignoré ou marqué en erreur (à préciser dans la réponse).
    - sinon → on crée un **nouvel équipage** avec :
      - `event_id`
      - `category_id` (résolue via `category_code`)
      - `club_name`, `club_code`
      - `status` = `registered`
      - `temps_pronostique` si fourni.
  - **Mode `update_or_create`** :
    - si l’équipage existe :
      - on peut remplacer les participants (delete + recreate les `crew_participants`),
      - ou fusionner intelligemment (optionnel, première version = remplacement).
    - si l’équipage n’existe pas → on crée un nouvel équipage comme ci‑dessus.

### 2.5. Résumé / rapport d’import

L’API renvoie un **rapport détaillé**, par exemple :

```json
{
  "status": "success",
  "summary": {
    "rows_total": 123,
    "crews_created": 10,
    "crews_updated": 2,
    "participants_created": 45,
    "participants_matched": 78
  },
  "errors": [
    {
      "row": 5,
      "message": "Category code 'XYZ' not found"
    },
    {
      "row": 12,
      "message": "Missing required field: participant_last_name"
    }
  ]
}
```

En cas d’erreur bloquante (fichier illisible, colonnes manquantes, etc.), on peut renvoyer `status: "error"` avec une explication globale.

---

## 3. API backend à implémenter

### 3.1. Importer un fichier (CSV / Excel)

- **Route**
  - `POST /events/:event_id/import-participants`
- **Payload**
  - `multipart/form-data` avec :
    - champ `file` : le fichier `.csv` ou `.xlsx`,
    - champ optionnel `mode` : `"create_only"` (défaut) ou `"update_or_create"`,
    - champ optionnel `dry_run`: `true/false` (pour tester sans rien écrire en base).
- **Comportement**
  - Lit uniquement l’onglet `Participants` (pour Excel).
  - Parse et valide chaque ligne.
  - Regroupe par équipage (`crew_external_id` + `category_code` + club).
  - Applique les règles business ci‑dessus.
  - Si `dry_run = true` :
    - ne fait aucune écriture en base,
    - renvoie uniquement le rapport simulé.
  - Sinon :
    - utilise des transactions pour éviter les états partiels,
    - renvoie le rapport final.

---

## 4. Intégration front‑end à prévoir

### 4.1. Nouvelle page d’import

- **Route front** (proposition)
  - `/event/:eventId/import-participants`
- **Accès**
  - Liens/boutons depuis :
    - la page `Participants` (`/event/:eventId/participants`),
    - éventuellement la page `Équipages` (`/event/:eventId/crews`).
- **Rôle requis**
  - même policy que la gestion des participants/équipages : `["organiser", "editor"]`.

### 4.2. Comportement UI attendu

Sur la page d’import :

1. **Téléchargement du template**
   - Bouton : « Télécharger le modèle Excel ».
   - Génération **côté front** en utilisant la librairie Excel déjà présente (par ex. `xlsx`) :
     - appel à `GET /categories/event/:eventId/with-crews` pour récupérer la liste des catégories,
     - création d’un classeur avec l’onglet `Participants` (en‑têtes + quelques lignes d’exemple) et l’onglet `Categories` rempli avec la réponse,
     - téléchargement local du `.xlsx`.
2. **Upload du fichier**
   - Zone de drop / bouton « Choisir un fichier » (CSV ou XLSX).
   - Champ pour choisir :
     - `Mode` : `Créer uniquement` / `Créer ou mettre à jour`.
     - `Simulation (dry‑run)` : oui/non.
   - Bouton « Lancer l’import » :
     - `POST /events/:event_id/import-participants` avec `file`, `mode`, `dry_run`.
3. **Affichage du rapport**
   - Résumé des compteurs (`rows_total`, `crews_created`, `crews_updated`, `participants_created`, `participants_matched`).
   - Liste des erreurs par ligne (table ou liste).
   - Messages de succès / erreur via toasts.

---

## 5. Résumé rapide pour l’équipe backend

1. **Endpoints**
   - `POST /events/:event_id/import-participants` (multipart) → lit CSV/XLSX, applique les règles de résolutions clubs/catégories/participants/équipages, renvoie un rapport détaillé.
2. **Business**
   - 1 ligne = 1 participant dans un équipage.
   - Groupement par `crew_external_id + category_code + club`.
   - Matching participant principalement par `participant_license_number`.
   - Modes `create_only` et `update_or_create`, avec option `dry_run`.
3. **Sortie**
   - Toujours un JSON avec `status`, `summary`, `errors` (liste des lignes en erreur).

