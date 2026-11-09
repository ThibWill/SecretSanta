# Avancement

Specs : `specs/`. Ordre d'implémentation : `specs/00-README.md` §5.

| Étape | État |
|---|---|
| 1. Squelette (backend) | ✅ |
| 2. Base de données (init / seed / reset) | ✅ |
| 3. Algorithme de tirage + tests A1–A13 | ✅ |
| 4. API + `drawService.js` + tests d'intégration | ⏳ session B |
| 5. Frontend (y compris `frontend/package.json`) | ⏳ session C |
| 6. Docker | ⏳ session D |
| 7. Recette | ⏳ session D |
| 8. README | ⏳ session D |

## Notes techniques (environnement de dev)

- **Node 22 requis** : `nvm use` (fichier `.nvmrc`). Node 20 est encore la version par défaut de nvm sur cette machine (`nvm alias default 22` pour changer).
- **better-sqlite3 figé en v12** : la v13 a besoin de glibc ≥ 2.33 (binaire précompilé) ou de g++ ≥ 10 (C++20) pour compiler, or ce WSL est en Ubuntu 20.04 (glibc 2.31, g++ 9). La v12 a la même API. À reconsidérer si le WSL passe en Ubuntu 22.04+.
- `seed(db, config, { bcryptCost })` : coût 10 par défaut, 4 dans les tests pour aller plus vite.
- Tests : `cd backend && npm test` (21 tests verts à la fin de la session A).
