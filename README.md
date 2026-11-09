# Secret Santa familial

Petit site privé de Secret Santa pour Noël en famille. Chaque participant se connecte, tire au sort **2 personnes** à qui offrir un cadeau et écrit une lettre visible par tous. Le serveur garantit qu'aucun tirage ne mène à une impasse et que personne, admin compris, ne peut voir les tirages des autres via l'interface.

Les spécifications complètes sont dans [`specs/`](specs/00-README.md).

- **Backend** : Node.js 22, Express 5, SQLite (`better-sqlite3`), JWT en cookie `httpOnly`
- **Frontend** : React + Vite, pensé d'abord pour mobile
- **Déploiement** : un seul conteneur Docker (Express sert l'API et le front compilé), base SQLite dans `./data`

---

## Déploiement avec Docker

Prérequis : Docker et Docker Compose v2 (commande `docker compose`). L'image se construit sur x86_64 comme sur ARM64 (Raspberry Pi 4/5) ; elle est construite directement sur la machine cible.

### Premier déploiement

```bash
git clone <dépôt> secret-santa && cd secret-santa
cp .env.example .env                     # puis renseigner JWT_SECRET (voir ci-dessous)
nano backend/config/participants.json    # définir les mots de passe
mkdir -p data
docker compose up -d --build
```

Pour générer `JWT_SECRET` :

```bash
openssl rand -hex 32
```

Le site est alors disponible sur `http://<ip-de-la-machine>:8080` (port modifiable avec `HOST_PORT` dans `.env`). Sans `JWT_SECRET`, `docker compose up` refuse de démarrer.

Vérifier que tout va bien :

```bash
docker compose ps        # l'état doit passer à « healthy » au bout de 30 s environ
docker compose logs -f   # « Seed terminé : 6 participants, 1 exclusion(s)… »
```

> **Droits sur `data/`** : le conteneur tourne avec l'utilisateur `node` (UID 1000), qui doit pouvoir écrire dans `./data`. Si les logs affichent une erreur d'accès à la base (`SQLITE_CANTOPEN`, `permission denied`), lancer :
>
> ```bash
> sudo chown -R 1000:1000 data
> ```

### Variables d'environnement (`.env`)

| Variable | Rôle | Défaut |
|---|---|---|
| `HOST_PORT` | Port exposé sur la machine hôte | `8080` |
| `JWT_SECRET` | Secret de signature des sessions (obligatoire) | aucun |
| `COOKIE_SECURE` | `true` uniquement si le site est servi en HTTPS | `false` |

Changer `JWT_SECRET` déconnecte tout le monde (les sessions durent sinon 60 jours).

### Changer un mot de passe

1. Modifier le mot de passe dans `backend/config/participants.json`.
2. `docker compose restart`

Le dossier `backend/config/` est monté dans le conteneur : pas besoin de reconstruire l'image. À chaque démarrage, le seed met à jour les mots de passe hachés sans toucher aux tirages ni aux lettres.

### Réinitialiser le tirage

Depuis l'interface : se connecter en **Admin**, puis « Réinitialiser le tirage » (cocher « Effacer aussi les lettres » si besoin).

Ou en ligne de commande :

```bash
docker compose exec secret-santa npm run db:reset              # tirages seuls
docker compose exec secret-santa npm run db:reset -- --letters # tirages + lettres
```

Si le conteneur ne démarre pas (état `restarting`, voir `docker compose logs`), `exec` ne fonctionne pas. Utiliser alors un conteneur temporaire :

```bash
docker compose run --rm secret-santa npm run db:reset -- --letters
docker compose restart
```

### Sauvegarder

Copier le dossier `data/`, conteneur arrêté de préférence :

```bash
docker compose stop && cp -r data data-sauvegarde-$(date +%F) && docker compose start
```

Si le conteneur tourne, copier aussi les fichiers `secret-santa.db-wal` et `secret-santa.db-shm` en même temps que `secret-santa.db`.

### Réutiliser le site une autre année

1. Réinitialiser le tirage **et** les lettres (interface admin avec la case cochée, ou `npm run db:reset -- --letters`).
2. Modifier participants, mots de passe et exclusions dans `backend/config/participants.json` (voir le format ci-dessous).
3. `docker compose restart`

Le serveur refuse de démarrer, avec un message explicite, si les participants ou les exclusions changent alors que des tirages existent, ou si la configuration n'a pas de solution (trop d'exclusions, par exemple). Le conteneur redémarre alors en boucle (`docker compose logs` affiche la raison). Pour en sortir, remettre l'ancienne configuration, ou réinitialiser avec `docker compose run --rm` (voir « Réinitialiser le tirage ») puis `docker compose restart`.

