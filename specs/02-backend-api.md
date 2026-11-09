# 02 — Backend et API

## 1. Généralités

- Node.js 22, Express 5, modules ES (`"type": "module"`).
- `app.js` exporte une fonction `createApp({ db, settings })` (utilisée par `server.js` et par les tests).
- Toutes les routes API sont sous `/api`. Corps et réponses en JSON (`express.json({ limit: '50kb' })`).
- En production, Express sert aussi le front compilé (dossier `frontend/dist` copié dans l'image, chemin donné par `STATIC_DIR`) ; toute route non `/api` renvoie `index.html` (routage côté client).
- Pas de CORS : front et API sont servis sur la même origine (en dev, proxy Vite).

### Dépendances

`express`, `better-sqlite3`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`. Dev : `supertest`.

### Variables d'environnement (`src/config.js`)

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port d'écoute |
| `DB_PATH` | `./data/secret-santa.db` | Fichier SQLite |
| `PARTICIPANTS_FILE` | `./config/participants.json` | Configuration des utilisateurs |
| `JWT_SECRET` | *(obligatoire en production)* | Secret de signature. En dev, valeur par défaut avec avertissement dans la console. |
| `COOKIE_SECURE` | `false` | Mettre `true` si le site est servi en HTTPS |
| `STATIC_DIR` | *(vide)* | Dossier du front compilé ; si vide, le front n'est pas servi |

## 2. Authentification

- `POST /api/auth/login` vérifie le mot de passe avec bcryptjs, puis pose un cookie `token` contenant un JWT `{ sub: userId }`.
- Cookie : `httpOnly`, `sameSite: 'lax'`, `secure` selon `COOKIE_SECURE`, `path: '/'`, durée 60 jours. Le JWT expire aussi au bout de 60 jours.
- Middlewares (`src/middleware/auth.js`) :
  - `requireAuth` : lit le cookie, vérifie le JWT, **recharge l'utilisateur en base** et le place dans `req.user` (`{ id, name, isAdmin, isParticipant }`). Sinon `401`.
  - `requireParticipant` : `403` si `req.user.isParticipant` est faux.
  - `requireAdmin` : `403` si `req.user.isAdmin` est faux.
- Le login accepte le prénom sous n'importe quelle casse et avec ou sans accents (normalisation décrite dans `01`).
- En cas d'échec, message unique « Identifiant ou mot de passe incorrect » (ne pas distinguer les deux cas).

## 3. Format des erreurs

Toutes les erreurs ont la forme :

```json
{ "error": { "code": "ALREADY_DRAWN", "message": "Tu as déjà effectué ton tirage." } }
```

Les messages sont en français et affichables tels quels par le front. Un middleware d'erreur central (`middleware/errors.js`) convertit les exceptions ; les erreurs inattendues renvoient `500` avec le code `INTERNAL_ERROR` et sont journalisées **sans données de tirage**.

| Code | HTTP | Cas |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Corps de requête invalide |
| `UNAUTHENTICATED` | 401 | Pas de session valide |
| `INVALID_CREDENTIALS` | 401 | Mauvais identifiant ou mot de passe |
| `FORBIDDEN` | 403 | Rôle insuffisant |
| `NOT_FOUND` | 404 | Route API inconnue |
| `ALREADY_DRAWN` | 409 | L'utilisateur a déjà tiré |
| `DRAW_IMPOSSIBLE` | 500 | Aucun tirage valide (ne doit jamais arriver, voir `03`) |
| `INTERNAL_ERROR` | 500 | Autre erreur |

## 4. Endpoints

### Santé

**`GET /api/health`** — public. Réponse `200 { "status": "ok" }`.

### Utilisateurs

**`GET /api/users/names`** — public. Liste des comptes pour l'écran de connexion (participants par ordre alphabétique, admin en dernier).

```json
{ "users": [ { "name": "Bérénice" }, { "name": "Coralie" }, { "name": "Admin" } ] }
```

### Authentification

**`POST /api/auth/login`** — public.

Requête : `{ "name": "Océane", "password": "..." }`

Réponse `200` (+ cookie) :

```json
{ "user": { "id": 3, "name": "Océane", "isAdmin": false, "isParticipant": true } }
```

**`POST /api/auth/logout`** — efface le cookie. Réponse `204`.

**`GET /api/auth/me`** — `requireAuth`. Même forme de réponse que le login.

### Tirage

**`GET /api/draw`** — `requireAuth` + `requireParticipant`. État du tirage de l'utilisateur connecté, avec les lettres des personnes tirées.

```json
{
  "hasDrawn": true,
  "receivers": [
    { "id": 4, "name": "Romane",   "letter": { "content": "...", "updatedAt": "2026-11-20 18:02:11" } },
    { "id": 1, "name": "Thibault", "letter": null }
  ]
}
```

Si l'utilisateur n'a pas tiré : `{ "hasDrawn": false, "receivers": [] }`.

**`POST /api/draw`** — `requireAuth` + `requireParticipant`. Effectue le tirage (voir `03`). Pas de corps.

- `201` : même forme de réponse que `GET /api/draw`.
- `409 ALREADY_DRAWN` si l'utilisateur a déjà tiré.

> **Confidentialité** : ces deux routes ne renvoient que les tirages de `req.user`. Aucune route, y compris admin, ne renvoie les tirages d'un autre utilisateur ni la liste de qui a tiré une personne donnée.

### Lettres

**`GET /api/letters`** — `requireAuth`. Tous les participants, par ordre alphabétique, avec leur lettre ou `null`.

```json
{
  "letters": [
    { "userId": 5, "name": "Bérénice", "content": "...", "updatedAt": "2026-11-20 18:02:11" },
    { "userId": 6, "name": "Coralie",  "content": null,  "updatedAt": null }
  ]
}
```

**`GET /api/letters/me`** — `requireAuth` + `requireParticipant`.

Réponse : `{ "content": "...", "updatedAt": "..." }` ou `{ "content": "", "updatedAt": null }` si aucune lettre.

**`PUT /api/letters/me`** — `requireAuth` + `requireParticipant`.

Requête : `{ "content": "Cher Père Noël..." }`

- `content` doit être une chaîne de 5000 caractères au maximum, sinon `400 VALIDATION_ERROR`.
- Chaîne vide ou composée uniquement d'espaces : la lettre est supprimée.
- Sinon : *upsert* avec `updated_at = datetime('now')`.
- Le contenu est stocké tel quel (texte brut). L'échappement est fait à l'affichage par React.
- Réponse `200` : même forme que `GET /api/letters/me`.

### Administration

**`GET /api/admin/status`** — `requireAuth` + `requireAdmin`.

```json
{
  "participants": [
    { "name": "Bérénice", "hasDrawn": true,  "hasLetter": true },
    { "name": "Coralie",  "hasDrawn": false, "hasLetter": false }
  ],
  "drawnCount": 1,
  "total": 6
}
```

Ne contient **que des booléens** : jamais de nom de personne tirée, ni le nombre de fois où chacun a été tiré.

**`POST /api/admin/reset`** — `requireAuth` + `requireAdmin`.

Requête : `{ "resetLetters": false }`

Supprime tous les tirages, et toutes les lettres si `resetLetters` vaut `true`. Réponse `200` : même forme que `GET /api/admin/status`.

## 5. Journalisation

- Une ligne par requête (méthode, chemin, statut, durée) suffit.
- **Interdit** : journaliser le résultat d'un tirage, le corps des réponses de `/api/draw`, les mots de passe.
- Autorisé : « Tirage effectué par l'utilisateur 3 » (sans les personnes tirées).

## 6. Scripts npm du backend

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test",
    "db:init": "node src/db/init.js",
    "db:seed": "node src/db/seed.js",
    "db:reset": "node src/db/reset.js"
  }
}
```

## 7. Critères de validation

- Sans cookie, toute route protégée renvoie `401`.
- L'admin reçoit `403` sur `/api/draw` et `/api/letters/me` ; un participant reçoit `403` sur `/api/admin/*`.
- Connexion possible avec `oceane`, `Océane` et `OCEANE`.
- Deux appels successifs à `POST /api/draw` : le premier renvoie `201`, le second `409`.
- Après réinitialisation par l'admin, `GET /api/draw` renvoie `hasDrawn: false` pour tout le monde.
