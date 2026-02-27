# Modifications API - Import de participants (crew_external_id optionnel)

## Résumé des changements

Le champ `crew_external_id` est maintenant **optionnel** dans le fichier d'import. Si absent, le système doit regrouper automatiquement les participants en équipages.

---

## 1. Logique de regroupement automatique

### 1.1. Si `crew_external_id` est présent

Comportement inchangé : toutes les lignes avec le même `crew_external_id` forment un équipage.

### 1.2. Si `crew_external_id` est absent ou vide

**Nouvelle logique de regroupement automatique :**

Les participants sont regroupés en équipages **uniquement selon l'ordre séquentiel de `seat_position`** :

- **Règle principale** : Les lignes consécutives avec des `seat_position` qui se suivent (1, 2, 3, ...) forment un équipage.
- **Début d'un nouvel équipage** : Quand `seat_position` revient à `1` (ou commence à `1` après une interruption).
- **Fin d'un équipage** : Quand `seat_position` revient à `1` ou quand on change de `category_code`.

**Exemple :**
```
Ligne 1: category_code=J18H2x, seat_position=1, participant=Jean, club=Club A
Ligne 2: category_code=J18H2x, seat_position=2, participant=Pierre, club=Club A
Ligne 3: category_code=J18H2x, seat_position=3, participant=Paul, club=Club A
Ligne 4: category_code=J18H2x, seat_position=1, participant=Marie, club=Club B  ← Nouvel équipage (seat_position revient à 1)
Ligne 5: category_code=J18H2x, seat_position=2, participant=Julie, club=Club B
Ligne 6: category_code=SH4-, seat_position=1, participant=Marc, club=Club A     ← Nouvel équipage (changement de catégorie)
```

Dans cet exemple :
- Équipage 1 : Jean (seat 1, Club A), Pierre (seat 2, Club A), Paul (seat 3, Club A)
- Équipage 2 : Marie (seat 1, Club B), Julie (seat 2, Club B)
- Équipage 3 : Marc (seat 1, Club A)

**Points importants :**
- Le `club_name` et `club_code` ne sont **PAS** utilisés pour le regroupement automatique.
- Un équipage peut contenir des participants de clubs différents (cas de prêts entre clubs).
- Seul l'ordre séquentiel de `seat_position` détermine le regroupement.

---

## 2. Génération automatique de l'ID d'équipage

Quand `crew_external_id` est absent, l'API doit générer automatiquement un identifiant unique pour chaque équipage créé.

**Format suggéré :**
- `AUTO-{category_code}-{timestamp}-{index}` 
- Ou simplement un UUID
- Ou un compteur séquentiel : `AUTO-{category_code}-{seq}`

**Exemple :**
- `AUTO-J18H2x-001`
- `AUTO-J18H2x-002`
- `AUTO-SH4--001`

Cet ID généré doit être :
- Unique pour l'événement
- Stocké dans la base de données (dans le champ `external_id` ou équivalent de la table `crews`)
- Utilisé uniquement en interne (pas besoin de le retourner dans la réponse si non nécessaire)

---

## 3. Modifications à apporter dans le code backend

### 3.1. Parsing du fichier

**Avant :**
```javascript
// Regroupement uniquement par crew_external_id
const crews = groupBy(rows, 'crew_external_id');
```

**Après :**
```javascript
// Si crew_external_id présent : regroupement par crew_external_id
// Sinon : regroupement automatique par seat_position séquentiel

function groupRowsIntoCrews(rows) {
  const crews = [];
  let currentCrew = null;
  let currentCategory = null;
  
  for (const row of rows) {
    // Si crew_external_id est présent, utiliser le regroupement manuel
    if (row.crew_external_id && row.crew_external_id.trim() !== '') {
      const crewKey = `${row.crew_external_id}-${row.category_code}`;
      if (!crews[crewKey]) {
        crews[crewKey] = [];
      }
      crews[crewKey].push(row);
      continue;
    }
    
    // Sinon : regroupement automatique par seat_position séquentiel
    // Nouvel équipage si :
    // - seat_position === 1 (début d'un équipage)
    // - OU changement de category_code
    if (
      parseInt(row.seat_position) === 1 || 
      currentCategory !== row.category_code ||
      !currentCrew
    ) {
      // Créer un nouvel équipage
      currentCrew = [];
      currentCategory = row.category_code;
      crews.push(currentCrew);
    }
    
    currentCrew.push(row);
  }
  
  return crews;
}
```

