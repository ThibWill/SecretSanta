# Avancement

Specs : `specs/`. Ordre d'implémentation : `specs/00-README.md` §5.

| Étape | État |
|---|---|
| 1. Squelette (backend) | ✅ |
| 2. Base de données (init / seed / reset) | ✅ |
| 3. Algorithme de tirage + tests A1–A13 | ✅ |
| 4. API + `drawService.js` + tests d'intégration | ✅ |
| 5. Frontend (y compris `frontend/package.json`) | ✅ |
| 6. Docker | ✅ |
| 7. Recette | ✅ (automatisée, voir notes D ; reste à faire sur un vrai téléphone et sur le Raspberry Pi) |
| 8. README | ✅ |

## Notes techniques (environnement de dev)

- **Node 22 requis** : `nvm use` (fichier `.nvmrc`). Node 20 est encore la version par défaut de nvm sur cette machine (`nvm alias default 22` pour changer).
- **better-sqlite3 figé en v12** : la v13 a besoin de glibc ≥ 2.33 (binaire précompilé) ou de g++ ≥ 10 (C++20) pour compiler, or ce WSL est en Ubuntu 20.04 (glibc 2.31, g++ 9). La v12 a la même API. À reconsidérer si le WSL passe en Ubuntu 22.04+.
- `seed(db, config, { bcryptCost })` : coût 10 par défaut, 4 dans les tests pour aller plus vite.
- Tests : `cd backend && npm test` (21 tests verts à la fin de la session A, 52 à la fin de la session B).

## Notes de la session B (API)

- `createApp({ db, settings, appConfig, log })` : `settings` = paramètres du tirage (`drawsPerPerson`, `maxTimesDrawn`, issus du seed) ; `appConfig` (défaut : `src/config.js`) porte `jwtSecret`, `cookieSecure`, `staticDir` ; `log: false` coupe le journal des requêtes (tests).
- `server.js` : sans `JWT_SECRET`, secret de dev + avertissement ; en `NODE_ENV=production`, arrêt avec code 1.
- Erreurs : classe `AppError` + fabriques (`alreadyDrawn()`, `forbidden()`…) dans `middleware/errors.js`. JSON mal formé ou corps > 50 ko → `400 VALIDATION_ERROR`.
- Login : hash factice comparé quand l'identifiant est inconnu (même temps de réponse).
- `POST /api/admin/reset` : corps optionnel (`resetLetters` = false par défaut), `400` si `resetLetters` n'est pas un booléen.
- Fallback SPA : `app.get('/{*splat}')` (syntaxe Express 5), actif seulement si `STATIC_DIR` est défini. Vérifié à la main avec un faux `index.html`.
- Helpers de test : `createTestApp()`, `loginAs(app, name)`, `userId(db, name)` dans `test/helpers.js`.
- Pour la session C : le proxy Vite doit rediriger `/api` vers `http://localhost:3000` (lancer le back avec `npm run dev` dans `backend/`).

## Notes de la session C (frontend)

- Versions : React 19, React Router 7 (paquet `react-router`, pas `react-router-dom` ; v8 écartée car trop récente), Vite 8. Vite 8 compile sans souci sur ce WSL (glibc 2.31).
- Polices `@fontsource` : seulement le jeu latin (`latin-400.css`…), donc pas de cyrillique dans le build.
- Routeur créé avec `createBrowserRouter` (routeur « data ») pour pouvoir utiliser `useBlocker` : avertissement aussi lors d'une navigation interne quand la lettre n'est pas enregistrée, en plus de `beforeunload`.
- Fichiers en plus de l'arborescence de la spec : `useApi.js` (chargement/erreur/rechargement), `dates.js`, `components/Decorations.jsx` (neige, guirlande, sapin, nœud, confettis), `components/PageStatus.jsx` (chargement, erreur, titre en ruban).
- Tester en local : `cd frontend && npm run build`, puis `cd backend && STATIC_DIR=../frontend/dist npm run dev`, et ouvrir http://localhost:3000 (mode mobile du navigateur, 375 px). Ou `npm run dev` dans les deux dossiers et ouvrir http://localhost:5173.
- Vérification : un script Playwright jetable (hors dépôt, Chromium headless à 375 et 360 px) a passé 37 contrôles. Parcours connexion, lettre, tirage et admin ; « Annuler » ; double clic → un seul `POST /api/draw` ; pas de défilement horizontal ; HTML des lettres non interprété ; redirections selon le rôle ; mouvement réduit ; aucune erreur console. Captures relues à l'œil. Les émojis n'ont pas pu être vus (pas de police émoji dans Chromium headless) : à contrôler pendant la recette.
- Réseau WSL lent (environ 50 Ko/s) : réglé en désactivant RSC et LSO sur la carte `vEthernet (WSL (Hyper-V firewall))` côté Windows. Réglage peut-être non permanent : si ça redevient lent, recommencer ou passer en `networkingMode=mirrored` (`.wslconfig`).

