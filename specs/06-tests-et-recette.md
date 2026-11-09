# 06 — Tests et recette

## 1. Outils

- Backend : `node:test` et `node:assert` (intégrés à Node), `supertest` pour l'API.
- Chaque test d'intégration crée sa propre base en mémoire (`:memory:`), exécute `init` puis un seed avec une configuration de test (mêmes 6 participants et même exclusion que la configuration réelle, mots de passe de test).
- Pas de tests automatisés côté front : la recette manuelle (section 4) suffit pour ce projet.
- Commande : `cd backend && npm test`.

## 2. Tests unitaires de l'algorithme (`test/drawAlgorithm.test.js`)

Ce sont les tests les plus importants du projet.

| # | Test | Attendu |
|---|---|---|
| A1 | Configuration réelle réalisable | `validateConfiguration` renvoie vrai pour 6 participants, K = M = 2, exclusion Hugues ↔ Coralie |
| A2 | **Simulation de 1000 tirages complets** | Pour chaque itération : ordre de passage aléatoire, appels successifs à `pickReceivers`. À la fin, les 5 propriétés de `03` §7 sont vraies. Aucune `DrawImpossibleError`. |
| A3 | Invariant intermédiaire | Dans A2, après chaque tirage, `canComplete` est vrai sur l'état obtenu |
| A4 | Tous les ordres de passage | Pour les 720 permutations des 6 participants, un tirage complet réussit |
| A5 | Exclusion respectée dans les deux sens | Sur l'ensemble des simulations, jamais Hugues → Coralie ni Coralie → Hugues |
| A6 | Pas d'auto-tirage, receveurs distincts | Sur l'ensemble des simulations |
| A7 | Évitement d'impasse | État construit à la main où un choix « naïf » bloquerait le dernier donneur : `pickReceivers` ne renvoie que des choix qui laissent une solution |
| A8 | Donneur ayant déjà tiré | `pickReceivers` lève `AlreadyDrawnError` |
| A9 | Configuration impossible | `validateConfiguration` renvoie faux, par exemple avec 3 participants, K = 2 et une exclusion |
| A10 | État corrompu | État sans solution (capacités épuisées à la main) : `pickReceivers` lève `DrawImpossibleError` |
| A11 | Paramètres génériques | Simulation réussie avec K = M = 1 et 4 participants, et avec K = M = 3 et 8 participants |
| A12 | Aléa réel | Sur 1000 simulations, chaque paire donneur → receveur autorisée apparaît au moins une fois |
| A13 | Générateur injecté | Avec un `randomInt` déterministe, deux exécutions donnent le même résultat |

## 3. Tests d'intégration de l'API

### Authentification (`test/auth.test.js`)

| # | Test | Attendu |
|---|---|---|
| B1 | Login correct | 200, cookie `token` posé avec `HttpOnly` |
| B2 | Login insensible à la casse et aux accents | `oceane`, `Océane`, `OCEANE` → 200 |
| B3 | Mauvais mot de passe / utilisateur inconnu | 401 `INVALID_CREDENTIALS`, même message dans les deux cas |
| B4 | Corps invalide | 400 `VALIDATION_ERROR` |
| B5 | `GET /api/auth/me` sans cookie | 401 |
| B6 | Logout | 204, puis `me` → 401 |
| B7 | `GET /api/users/names` | 7 noms, sans champ sensible |

### Tirage (`test/draw.test.js`)

| # | Test | Attendu |
|---|---|---|
| C1 | `GET /api/draw` avant tirage | `hasDrawn: false`, `receivers: []` |
| C2 | `POST /api/draw` | 201, 2 receveurs distincts, différents de l'utilisateur |
| C3 | Second `POST /api/draw` | 409 `ALREADY_DRAWN`, tirage inchangé |
| C4 | `GET /api/draw` après tirage | Mêmes receveurs que C2 |
| C5 | Les 6 participants tirent | Chacun est tiré exactement 2 fois (vérifié en base) ; exclusion respectée |
| C6 | Lettre du receveur incluse | Si le receveur a une lettre, elle figure dans la réponse ; sinon `letter: null` |
| C7 | Admin sur `/api/draw` | 403 |
| C8 | Sans session | 401 |
| C9 | Confidentialité | La réponse d'un utilisateur ne contient aucune information sur les tirages des autres |

### Lettres (`test/letters.test.js`)