### 3.2. Génération de l'ID automatique

**Ajouter une fonction :**
```javascript
function generateAutoCrewId(categoryCode, index) {
  // Option 1 : UUID simple
  return `AUTO-${uuidv4()}`;
  
  // Option 2 : Avec catégorie et index
  return `AUTO-${categoryCode}-${String(index).padStart(3, '0')}`;
  
  // Option 3 : Avec timestamp
  return `AUTO-${categoryCode}-${Date.now()}-${index}`;
}
```

### 3.3. Création des équipages

**Modifier la logique de création :**
```javascript
for (const crewRows of groupedCrews) {
  const firstRow = crewRows[0];
  
  // Déterminer l'ID de l'équipage
  let crewExternalId;
  if (firstRow.crew_external_id && firstRow.crew_external_id.trim() !== '') {
    crewExternalId = firstRow.crew_external_id;
  } else {
    // Générer automatiquement
    crewExternalId = generateAutoCrewId(firstRow.category_code, crewIndex);
  }
  
  // Créer ou mettre à jour l'équipage avec cet ID
  // ...
}
```

---

## 4. Validation et erreurs

### 4.1. Validation des seat_position

- Vérifier que les `seat_position` sont numériques et > 0
- Si regroupement automatique : vérifier que les `seat_position` se suivent logiquement (1, 2, 3, ...) sans trop de trous
- **Erreur suggérée** : "Seat positions invalides : trous détectés dans la séquence (1, 2, 4, 5...). Vérifiez l'ordre des lignes."

### 4.2. Validation des équipages incomplets

- Si regroupement automatique : détecter les équipages qui semblent incomplets (ex: seulement seat 1 et 3, pas de seat 2)
- **Avertissement suggéré** : "Équipage auto-généré avec des positions manquantes. Vérifiez l'ordre des lignes."

---

## 5. Exemple de traitement

### Fichier d'entrée (sans crew_external_id) :
```csv
category_code,club_name,seat_position,participant_first_name,participant_last_name
J18H2x,Club A,1,Jean,Dupont
J18H2x,Club A,2,Pierre,Martin
J18H2x,Club A,3,Paul,Bernard
J18H2x,Club B,1,Marie,Durand
J18H2x,Club B,2,Julie,Moreau
SH4-,Club A,1,Marc,Lefebvre
```

### Résultat attendu :
- **Équipage 1** (ID auto généré, ex: `AUTO-J18H2x-001`)
  - Jean Dupont (seat 1, Club A)
  - Pierre Martin (seat 2, Club A)
  - Paul Bernard (seat 3, Club A)
- **Équipage 2** (ID auto généré, ex: `AUTO-J18H2x-002`)
  - Marie Durand (seat 1, Club B)
  - Julie Moreau (seat 2, Club B)
- **Équipage 3** (ID auto généré, ex: `AUTO-SH4--001`)
  - Marc Lefebvre (seat 1, Club A)

**Note :** Le club n'intervient pas dans le regroupement. Seul `seat_position` détermine le regroupement.

---

## 6. Points d'attention

1. **Ordre des lignes** : Le regroupement automatique dépend de l'ordre des lignes dans le fichier. Les lignes doivent être triées par équipage (seat_position 1, 2, 3... puis nouveau seat_position 1, 2, 3...).
2. **Changement de catégorie** : Un changement de `category_code` crée toujours un nouvel équipage, même si `seat_position` n'est pas à 1.
3. **Coxswain** : Le champ `is_coxswain` doit toujours être respecté, indépendamment du regroupement.
4. **Club** : Le `club_name` et `club_code` ne sont **PAS** utilisés pour le regroupement. Un équipage peut regrouper des participants de clubs différents.
5. **Mode `update_or_create`** : Quand on met à jour un équipage existant, utiliser `crew_external_id` pour le retrouver. Si absent, utiliser la logique de matching existante (catégorie + participants).

---

