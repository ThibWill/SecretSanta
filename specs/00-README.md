# Secret Santa familial — Spécifications (vue d'ensemble)

Ce dossier contient les spécifications complètes d'un petit site de Secret Santa familial. Il est destiné à être implémenté par une IA de développement. **Lis tous les fichiers avant d'écrire du code**, puis implémente dans l'ordre indiqué en bas de ce document.

| Fichier | Contenu |
|---|---|
| `00-README.md` | Contexte, règles métier, stack, arborescence, ordre d'implémentation |
| `01-base-de-donnees.md` | Schéma SQLite, fichier de configuration des participants, scripts init / seed / reset |
| `02-backend-api.md` | Serveur Node.js, authentification, endpoints REST |
| `03-tirage-au-sort.md` | Algorithme de tirage (partie la plus sensible) |
| `04-frontend.md` | Application React, écrans, parcours |
| `05-docker-deploiement.md` | Dockerfile, docker-compose, déploiement sur Raspberry Pi ou équivalent |
| `06-tests-et-recette.md` | Tests automatisés et checklist de recette manuelle |

## 1. Contexte

Site privé pour une famille de 6 personnes, utilisé pour Noël 2026. Le niveau de sécurité attendu est faible (ce n'est pas grave si le site est compromis), mais **la confidentialité des tirages entre membres de la famille est essentielle** : personne ne doit pouvoir découvrir qui l'a tiré, y compris l'administrateur via l'interface.

## 2. Règles métier

### Participants

Thibault, Hugues, Océane, Romane, Bérénice, Coralie.

Un compte supplémentaire `Admin` existe : il ne participe pas au tirage et n'a pas de lettre.

### Tirage au sort

- Chaque participant tire **exactement 2 personnes différentes** (il offre donc 2 cadeaux).
- Chaque participant peut être tiré **au maximum 2 fois**. Quand tout le monde a tiré, chacun a donc été tiré exactement 2 fois.
- On ne peut pas se tirer soi-même.
- **Exclusion** : Hugues ne peut pas tirer Coralie, et Coralie ne peut pas tirer Hugues.
- Le tirage est **individuel** : chaque participant se connecte et clique sur un bouton. Un seul clic tire les 2 personnes d'un coup.
- Le tirage est **définitif** et reste consultable à chaque connexion.
- Le tirage ne doit **jamais aboutir à une impasse** : à chaque tirage, le serveur ne retient qu'un résultat qui laisse une solution valide aux participants qui n'ont pas encore tiré (voir `03-tirage-au-sort.md`).
- Une table en base enregistre les tirages effectués ; c'est elle qui permet de savoir qui a déjà été tiré et combien de fois.

### Lettres

- Chaque participant peut rédiger **une** lettre (texte simple) pour indiquer ce qu'il souhaite.
- La lettre est modifiable à tout moment.
- **Toutes les lettres sont visibles par tous** les utilisateurs connectés.

### Connexion

- Utilisateurs définis en dur dans un fichier de configuration, insérés en base par un script.
- Identifiant = prénom. Mot de passe fixe, simple, stocké haché. Pas d'inscription, pas de changement de mot de passe, pas de « mot de passe oublié ».

### Administration

L'admin peut :
- voir, pour chaque participant, **s'il a tiré** et **s'il a écrit sa lettre** (booléens uniquement, jamais le résultat des tirages) ;
- **réinitialiser le tirage** (avec option pour effacer aussi les lettres).

### Réutilisation

Le site sert pour ce Noël. Il doit rester réutilisable une autre année en modifiant le fichier de configuration (participants, exclusions) puis en réinitialisant. Pas d'historique entre années.

## 3. Stack technique

| Élément | Choix |
|---|---|
| Runtime | Node.js 22 LTS |
| Backend | Express 5, JavaScript (modules ES), pas de TypeScript |
| Base de données | SQLite via `better-sqlite3` (API synchrone, transactions simples) |
| Hachage | `bcryptjs` (JS pur, aucun souci de compilation sur ARM) |
| Session | JWT signé (`jsonwebtoken`) dans un cookie `httpOnly` |
| Frontend | React 18+ avec Vite, React Router, JavaScript, CSS simple sans bibliothèque UI |
| Tests | `node:test` + `supertest` côté backend |
| Déploiement | Un seul conteneur Docker : Express sert l'API **et** le front compilé. Fichier SQLite dans un volume. |

Contraintes générales :
- Interface entièrement **en français**, conçue **d'abord pour mobile**.
- Dépendances réduites au strict nécessaire.
- L'image Docker doit se construire sur ARM (Raspberry Pi ou équivalent).

## 4. Arborescence cible

```
secret-santa/
├── backend/
│   ├── package.json
│   ├── config/
│   │   └── participants.json        # utilisateurs, mots de passe, exclusions
│   ├── src/
│   │   ├── server.js                # point d'entrée : bootstrap BDD + écoute
│   │   ├── app.js                   # création de l'app Express (exportée pour les tests)
│   │   ├── config.js                # lecture des variables d'environnement
│   │   ├── db/
│   │   │   ├── connection.js
│   │   │   ├── schema.sql
│   │   │   ├── init.js              # crée le schéma (idempotent)
│   │   │   ├── seed.js              # insère / met à jour les utilisateurs
│   │   │   └── reset.js             # vide tirages (+ lettres en option)
│   │   ├── middleware/
│   │   │   ├── auth.js              # requireAuth, requireParticipant, requireAdmin
│   │   │   └── errors.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   ├── draw.js
│   │   │   ├── letters.js
│   │   │   └── admin.js
│   │   └── services/
│   │       ├── drawAlgorithm.js     # fonctions pures, sans BDD
│   │       └── drawService.js       # transaction BDD autour de l'algorithme
│   └── test/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md                        # lancement en dev, déploiement, réinitialisation
```

## 5. Ordre d'implémentation

Chaque étape doit être terminée et vérifiée avant de passer à la suivante.

1. **Squelette** : arborescence, `package.json`, `.gitignore`, `.env.example`.
2. **Base de données** (`01`) : schéma, `init`, `seed`, `reset`. Vérification : la base est créée et contient 7 utilisateurs et 1 exclusion.
3. **Algorithme de tirage** (`03`) en fonctions pures, avec ses tests unitaires (`06`). Vérification : tous les tests passent, dont la simulation de 1000 tirages complets.
4. **API** (`02`) : auth, tirage, lettres, admin, avec tests d'intégration. Vérification : tests verts.
5. **Frontend** (`04`). Vérification : parcours complet en local sur un écran de 375 px de large.
6. **Docker** (`05`). Vérification : `docker compose up -d --build` donne un site fonctionnel sur le port configuré, et les données survivent à un redémarrage.
7. **Recette** (`06`) : dérouler la checklist manuelle.
8. **README.md** du projet : lancement en dev, déploiement, changement des mots de passe, réinitialisation, adaptation pour une autre année.

## 6. Points de vigilance

- **Aucune fuite de tirage** : aucun endpoint ne renvoie les tirages d'un autre utilisateur ; les logs serveur n'affichent jamais qui a tiré qui.
- **Atomicité** : le tirage d'un utilisateur (lecture de l'état, choix, 2 insertions) se fait dans une seule transaction.
- **Pas d'impasse** : voir `03-tirage-au-sort.md`.
- Ne pas ajouter de fonctionnalités non demandées (inscription, e-mails, budget, historique, etc.).