| # | Test | Attendu |
|---|---|---|
| D1 | `GET /api/letters/me` sans lettre | `content: ""`, `updatedAt: null` |
| D2 | `PUT` puis `GET` | Contenu identique, `updatedAt` renseigné |
| D3 | Modification | Contenu remplacé, toujours une seule ligne en base |
| D4 | Contenu vide ou espaces | Lettre supprimée |
| D5 | Plus de 5000 caractères / type incorrect | 400 `VALIDATION_ERROR` |
| D6 | `GET /api/letters` | 6 entrées par ordre alphabétique, `content: null` pour ceux sans lettre, admin absent |
| D7 | Contenu avec HTML et sauts de ligne | Stocké et renvoyé tel quel |
| D8 | Admin sur `PUT /api/letters/me` | 403 ; `GET /api/letters` → 200 |

### Administration (`test/admin.test.js`)

| # | Test | Attendu |
|---|---|---|
| E1 | Participant sur `/api/admin/status` et `/api/admin/reset` | 403 |
| E2 | `status` | Booléens corrects après quelques tirages et lettres ; aucun nom de receveur dans la réponse |
| E3 | `reset` sans lettres | `draws` vide, `letters` intact |
| E4 | `reset` avec `resetLetters: true` | Les deux tables vides |
| E5 | Après reset | Un participant peut tirer de nouveau |

### Seed (`test/seed.test.js`)

| # | Test | Attendu |
|---|---|---|
| F1 | Seed sur base vide | 7 utilisateurs, 1 exclusion |
| F2 | Seed relancé | Aucun doublon |
| F3 | Mot de passe modifié, tirages existants | Hash mis à jour, tirages intacts |
| F4 | Participant ajouté, tirages existants | Refus avec le message prévu |
| F5 | Configuration sans solution | Refus avec message clair |
| F6 | Noms en double après normalisation | Refus |

## 4. Recette manuelle

À dérouler sur téléphone (ou en mode mobile du navigateur, 375 px), sur l'instance Docker.

### Connexion
- [ ] La liste déroulante affiche les 6 prénoms et Admin.
- [ ] Un mauvais mot de passe affiche un message d'erreur en français.
- [ ] Après connexion puis rechargement de la page, la session est conservée.
- [ ] « Se déconnecter » ramène à l'écran de connexion.

### Tirage
- [ ] Avant tirage : bouton « Tirer au sort » et avertissement visibles.
- [ ] La confirmation s'affiche ; « Annuler » ne déclenche rien.
- [ ] Le tirage affiche 2 prénoms différents, jamais le sien.
- [ ] Après rechargement et reconnexion, les 2 mêmes prénoms sont affichés et le bouton a disparu.
- [ ] Hugues ne tire jamais Coralie et inversement (vérifier sur plusieurs réinitialisations).
- [ ] Les 6 participants peuvent tous tirer sans erreur, quel que soit l'ordre (tester au moins 3 ordres différents, avec réinitialisation entre chaque).

### Lettres
- [ ] Écrire une lettre avec sauts de ligne et émojis, enregistrer : message de confirmation.
- [ ] La lettre apparaît dans « Les lettres » pour un autre utilisateur, mise en forme conservée.
- [ ] La lettre apparaît sur la page « Mon tirage » de la personne qui a tiré son auteur.
- [ ] Modifier la lettre : la nouvelle version remplace l'ancienne partout.
- [ ] Le compteur de caractères fonctionne et bloque à 5000.
- [ ] Quitter la page avec des modifications non enregistrées déclenche un avertissement.

### Administration
- [ ] L'admin voit qui a tiré et qui a écrit sa lettre, mais aucun résultat de tirage.
- [ ] L'admin n'a pas accès à « Mon tirage » ni « Ma lettre ».
- [ ] Un participant qui saisit l'adresse `/admin` est redirigé.
- [ ] « Réinitialiser le tirage » (sans cocher la case) : tout le monde peut retirer, les lettres sont conservées.
- [ ] Avec la case cochée : les lettres sont aussi effacées.

### Confidentialité
- [ ] Dans l'onglet Réseau du navigateur, aucune réponse d'API ne contient les tirages d'un autre utilisateur.
- [ ] `docker compose logs` ne contient aucun résultat de tirage ni mot de passe.

### Robustesse
- [ ] Après `docker compose restart`, tirages et lettres sont conservés.
- [ ] Aucun défilement horizontal sur un écran de 360 px.
- [ ] La barre de navigation basse ne masque aucun contenu ni bouton.

## 5. Définition de « terminé »

- `npm test` passe intégralement dans `backend/`.
- La checklist de recette est entièrement cochée.
- Le README du projet décrit le lancement en dev, le déploiement, le changement de mot de passe, la réinitialisation et la réutilisation une autre année.
