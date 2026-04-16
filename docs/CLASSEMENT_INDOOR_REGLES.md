# Règles du classement indoor (FF Aviron Chrono)

Ce document décrit **les règles telles qu’elles sont appliquées dans l’application** (pages Résultats, export, tableau de bord « Classements des clubs »).  
Le **barème chiffré des points** (valeur du 1er, 2e, etc.) et le **statut éligible** par distance sont fournis par **l’API backend** ; le front **recalcule** une partie des points pour le classement par club (voir §3).

---

## 1. Données sources

| Usage                            | Endpoint (typique)                                                  |
| -------------------------------- | ------------------------------------------------------------------- |
| Résultats par catégorie (indoor) | `GET /indoor-results/event/:eventId/bycategorie`                    |
| Détail d’une course              | `GET /indoor-results/race/:raceId`                                  |
| Liste des événements             | `GET /events` (filtrage `race_type === "indoor"` pour le dashboard) |

Chaque ligne de résultat indoor expose notamment : position dans la catégorie, équipage (`crew` avec `club_name`, `club_code`), `points`, `is_eligible_for_points`, informations de distance (`distance`, `distance_info`).

---

## 2. Distances comptant pour les points (affichage métier)

Sur la page **Résultats** de l’événement, le message utilisateur indique que les points ne sont attribués **que pour certaines distances**:

- **2000 m**
- **500 m**
- **Relais 8 × 250 m**

> En pratique, l’API renseigne `is_eligible_for_points` ; cette liste correspond au message affiché quand aucun classement club n’est disponible (`EventResultsPage`).

Si `is_eligible_for_points` est `false`, la ligne ne participe pas au barème points (affichage « - » pour les points après traitement).

---

## 3. Barème par place « absolue » dans la catégorie

Pour chaque **catégorie** :

1. Les résultats sont triés par **position** (classement officiel de la catégorie).
2. Pour chaque rang `k` (1er, 2e, …), on lit les **points** associés sur la ligne qui occupe ce rang **à condition que** cette ligne soit `is_eligible_for_points` et ait une valeur de points numérique. Sinon le barème à la place `k` est considéré comme **vide** (`null`).
3. Ces valeurs constituent le **barème de référence** par place (1re place catégorie → points du 1er, etc.).

Référence code: `redistributeIndoorPointsByClub` dans `src/pages/event/EventResultsPage.tsx`.

---

## 4. Réattribution des points pour le classement **par club** (règle clé)

Objectif : ne pas attribuer de points aux lignes **sans club**, tout en appliquant le barème **comme si** seuls les concurrents avec club comptaient.

1. **Sans identité club** (ni `club_name` ni `club_code` significatif) : **pas de points** (`points` mis à `null` pour l’affichage classement club).
2. On prend les lignes **avec club** (`club_name` ou `club_code`), **éligibles** (`is_eligible_for_points`), triées par **position** réelle dans la catégorie.
3. Le **1er de ce sous-groupe** reçoit les points du **barème1re place** ; le **2e** du sous-groupe ceux de la **2e place**, etc.
4. Si le barème à une place donnée est `null` (ex. place absolue non éligible), le point correspondant dans la réattribution peut être absent.

En résumé : _le 1er « avec club » prend les points du 1er du barème catégorie, le 2e « avec club » ceux du 2e, etc._ — les concurrents sans club ne « consomment » pas une tranche du barème pour le classement club.

Références :

- `redistributeIndoorPointsByClub` — `EventResultsPage.tsx`
- Même logique pour le dashboard: `computeIndoorEventRankingsFromByCategory` — `src/pages/dashboard/ClubRankingsPage.tsx`

---

## 5. Classement des clubs **pour un événement**

Après réattribution (§4) :

- Pour chaque **club**, on **somme** les points de toutes les lignes éligibles ayant des points non nuls.
- Une ligne indoor sans `club_name` est ignorée pour ce total (cf. agrégation `clubRanking` dans `EventResultsPage.tsx`).
- Classement : **ordre décroissant** du total de points ; ex-aequo résolus par l’ordre d’insertion après tri (comportement tableau).

---

## 6. Dashboard « Classement général » indoor (multi-événements)

Fichier : `ClubRankingsPage.tsx`.

### 6.1 Calcul par événement régional / tout événement indoor

Pour chaque événement dont `race_type` est **indoor** :

- Appel `GET /indoor-results/event/:id/bycategorie`
- Application de la même logique que §4 via `computeIndoorEventRankingsFromByCategory`

**Particularité dashboard** : pour agréger les points par club, seules les lignes avec un **code club** (`club_code` non vide) sont prises en compte après filtrage « avec club » et éligibilité. (Le libellé club seul sans code ne suffit pas pour l’agrégat global dashboard.)

### 6.2 Événement « France MAIF »

Un événement est traité comme **championnat de France MAIF indoor** si son **nom** correspond au motif (normalisation : majuscules, suppression accents, espaces) :

- contient **MAIF**
- contient **AVIRON INDOOR**
- contient **CHAMPIONNATS DE FRANCE**

Exemple documenté dans le code : _« MAIF AVIRON INDOOR – CHAMPIONNATS DE FRANCE U17, U19, SENIOR, MASTER ET PARA-AVIRON »_.

### 6.3 Formule du total « général » par club

Pour chaque club (identifié par `club_code`) :

\[
\textbf{Total général} = \textbf{Meilleur total régional} + \textbf{Points au championnat France MAIF}
\]

- **Meilleur total régional** : maximum des totaux points de ce club sur tous les événements indoor qui **ne sont pas** détectés comme MAIF France.
- **Points MAIF** : total points de ce club sur l’événement (ou les événements) classé(s) France MAIF — le code retient le **maximum** si plusieurs événements correspondent.

Affichage utilisateur (description de carte) : _Total = meilleur score parmi les compétitions régionales + points du championnat de France MAIF AVIRON INDOOR._

---

## 7. Synthèse des différences utiles (QA)

| Contexte                                   | Club sans `club_code` mais avec `club_name`             |
| ------------------------------------------ | ------------------------------------------------------- |
| Page Résultats (classement club événement) | Peut compter après réattribution si `club_name` présent |
| Dashboard classement global indoor         | Exclu de l’agrégat si pas de `club_code`                |

---

## 8. Mer (hors indoor)

Pour `race_type` **mer**, le classement club sur la page Résultats utilise l’API :  
`GET /events/:eventId/endurance-mer/ranking` (règles **mer** documentées ailleurs, ex. `FRONTEND_ENDURANCE_MER_IMPORT.md`).

---

## 9. Références de code

| Sujet                                                      | Fichier                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| Réattribution points + classement club événement           | `src/pages/event/EventResultsPage.tsx`                      |
| Classement global indoor + MAIF + agrégation par code club | `src/pages/dashboard/ClubRankingsPage.tsx`                  |
| Détection nom événement MAIF                               | `isMaifNationalIndoorEventName` dans `ClubRankingsPage.tsx` |

---

## 10. Limites de ce document

- Ne remplace pas le **règlement sportif officiel** FFAviron (version papier / PDF) pour les cas litigieux.
- Les **valeurs numériques** du barème et les règles fines d’éligibilité par épreuve sont **définies côté API** ; en cas d’écart, la référence est la réponse de `bycategorie` et la configuration backend.

Pour toute évolution des règles **métier**, il faut aligner : **backend** (éligibilité, points bruts) et, si besoin, **ce document** + les fonctions citées en §9.