## 7. Tests à prévoir

1. **Test avec crew_external_id présent** : Vérifier que le comportement actuel est préservé
2. **Test sans crew_external_id** : Vérifier le regroupement automatique par seat_position
3. **Test mixte** : Fichier avec certaines lignes ayant crew_external_id et d'autres non
4. **Test changement de catégorie** : Vérifier que le changement de catégorie crée un nouvel équipage
5. **Test équipages incomplets** : Vérifier la gestion des trous dans les seat_position

---

## 8. Compatibilité

Ces modifications sont **rétrocompatibles** :
- Les fichiers existants avec `crew_external_id` continueront de fonctionner normalement
- Les nouveaux fichiers sans `crew_external_id` bénéficieront du regroupement automatique

---

## 9. Support des fichiers Excel (`.xlsx`) en plus du CSV

### 9.1. Entrée API (rappel)

- Route : `POST /events/:event_id/import-participants`
- Payload : `multipart/form-data`
  - `file` : fichier d’import
  - `mode` : `"create_only"` (défaut) ou `"update_or_create"`
  - `dry_run` : `true/false`

### 9.2. Types de fichiers acceptés

L’API doit maintenant accepter **à la fois** :

- **CSV** :
  - mimetype : `text/csv`
  - extensions : `.csv`
- **Excel** :
  - mimetype : `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - extensions : `.xlsx`

### 9.3. Parsing côté backend

- Si le fichier est un CSV → parsing actuel inchangé.
- Si le fichier est un Excel (`.xlsx`) :
  - utiliser une librairie type `xlsx` ou `exceljs` ;
  - ouvrir le classeur ;
  - lire **uniquement l’onglet** `Participants` (ou, à défaut, le premier onglet) ;
  - considérer la première ligne comme en‑têtes, les suivantes comme données ;
  - produire un tableau d’objets avec les mêmes clés que pour le CSV :
    `category_code`, `club_name`, `club_code`, `seat_position`, `is_coxswain`,
    `participant_first_name`, `participant_last_name`, etc.

Pseudo‑code :

```ts
if (isXlsx(file)) {
  const workbook = xlsx.read(file.buffer, { type: "buffer" });
  const sheet =
    workbook.Sheets["Participants"] ?? workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
  // rows → pipeline existant (validation + regroupement)
} else {
  // Parsing CSV existant
}
```

---

## 10. `club_name` et `club_code` deviennent optionnels

### 10.1. Colonnes du fichier

Adapter la section de spécification principale (« Onglet 1 – Participants ») ainsi :

- **Colonnes obligatoires** :
  - `category_code`
  - `seat_position`
  - `is_coxswain`
  - `participant_first_name`
  - `participant_last_name`

- **Colonnes recommandées / optionnelles** :
  - `club_code` (recommandé)
  - `club_name` (recommandé)
  - `participant_license_number`
  - `participant_gender`
  - `participant_email`
  - `participant_club_name`
  - `temps_pronostique`
  - `crew_external_id`

Conséquence : l’API ne doit plus retourner d’erreur **bloquante** du type  
`champ 'club_name' manquant` ou `champ 'club_code' manquant`.

### 10.2. Nouvelle règle de résolution des clubs

Adapter la section « Résolution des clubs » comme suit :

1. Si `club_code` est présent :
   - chercher un club existant via `club_code` ;
   - si trouvé → utiliser ce club ;
   - si non trouvé → ligne en erreur (comme aujourd’hui).

2. Sinon, si `club_name` est présent :
   - recherche tolérante par nom (`ILIKE`, trim, insensible à la casse) ;
   - si non trouvé → au choix :
     - ligne en erreur, **ou**
     - création d’un club « libre » (selon la politique actuelle).

3. Sinon, si `participant_club_name` est présent :
   - appliquer la même logique que pour `club_name`.

4. Sinon (aucune info club) :
   - **ne pas bloquer l’import** :
     - autoriser un équipage / participant avec `club_id = NULL`, **ou**
     - rattacher à un club générique de type `INCONNU`, selon vos règles.

L’objectif est de rendre `club_name` et `club_code` réellement optionnels, tout en continuant
à les exploiter lorsqu’ils sont fournis.
