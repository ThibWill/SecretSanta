# 05 — Docker et déploiement

## 1. Principe

- **Un seul conteneur** : Express sert l'API et le front compilé, sur un seul port.
- Le fichier SQLite est dans un **volume** (`./data` sur l'hôte → `/data` dans le conteneur).
- Le fichier `participants.json` est **monté depuis l'hôte**, pour pouvoir changer mots de passe et participants sans reconstruire l'image.
- L'image est construite directement sur la machine cible (Raspberry Pi ou équivalent ARM), ce qui évite toute compilation croisée.

## 2. Dockerfile (à la racine, multi-étapes)

```dockerfile
# --- Étape 1 : compilation du front ---
FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Étape 2 : dépendances du back (avec outils de compilation au cas où
#     better-sqlite3 n'aurait pas de binaire précompilé pour l'architecture) ---
FROM node:22-bookworm-slim AS backend-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# --- Étape 3 : image finale ---
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/secret-santa.db \
    PARTICIPANTS_FILE=/app/backend/config/participants.json \
    STATIC_DIR=/app/frontend/dist
WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
```

Notes :
- Utiliser une image Debian (`bookworm-slim`) et non Alpine : meilleure compatibilité des binaires précompilés de `better-sqlite3` sur ARM.
- Ajouter un `.dockerignore` : `**/node_modules`, `frontend/dist`, `data`, `.git`, `.env`.

## 3. docker-compose.yml

```yaml
services:
  secret-santa:
    build: .
    container_name: secret-santa
    restart: unless-stopped
    ports:
      - "${HOST_PORT:-8080}:3000"
    environment:
      JWT_SECRET: ${JWT_SECRET:?Définis JWT_SECRET dans le fichier .env}
      COOKIE_SECURE: ${COOKIE_SECURE:-false}
    volumes:
      - ./data:/data
      - ./backend/config/participants.json:/app/backend/config/participants.json:ro
```

Le dossier `./data` doit être accessible en écriture par l'utilisateur `node` du conteneur (UID 1000). Le README doit indiquer la commande à lancer si ce n'est pas le cas : `sudo chown -R 1000:1000 data`.

## 4. `.env.example`

```
# Port exposé sur la machine hôte
HOST_PORT=8080
# Chaîne aléatoire longue. Exemple pour en générer une : openssl rand -hex 32
JWT_SECRET=
# true uniquement si le site est servi en HTTPS (derrière un reverse proxy)
COOKIE_SECURE=false
```

## 5. `.gitignore`

```
node_modules/
frontend/dist/
data/
.env
```

`backend/config/participants.json` contient des mots de passe en clair. Par défaut il reste versionné (dépôt privé, sécurité faible assumée). Le README doit le signaler et expliquer comment l'exclure du dépôt si celui-ci devient public.

## 6. Procédures à documenter dans le README du projet

### Premier déploiement

```bash
git clone <dépôt> && cd secret-santa
cp .env.example .env          # puis renseigner JWT_SECRET
nano backend/config/participants.json   # définir les mots de passe
mkdir -p data
docker compose up -d --build
```

Le site est alors disponible sur `http://<ip-de-la-machine>:8080`.

### Changer un mot de passe

Modifier `participants.json`, puis `docker compose restart` (le seed s'exécute à chaque démarrage et met à jour les hash).

### Réinitialiser le tirage

Depuis l'interface admin, ou en ligne de commande :

```bash
docker compose exec secret-santa npm run db:reset              # tirages seuls
docker compose exec secret-santa npm run db:reset -- --letters # tirages + lettres
```

### Sauvegarder

Copier le dossier `data/` (conteneur arrêté, ou copier aussi les fichiers `-wal` et `-shm`).

### Réutiliser une autre année

1. Réinitialiser le tirage et les lettres.
2. Modifier participants et exclusions dans `participants.json`.
3. `docker compose restart`.

### Mettre à jour le code

```bash
git pull && docker compose up -d --build
```

## 7. Accès depuis l'extérieur (information pour le README, hors implémentation)

Le site écoute en HTTP. Pour que la famille y accède hors du réseau local, plusieurs options existent : redirection de port sur la box, reverse proxy avec HTTPS (Caddy, Nginx Proxy Manager), ou tunnel (Cloudflare Tunnel, Tailscale Funnel). Si le site est servi en HTTPS, passer `COOKIE_SECURE=true`. Ce choix est laissé au propriétaire et n'est pas à implémenter.

## 8. Lancement en développement (sans Docker)

```bash
# Terminal 1
cd backend && npm install && npm run dev     # API sur http://localhost:3000

# Terminal 2
cd frontend && npm install && npm run dev    # Front sur http://localhost:5173, proxy /api
```

## 9. Critères de validation

- `docker compose up -d --build` réussit sur une machine ARM64 et sur une machine x86.
- Le conteneur passe à l'état `healthy`.
- Après `docker compose down && docker compose up -d`, les tirages et lettres sont toujours présents.
- Sans `JWT_SECRET`, `docker compose up` échoue avec le message prévu.
- Le conteneur ne tourne pas en root.