### Mettre à jour le code

```bash
git pull && docker compose up -d --build
```

---

## Fichier `participants.json`

```json
{
  "settings": { "drawsPerPerson": 2, "maxTimesDrawn": 2 },
  "participants": [
    { "name": "Thibault", "password": "..." },
    { "name": "Hugues",   "password": "..." }
  ],
  "admin": { "name": "Admin", "password": "..." },
  "exclusions": [["Hugues", "Coralie"]]
}
```

- `drawsPerPerson` : nombre de personnes tirées par chacun ; `maxTimesDrawn` : nombre maximum de fois où une personne peut être tirée. Avec des valeurs égales, chacun reçoit autant de cadeaux qu'il en offre.
- Le prénom sert d'identifiant. La connexion ignore majuscules et accents (`oceane` = `Océane`), donc deux prénoms qui ne diffèrent que par là sont refusés.
- Une exclusion `["A", "B"]` interdit A → B **et** B → A.

> **Attention : ce fichier contient les mots de passe en clair** et il est versionné dans le dépôt (dépôt privé, sécurité faible assumée). Si le dépôt devient public :
>
> ```bash
> git rm --cached backend/config/participants.json
> echo "backend/config/participants.json" >> .gitignore
> git commit -m "Retire participants.json du dépôt"
> ```
>
> Garder alors une copie du fichier sur la machine de déploiement, et changer les mots de passe : ils restent lisibles dans l'historique Git.

---

## Accès depuis l'extérieur

Le site écoute en HTTP sur le réseau local. Pour que la famille y accède depuis l'extérieur, plusieurs options s'offrent au propriétaire (rien n'est fourni ici) :

- redirection de port sur la box (simple, mais en HTTP, donc sans chiffrement) ;
- reverse proxy avec HTTPS : Caddy, Nginx Proxy Manager… ;
- tunnel : Cloudflare Tunnel, Tailscale Funnel.

Si le site est servi en HTTPS, passer `COOKIE_SECURE=true` dans `.env` puis `docker compose up -d`.

---

## Développement (sans Docker)

Prérequis : Node.js 22 (`nvm use` lit le fichier `.nvmrc`).

```bash
# Terminal 1 : API sur http://localhost:3000
cd backend && npm install && npm run dev

# Terminal 2 : front sur http://localhost:5173 (le proxy Vite redirige /api vers le port 3000)
cd frontend && npm install && npm run dev
```

En dev, la base est créée dans `backend/data/secret-santa.db` et un secret JWT de développement est utilisé (avec un avertissement dans la console).

Pour tester le front compilé servi par Express, comme en production :

```bash
cd frontend && npm run build
cd ../backend && STATIC_DIR=../frontend/dist npm run dev   # http://localhost:3000
```

Scripts utiles dans `backend/` :

| Commande | Effet |
|---|---|
| `npm test` | Tests unitaires (algorithme de tirage) et d'intégration (API) |
| `npm run db:init` | Crée le schéma (idempotent) |
| `npm run db:seed` | Insère ou met à jour les utilisateurs à partir de `participants.json` |
| `npm run db:reset` | Supprime les tirages (`-- --letters` : les lettres aussi) |

---

## Arborescence

```
backend/
  config/participants.json   utilisateurs, mots de passe, exclusions
  src/server.js              démarrage : init + seed de la base, puis écoute
  src/app.js                 application Express (utilisée aussi par les tests)
  src/db/                    schéma SQLite, scripts init / seed / reset
  src/services/              algorithme de tirage (fonctions pures) et transaction autour
  src/routes/                endpoints REST (auth, users, draw, letters, admin)
  test/                      tests node:test + supertest
frontend/
  src/pages/                 connexion, mon tirage, ma lettre, les lettres, admin
Dockerfile                   construction multi-étapes (front, dépendances, image finale)
docker-compose.yml
```