## Notes pour la session D (Docker)

- Docker Desktop côté Windows, intégration WSL activée pour `Ubuntu-20.04`. Version ancienne : Docker 20.10.11, Compose v2.2.1 (2021). Utiliser la commande `docker compose` (v2), et éviter les options récentes de Compose (`develop`, `include`, etc.).
- Si `docker` est introuvable dans le WSL alors que l'intégration est active, le moteur est arrêté : le redémarrer depuis Docker Desktop.
- Docker tourne ici en x86_64 : l'image ne sera pas testée sur ARM. Garder des images de base multi-architecture (`node:22-bookworm-slim`).

## Notes de la session D (Docker, recette, README)

- `Dockerfile`, `docker-compose.yml`, `.dockerignore` conformes à la spec 05, avec deux écarts :
  - **Montage du dossier `./backend/config`** (lecture seule) au lieu du fichier `participants.json` seul. Avec un montage de fichier, tout éditeur qui remplace le fichier (`sed -i`, `git checkout`, vim…) casse le conteneur au `docker compose restart` (`mount through procfd: no such file or directory`, conteneur arrêté en code 127). Constaté ici sous Docker Desktop/WSL.
  - `COPY --chown=node:node` au lieu d'un `chown -R /app` final (31 s et une couche dupliquée de moins). Image finale : 244 Mo.
  - `.dockerignore` exclut aussi `backend/test`, `specs` et `PROGRESS.md`.
- `app.js` : `/api/health` n'est plus journalisé (le healthcheck l'appelle toutes les 30 s).
- Vérifié (x86_64, Docker 20.10.11) : build OK, conteneur `healthy`, utilisateur `node` (UID 1000) ; sans `JWT_SECRET`, Compose refuse avec le message prévu ; données conservées après `restart` et après `down` + `up` ; changement de mot de passe pris en compte par `restart` ; modification des exclusions avec des tirages existants → refus explicite et redémarrage en boucle, d'où on sort avec `docker compose run --rm secret-santa npm run db:reset` (documenté dans le README) ; `npm run db:reset [-- --letters]` via `exec` OK.
- Recette automatisée sur l'instance Docker (scripts jetables hors dépôt) :
  - API : 615 contrôles, dont 23 ordres de passage complets (3 imposés + 20 aléatoires) avec reset entre chaque ; exclusion, 2 receveurs distincts, chacun tiré 2 fois, 409 au second tirage, lettres (sauts de ligne, émojis, HTML brut, 5000 caractères max), lettre visible dans le tirage du donneur et mise à jour, droits admin/participant, reset avec ou sans lettres.
  - Logs : aucun mot de passe ni prénom. Seulement « Tirage effectué par l'utilisateur N » (id du donneur, jamais les receveurs).
  - Interface (Playwright, 375 et 360 px) : 48 contrôles de la checklist 06 §4, avec captures relues à l'œil. Émojis enfin vérifiés en chargeant Noto Color Emoji via un `FONTCONFIG_FILE` local.
- **Bug corrigé grâce aux émojis** : dans l'en-tête, le 🎄 tronquait le prénom (« Rom… ») et faisait passer « Se déconnecter » sur deux lignes. Le sapin est masqué sous 420 px et le bouton ne passe plus à la ligne. Vérifié : aucun prénom tronqué à 360 et 375 px.
- Reste à faire par le propriétaire : passer la checklist sur un vrai téléphone, puis construire sur le Raspberry Pi (ARM64, non testé ici) ; définir les vrais mots de passe dans `participants.json`.
- Le `.env` créé pour les tests (JWT_SECRET aléatoire) et le dossier `data/` sont ignorés par Git. L'instance de test tourne encore sur le port 8080, base vidée.
