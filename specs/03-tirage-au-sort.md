# 03 — Algorithme de tirage au sort

C'est la partie la plus sensible du projet. Elle doit être implémentée en **fonctions pures** (`backend/src/services/drawAlgorithm.js`, sans accès à la base) et testée de manière approfondie avant d'être branchée sur l'API.

## 1. Rappel des règles

Notations : `K = settings.drawsPerPerson` (2), `M = settings.maxTimesDrawn` (2).

- Chaque participant (« donneur ») tire `K` personnes **distinctes** (« receveurs ») en une seule opération.
- Un donneur ne peut pas se tirer lui-même.
- Un donneur ne peut pas tirer une personne avec laquelle il a une exclusion (symétrique).
- Un receveur ne peut pas être tiré plus de `M` fois au total.
- Les tirages se font un par un, dans un ordre imprévisible (quand chacun se connecte).

## 2. Le problème à éviter : l'impasse

Un tirage naïf (« choisir 2 personnes au hasard parmi celles encore disponibles ») peut bloquer les derniers participants.

Exemple : si les 5 premiers tirages ont épuisé la capacité de tout le monde sauf celle du 6ᵉ participant, celui-ci ne pourrait plus tirer que lui-même. Même chose pour Hugues s'il ne reste que Coralie de disponible.

**Règle impérative** : un tirage n'est retenu que s'il laisse au moins une solution complète valide pour tous les participants qui n'ont pas encore tiré.

## 3. Modèle de données de l'algorithme

```js
/**
 * @typedef {Object} DrawState
 * @property {number[]} participantIds        Tous les participants
 * @property {Array<[number, number]>} exclusions  Paires exclues (symétriques)
 * @property {Array<{giverId:number, receiverId:number}>} draws  Tirages déjà enregistrés
 * @property {{drawsPerPerson:number, maxTimesDrawn:number}} settings
 */
```

Grandeurs dérivées :

- `capacity[r] = M - (nombre de tirages où receiverId = r)` ;
- `pending` = participants n'ayant aucun tirage en tant que donneur ;
- `allowed(g, capacity)` = participants `r` tels que `r ≠ g`, `(g, r)` non exclu et `capacity[r] > 0`.

Comme les `K` insertions d'un donneur sont atomiques, un donneur a toujours soit 0, soit `K` tirages : il n'y a pas d'état partiel à gérer.

## 4. Fonctions à exporter

### `canComplete(pendingGivers, capacity, isExcluded, K)` → `boolean`

Indique s'il existe une affectation valide pour tous les donneurs restants. Recherche par retour arrière (*backtracking*) :

```
canComplete(givers, capacity):
  si givers est vide : retourner vrai
  g ← le donneur de givers ayant le moins d'options dans allowed(g, capacity)
  options ← allowed(g, capacity)
  si |options| < K : retourner faux
  pour chaque combinaison C de K éléments parmi options :
    décrémenter capacity[r] pour chaque r de C
    si canComplete(givers \ {g}, capacity) : restaurer capacity ; retourner vrai
    restaurer capacity
  retourner faux
```

Avec 6 participants, la recherche est instantanée. Aucune optimisation supplémentaire n'est nécessaire, mais le code ne doit pas supposer `K = 2` ni 6 participants.

### `pickReceivers(state, giverId, randomInt)` → `number[]`

Choisit les `K` receveurs du donneur `giverId`.

```
pickReceivers(state, giverId):
  calculer capacity et pending à partir de state
  si giverId n'est pas dans pending : lever AlreadyDrawnError
  options ← allowed(giverId, capacity)
  candidates ← toutes les combinaisons de K éléments parmi options
  mélanger candidates (Fisher-Yates avec randomInt)
  pour chaque C dans candidates :
    capacity' ← capacity, décrémentée pour chaque r de C
    si canComplete(pending \ {giverId}, capacity') :
      retourner C (dans un ordre aléatoire)
  lever DrawImpossibleError
```

- `randomInt(n)` renvoie un entier uniforme dans `[0, n[`. En production, passer `crypto.randomInt` ; dans les tests, un générateur déterministe peut être injecté.
- Ne pas utiliser `Math.random()`.
- `DrawImpossibleError` ne peut pas se produire si l'état initial est réalisable et que tous les tirages précédents sont passés par cette fonction. Elle existe par sécurité (base modifiée à la main, par exemple).

### `validateConfiguration(participantIds, exclusions, settings)` → `boolean`

Appelle `canComplete` sur l'état vide. Utilisée par le script de seed pour refuser une configuration sans solution.

## 5. Service transactionnel (`drawService.js`)

`performDraw(db, settings, userId)` :

1. Ouvre une transaction `better-sqlite3` en mode **IMMEDIATE** (`db.transaction(fn).immediate()`), afin que deux tirages simultanés soient strictement sérialisés.
2. Dans la transaction :
   - charge les participants, les exclusions et tous les tirages ;
   - si l'utilisateur a déjà des tirages : lève `ALREADY_DRAWN` (409) ;
   - appelle `pickReceivers(state, userId, crypto.randomInt)` ;
   - insère les `K` lignes dans `draws`.
3. Retourne les receveurs (id + nom).

`better-sqlite3` étant synchrone et Node mono-thread, la transaction entière s'exécute sans interruption : il n'y a pas de condition de concurrence possible dans un processus unique. Le mode IMMEDIATE est une sécurité supplémentaire.

## 6. Vérification pour la configuration réelle

6 participants, `K = M = 2`, exclusion Hugues ↔ Coralie. Une solution existe, par exemple (ordre T, H, O, R, B, C) : chacun tire les 2 suivants dans le cycle T → H → O → C → R → B → T… en adaptant pour l'exclusion. L'IA d'implémentation n'a pas à la construire à la main : le test « configuration réelle réalisable » (voir `06`) le prouve via `validateConfiguration`.

## 7. Propriétés à garantir (reprises dans les tests)

Pour tout ordre de passage des participants, à la fin des tirages :

1. chaque participant a tiré exactement `K` personnes distinctes ;
2. personne ne s'est tiré lui-même ;
3. aucun tirage ne viole une exclusion, dans les deux sens ;
4. chaque participant a été tiré exactement `M` fois (car `K = M` et tout le monde participe) ;
5. `pickReceivers` n'a jamais levé `DrawImpossibleError`.

Et à chaque étape intermédiaire : `canComplete` est vrai pour l'état obtenu.

## 8. Confidentialité

- Ne jamais journaliser le retour de `pickReceivers`.
- Le service ne renvoie les receveurs qu'à l'appelant, qui ne les transmet qu'à l'utilisateur concerné.
