# 01 — Base de données et scripts d'initialisation

## 1. Généralités

- SQLite, un seul fichier. Chemin donné par la variable d'environnement `DB_PATH` (défaut en dev : `./data/secret-santa.db` ; dans Docker : `/data/secret-santa.db`).
- Accès via `better-sqlite3`.
- À l'ouverture de la connexion : `PRAGMA foreign_keys = ON;` et `PRAGMA journal_mode = WAL;`.
- `DB_PATH=:memory:` doit fonctionner (utilisé par les tests).
- `connection.js` crée le dossier parent du fichier s'il n'existe pas.

## 2. Schéma (`backend/src/db/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL UNIQUE,          -- nom affiché, ex. "Océane"
  login           TEXT    NOT NULL UNIQUE,          -- nom normalisé, ex. "oceane"
  password_hash   TEXT    NOT NULL,
  is_admin        INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  is_participant  INTEGER NOT NULL DEFAULT 1 CHECK (is_participant IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Exclusions symétriques : une seule ligne par paire, avec user_a_id < user_b_id.
CREATE TABLE IF NOT EXISTS exclusions (
  user_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);

-- Table des tirages : une ligne = "giver offre un cadeau à receiver".
-- C'est cette table qui retient qui a déjà été tiré, et combien de fois.
CREATE TABLE IF NOT EXISTS draws (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  giver_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (giver_id, receiver_id),
  CHECK (giver_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_draws_receiver ON draws(receiver_id);

CREATE TABLE IF NOT EXISTS letters (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Invariants garantis par le code (pas par SQL)

- Un participant a soit 0 ligne, soit exactement 2 lignes dans `draws` en tant que `giver_id` (les 2 insertions sont dans la même transaction).
- Un participant apparaît au maximum 2 fois dans `draws` en tant que `receiver_id`.
- Aucune ligne de `draws` ne correspond à une paire présente dans `exclusions`.
- Seuls les utilisateurs avec `is_participant = 1` apparaissent dans `draws` et `letters`.

### Normalisation du login

`login` = `name` passé en minuscules, sans accents, sans espaces autour :

```js
const normalizeLogin = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
```

Ainsi « Océane », « oceane » et « OCEANE » désignent le même compte.

## 3. Fichier de configuration (`backend/config/participants.json`)

Chemin surchargeable par la variable d'environnement `PARTICIPANTS_FILE`.

```json
{
  "settings": {
    "drawsPerPerson": 2,
    "maxTimesDrawn": 2
  },
  "participants": [
    { "name": "Thibault", "password": "a-changer-1" },
    { "name": "Hugues",   "password": "a-changer-2" },
    { "name": "Océane",   "password": "a-changer-3" },
    { "name": "Romane",   "password": "a-changer-4" },
    { "name": "Bérénice", "password": "a-changer-5" },
    { "name": "Coralie",  "password": "a-changer-6" }
  ],
  "admin": { "name": "Admin", "password": "a-changer-admin" },
  "exclusions": [
    ["Hugues", "Coralie"]
  ]
}
```

- Les mots de passe sont en clair dans ce fichier (choix assumé : sécurité faible acceptée) et **hachés avec bcryptjs (coût 10)** avant insertion en base.
- `settings` est lu par le backend au démarrage et passé à l'algorithme de tirage. Ne pas coder les valeurs 2 et 2 en dur dans l'algorithme.
- Une exclusion `["A", "B"]` est symétrique : A ne peut pas tirer B et B ne peut pas tirer A.

## 4. Scripts

Tous dans `backend/src/db/`, exposés en scripts npm, et aussi exportés sous forme de fonctions pour être appelés au démarrage du serveur et dans les tests.

| Commande | Fichier | Rôle |
|---|---|---|
| `npm run db:init` | `init.js` | Exécute `schema.sql`. Idempotent. |
| `npm run db:seed` | `seed.js` | Insère ou met à jour les utilisateurs et exclusions depuis `participants.json`. |
| `npm run db:reset` | `reset.js` | Supprime tous les tirages. Avec `-- --letters`, supprime aussi les lettres. |

### Comportement détaillé de `seed`

1. Lire et valider le fichier :
   - noms non vides et uniques après normalisation (admin compris) ;
   - mots de passe non vides ;
   - chaque nom d'exclusion correspond à un participant ;
   - `drawsPerPerson` et `maxTimesDrawn` sont des entiers ≥ 1.
2. **Vérifier que la configuration est réalisable** : appeler la fonction `canComplete` de `drawAlgorithm.js` (voir `03`) sur l'état vide. Si aucune solution n'existe (trop d'exclusions par exemple), arrêter avec un message d'erreur clair.
3. Dans une transaction :
   - *upsert* de chaque participant par `login` (met à jour `name` et `password_hash`, `is_participant = 1`, `is_admin = 0`) ;
   - *upsert* du compte admin (`is_admin = 1`, `is_participant = 0`) ;
   - remplacement complet du contenu de `exclusions`.
4. **Garde-fou** : si la table `draws` n'est pas vide **et** que la liste des participants ou des exclusions diffère de celle en base, refuser avec le message : « Des tirages existent déjà. Réinitialise le tirage (npm run db:reset) avant de modifier les participants ou les exclusions. » La mise à jour des seuls mots de passe reste autorisée.
5. Les utilisateurs présents en base mais absents du fichier sont supprimés (uniquement possible quand `draws` est vide, cf. point 4).
6. Ne touche jamais à `draws` ni à `letters` (hors suppression en cascade du point 5).
7. Afficher un résumé : nombre de participants, d'exclusions, compte admin. **Ne jamais afficher les mots de passe.**

### Au démarrage du serveur

`server.js` appelle `init()` puis `seed()` avant d'écouter. Si `seed()` échoue, le serveur s'arrête avec un code de sortie non nul et un message explicite.

## 5. Requêtes utiles (référence)

```sql
-- Nombre de fois où chaque participant a été tiré
SELECT u.id, u.name, COUNT(d.id) AS times_drawn
FROM users u
LEFT JOIN draws d ON d.receiver_id = u.id
WHERE u.is_participant = 1
GROUP BY u.id;

-- Participants n'ayant pas encore tiré
SELECT u.id, u.name FROM users u
WHERE u.is_participant = 1
  AND NOT EXISTS (SELECT 1 FROM draws d WHERE d.giver_id = u.id);

-- Personnes tirées par un utilisateur donné
SELECT u.id, u.name FROM draws d
JOIN users u ON u.id = d.receiver_id
WHERE d.giver_id = ?
ORDER BY d.id;
```

## 6. Critères de validation

- `npm run db:init && npm run db:seed` sur une base vide crée 7 utilisateurs (6 participants + Admin) et 1 exclusion.
- Relancer `db:seed` ne crée aucun doublon.
- Modifier un mot de passe dans le JSON puis relancer `db:seed` met à jour le hash, y compris si des tirages existent.
- Ajouter un participant alors que des tirages existent est refusé avec le message prévu.
- `npm run db:reset` vide `draws` et conserve `letters` ; avec `-- --letters`, vide les deux.
