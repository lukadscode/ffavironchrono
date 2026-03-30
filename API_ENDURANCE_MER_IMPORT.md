# API Import résultats Endurance Mer (ENDURO / BRS) – Guide technique

Ce document décrit l’implémentation de l’import des résultats par fichier Excel (un fichier par événement) et la récupération du classement par club **calculé à la volée** à partir de la table `endurance_mer_import_results`. La réglementation sportive 2026 (classement mer des clubs) est appliquée pour le barème et la pondération.

---

## 1. Prérequis

### 1.1 Migration base de données

Exécuter la migration qui crée la table des résultats importés :

```bash
# Exemple avec client MySQL/MariaDB
mysql -u ... -p ... < docs/migrations/009_create_endurance_mer_import_results.sql
```

Ou exécuter le contenu de `docs/migrations/009_create_endurance_mer_import_results.sql` dans votre outil SQL.

### 1.2 Événement existant

L’événement doit déjà exister en base (`events`). L’import associe les lignes du fichier à un `event_id` fourni dans l’URL.

---

## 2. Endpoints API

Base : `/events/:eventId/...`

### 2.1 Import du fichier Excel

**`POST /events/:eventId/endurance-mer/import`**

- **Authentification** : requise (middleware `auth`).
- **Content-Type** : `multipart/form-data`.
- **Corps** :
  - `file` (obligatoire) : fichier Excel `.xlsx` (remontée résultats FFAviron, une feuille par épreuve).
  - `event_format` (optionnel) : `enduro` (défaut) ou `brs`.
  - `event_level` (optionnel) : `territorial` (défaut) ou `championnat_france`.
  - `replace_previous` (optionnel) : `true` pour supprimer les résultats déjà importés pour cet événement avant d’insérer les nouveaux.

**Exemple (curl)** :

```bash
curl -X POST "http://localhost:3000/events/VOTRE_EVENT_ID/endurance-mer/import" \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -F "file=@FFaviron-ENDURO-2026-RemonteeResultats_Regates_aviron_la_rochelle.xlsx" \
  -F "event_format=enduro" \
  -F "event_level=territorial" \
  -F "replace_previous=true"
```

**Réponse succès (201)** :

```json
{
  "status": "success",
  "message": "123 résultat(s) importé(s)",
  "data": {
    "event_id": "...",
    "inserted": 123,
    "epreuves": ["SF1X", "SH1X", "M40F1X", ...],
    "errors": []
  }
}
```

Si certaines lignes ont échoué, elles sont listées dans `data.errors`.

---

### 2.2 Liste des résultats importés

**`GET /events/:eventId/endurance-mer/import-results`**

- **Authentification** : non requise (lecture publique).
- **Query** (optionnel) :
  - `epreuve_code` : filtrer par code d’épreuve (ex. `SF1X`).
  - `club_code` : filtrer par code club.

**Exemple** :

```bash
GET /events/VOTRE_EVENT_ID/endurance-mer/import-results
GET /events/VOTRE_EVENT_ID/endurance-mer/import-results?epreuve_code=SF1X
```

**Réponse** : tableau d’objets avec `event_id`, `epreuve_code`, `place`, `club_code`, `club_name`, `points_attributed`, `event_format`, `event_level`, `partants_count`, etc.

---

### 2.3 Classement par club (calcul à la volée)

**`GET /events/:eventId/endurance-mer/ranking`**

- **Authentification** : non requise.
- **Comportement** : agrège les points par club à partir de `endurance_mer_import_results`, applique le **plafond ENDURO** (au plus 2 équipages par club et par épreuve, ceux qui rapportent le plus de points), puis trie par total décroissant et attribue le rang.

**Réponse** :

```json
{
  "status": "success",
  "data": [
    { "club_code": "C064027", "club_name": "HENDAYE EAE", "total_points": 125.5, "rank": 1 },
    { "club_code": "C064021", "club_name": "ST-JEAN-DE-LUZ UR YOKO", "total_points": 98.25, "rank": 2 }
  ]
}
```

---

## 3. Structure du fichier Excel attendu

- **Une feuille par épreuve** : nom de la feuille = code épreuve (ex. `SF1X`, `SH1X`, `U19M2X`, `U17F4X+`). La feuille `Organisateur` est ignorée.
- **Feuilles « simples »** (ex. SF1X, SH1X) :
  - Lignes 1–3 : en-tête (titre, nom épreuve).
  - Ligne 4 : en-têtes de colonnes = **Classement**, **Code Club**, **NOM CLUB**.
  - Ligne 5 : ligne d’exemple (Ex., C000000, …).
  - À partir de la ligne 6 : une ligne par résultat (Place, Code club, Nom club).
- **Feuilles U17** (U17F4X+, U17H4X+, U17M4X+) :
  - Une ligne d’en-tête en plus (notes MIXTE).
  - Ligne 5 : **Classement**, **Code Club 1\***, **NOM CLUB**, **Code Club 2\***, **NOM CLUB**, **Club 1**, **Club 2** (nombre d’équipiers pour répartition).
  - Ligne 6 : exemple.
  - À partir de la ligne 7 : données. Pour équipages mixtes, Code Club 1 peut être `MIXTE` et Code Club 2 / Club 1 / Club 2 renseignés pour la répartition.

Les points sont calculés côté serveur avec le barème ENDURO territorial (et pondération &lt; 7 partants = 75 %) pour chaque ligne, puis enregistrés dans `points_attributed`.

---

## 4. Règles de calcul (côté serveur)

- **Barème** : voir `src/constants/enduranceMerBaremes.js` (table ENDURO 1x, 2x, 4x+ Senior, 2x U19, 4x+ U17/U19).
- **Pondération** : moins de 7 partants dans l’épreuve → 75 % des points ; à partir de 7 → 100 %. Les points sont arrondis au centième.
- **Classement (ranking)** : pour chaque club et chaque épreuve, seuls les **deux équipages** ayant rapporté le plus de points sont comptés ; les totaux par club sont ensuite sommés et triés pour obtenir le rang.

Équipages mixtes : les lignes sont importées avec `is_mixed_clubs` et `club_codes_mixed` ; la répartition prorata entre clubs peut être ajoutée ultérieurement dans le calcul du classement si besoin.

---

## 5. Fichiers implémentés

| Fichier | Rôle |
|--------|------|
| `docs/migrations/009_create_endurance_mer_import_results.sql` | Création de la table. |
| `src/models/EnduranceMerImportResult.js` | Modèle Sequelize. |
| `src/constants/enduranceMerBaremes.js` | Barèmes ENDURO (et BRS), pondération, mapping code épreuve → colonne. |
| `src/services/importEnduranceMerResults.js` | Lecture Excel, extraction des lignes par feuille, calcul des points, insertion en base ; calcul du classement à la volée avec plafond 2 équipages/épreuve/club. |
| `src/controllers/enduranceMerController.js` | Import, liste des résultats, classement. |
| `src/routes/eventRoutes.js` | Routes sous `/:eventId/endurance-mer/...`. |
| `src/models/relations.js` | Relation `Event hasMany EnduranceMerImportResult`. |

---

## 6. Voir aussi

- **Guide frontend** : `docs/FRONTEND_ENDURANCE_MER_IMPORT.md` (parcours utilisateur, écrans, exemples de code fetch/axios, validation, affichage des tableaux).
- **Règles complètes et barèmes** : `docs/IMPORT_RESULTATS_EXCEL_ENDURANCE_MER_2026.md` (structure Excel, barèmes BRS / Championnats de France, plafonds, équipages mixtes, etc.).
