# Avancement

Specs : `specs/`. Ordre d'implémentation : `specs/00-README.md` §5.

| Étape | État |
|---|---|
| 1. Squelette (backend) | ✅ |
| 2. Base de données (init / seed / reset) | ✅ |
| 3. Algorithme de tirage + tests A1–A13 | ✅ |
| 4. API + `drawService.js` + tests d'intégration | ✅ |
| 5. Frontend (y compris `frontend/package.json`) | ⏳ session C |
| 6. Docker | ⏳ session D |
| 7. Recette | ⏳ session D |
| 8. README | ⏳ session D |

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
