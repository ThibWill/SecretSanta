# 04 — Frontend

## 1. Généralités

- React 18+ avec Vite, JavaScript, React Router.
- Aucune bibliothèque de composants ni de gestion d'état : `useState`, `useEffect`, un `AuthContext`, et CSS simple (un fichier global + variables CSS). Seules dépendances visuelles autorisées : les polices `@fontsource` listées en section 7.1.
- La direction artistique (section 7.1) fait partie du cahier des charges au même titre que les fonctionnalités : ne pas livrer une interface neutre.
- Interface **en français**, tutoiement, ton chaleureux et familial.
- **Mobile d'abord** : conçu pour 360 à 430 px de large, puis contenu centré (largeur max 480 px) sur grand écran.
- En développement, `vite.config.js` redirige `/api` vers `http://localhost:3000`.
- Toutes les requêtes passent par un petit module `src/api.js` (`fetch` avec `credentials: 'same-origin'`, analyse du JSON, levée d'une erreur portant `code` et `message` quand la réponse n'est pas 2xx).

## 2. Arborescence

```
frontend/src/
├── main.jsx
├── App.jsx                 # routes
├── api.js                  # appels à l'API
├── AuthContext.jsx         # utilisateur courant, login(), logout()
├── styles.css
├── components/
│   ├── Layout.jsx          # en-tête + barre de navigation basse
│   ├── ProtectedRoute.jsx
│   ├── LetterCard.jsx
│   └── ConfirmDialog.jsx
└── pages/
    ├── LoginPage.jsx
    ├── HomePage.jsx        # tirage
    ├── MyLetterPage.jsx
    ├── LettersPage.jsx
    └── AdminPage.jsx
```

## 3. Routes

| Chemin | Page | Accès |
|---|---|---|
| `/connexion` | Connexion | Public (redirige vers `/` si déjà connecté) |
| `/` | Mon tirage | Participant (l'admin est redirigé vers `/admin`) |
| `/ma-lettre` | Ma lettre | Participant |
| `/lettres` | Toutes les lettres | Tout utilisateur connecté |
| `/admin` | Administration | Admin |

Au chargement, l'application appelle `GET /api/auth/me`. Pendant l'appel : écran de chargement. Si `401` : redirection vers `/connexion`. Toute réponse `401` ultérieure renvoie aussi vers `/connexion`.

## 4. Mise en page commune (`Layout`)

- En-tête : titre « 🎄 Secret Santa », prénom de l'utilisateur, bouton « Se déconnecter ».
- **Barre de navigation fixe en bas** de l'écran :
  - participant : « Mon tirage », « Ma lettre », « Les lettres » ;
  - admin : « Admin », « Les lettres ».
- Zones tactiles d'au moins 44 px de haut. Prévoir un `padding-bottom` sur le contenu pour qu'il ne passe pas sous la barre, et respecter `env(safe-area-inset-bottom)`.

## 5. Pages

### 5.1 Connexion (`/connexion`)

- Charge `GET /api/users/names`.
- Champ « Qui es-tu ? » : liste déroulante (`<select>`) des prénoms, avec une option vide « Choisis ton prénom ». Cela évite de taper les accents sur mobile.
- Champ « Mot de passe » (`type="password"`, `autocomplete="current-password"`).
- Bouton « Se connecter », désactivé tant que les deux champs ne sont pas remplis et pendant l'envoi.
- En cas d'erreur : afficher le message renvoyé par l'API sous le formulaire.
- Succès : redirection vers `/` (ou `/admin` pour l'admin).

### 5.2 Mon tirage (`/`)

Charge `GET /api/draw`.

**Cas A — pas encore tiré**

- Texte : « Tu vas tirer au sort **2 personnes** à qui offrir un cadeau. Le tirage est définitif. »
- Avertissement : « Assure-toi que personne ne regarde ton écran 👀 »
- Gros bouton « 🎁 Tirer au sort ».
- Au clic : boîte de confirmation (« Prêt·e ? Le tirage ne pourra pas être refait. » / « Annuler » / « C'est parti »), puis `POST /api/draw`.
- Pendant l'appel : bouton désactivé (empêcher le double clic).
- Révélation : courte animation (les 2 cartes apparaissent l'une après l'autre, ~1 s d'écart). Respecter `prefers-reduced-motion` (pas d'animation dans ce cas).
- Si l'API renvoie `409 ALREADY_DRAWN` : recharger `GET /api/draw` et afficher le cas B.

**Cas B — déjà tiré**

- Titre : « Tu offres un cadeau à : ».
- Deux cartes, une par personne tirée : prénom en grand, puis sa lettre (texte complet) ou « *Prénom* n'a pas encore écrit sa lettre. »
- Les lettres affichées sont celles renvoyées par `GET /api/draw`, donc à jour à chaque visite.

### 5.3 Ma lettre (`/ma-lettre`)

- Charge `GET /api/letters/me`.
- Texte d'aide : « Écris ici ce qui te ferait plaisir. Tout le monde pourra lire ta lettre. »
- `<textarea>` d'au moins 10 lignes, `maxLength={5000}`, compteur « 123 / 5000 ».
- Bouton « Enregistrer » (`PUT /api/letters/me`), désactivé s'il n'y a aucun changement ou pendant l'envoi.
- Après succès : message « Lettre enregistrée ✓ » et date de dernière modification.
- En cas d'erreur : message de l'API, le texte saisi est conservé.
- Si des modifications ne sont pas enregistrées et que l'utilisateur quitte ou recharge la page : avertissement via `beforeunload`.

### 5.4 Toutes les lettres (`/lettres`)

- Charge `GET /api/letters`.
- Liste de cartes par ordre alphabétique : prénom, date de dernière modification, texte de la lettre.
- Participants sans lettre : carte grisée « Pas encore de lettre ».
- La carte de l'utilisateur connecté porte la mention « (toi) » et un lien « Modifier » vers `/ma-lettre`.
- **Ne rien afficher ici qui révèle les personnes tirées par l'utilisateur** (pas de mise en avant de leurs cartes) : quelqu'un pourrait regarder l'écran.

### 5.5 Administration (`/admin`)

- Charge `GET /api/admin/status`.
- Résumé : « 4 tirages effectués sur 6 ».
- Tableau : prénom, « A tiré » (✅ / ⏳), « A écrit sa lettre » (✅ / ⏳).
- Bouton « Actualiser ».
- Section « Zone dangereuse » :
  - case à cocher « Effacer aussi les lettres » (décochée par défaut) ;
  - bouton rouge « Réinitialiser le tirage » ;
  - boîte de confirmation : « Tous les tirages seront effacés et chacun devra retirer. Cette action est irréversible. » ;
  - `POST /api/admin/reset`, puis mise à jour du tableau et message « Tirage réinitialisé ».

## 6. Affichage des lettres

- Les lettres sont du **texte brut** : les afficher comme enfant texte React (jamais `dangerouslySetInnerHTML`), avec `white-space: pre-wrap` et `overflow-wrap: anywhere`.
- Dates : l'API renvoie des dates UTC au format `YYYY-MM-DD HH:MM:SS`. Les convertir et les afficher en français, ex. « modifiée le 20 novembre à 19:02 » (`Intl.DateTimeFormat('fr-FR')`).

## 7. Style

### 7.1 Direction artistique

**Intention** : un Noël de famille, chaleureux, généreux et un peu rétro, comme une carte de vœux illustrée ou un salon décoré. **Pas de style épuré ou minimaliste** : on veut de la couleur, de la matière et des décorations, sans nuire à la lisibilité.

**Palette** (en variables CSS dans `:root`) :

| Variable | Couleur | Usage |
|---|---|---|
| `--vert-sapin` | `#0F3D2E` | Fond général de l'application |
| `--vert-houx` | `#1F6B4A` | Dégradés du fond, accents, barre de navigation |
| `--rouge-noel` | `#B3202A` | Boutons principaux, rubans, en-tête |
| `--rouge-fonce` | `#7A1420` | Ombres et états pressés des boutons, dégradés |
| `--or` | `#E0B04A` | Bordures, étoiles, filets décoratifs, onglet actif |
| `--creme` | `#FBF3E4` | Fond des cartes et des lettres (aspect papier) |
| `--brun-chaud` | `#3B2A20` | Texte sur fond crème |
| `--neige` | `#FFFFFF` | Flocons, texte sur fond vert ou rouge |

**Typographie** (polices auto-hébergées via les paquets npm `@fontsource`, aucun appel à un CDN) :
- Titres : **Mountains of Christmas** (700), pour le titre du site, les titres de page et les prénoms tirés.
- Texte courant, boutons, formulaires : **Nunito** (400, 600, 700), ronde et chaleureuse.
- Texte des lettres : **Caveat** (500), aspect manuscrit, taille 20 px minimum pour rester lisible.

**Fond et ambiance** :
- Fond vert sapin avec un dégradé radial plus clair au centre et un léger motif répété (étoiles ou flocons en SVG, opacité faible).
- **Neige qui tombe** en arrière-plan : une vingtaine de flocons animés en CSS pur, derrière le contenu, `pointer-events: none`.
- En-tête rouge avec une **guirlande lumineuse** en SVG sous le bord inférieur (ampoules or, rouge, vert, crème qui scintillent doucement).

**Composants** :
- **Cartes** : fond crème, coins arrondis (16 px), bordure or fine, ombre portée chaude. Elles évoquent des cartes de vœux posées sur le fond vert.
- **Lettres** : aspect « lettre au Père Noël » : papier crème légèrement texturé (dégradé ou lignes fines), police manuscrite, petit timbre ou cachet de cire rouge décoratif dans un angle, prénom de l'auteur en titre.
- **Bouton principal** : rouge avec dégradé, texte crème, ombre basse rouge foncé donnant du relief, effet d'enfoncement au clic. Le bouton « Tirer au sort » est très gros et décoré comme un **paquet cadeau** (ruban et nœud dorés).
- **Cartes des personnes tirées** : en forme d'**étiquette cadeau** (coin perforé avec ficelle), prénom en grand en Mountains of Christmas.
- **Révélation du tirage** : le cadeau s'ouvre (couvercle qui se soulève), puis les deux étiquettes apparaissent l'une après l'autre avec une pluie de confettis or et rouge en CSS.
- **Barre de navigation basse** : vert houx, icônes festives (🎁 Mon tirage, ✉️ Ma lettre, 📜 Les lettres, ⭐ Admin), onglet actif souligné en or.
- **Écran de connexion** : grand titre, sapin ou couronne illustrés en SVG au-dessus du formulaire, formulaire dans une carte crème.
- **États vides et chargements** : formulés dans le ton (« Le lutin cherche tes lettres… », « Pas encore de lettre, le traîneau attend ! »).
- **Zone dangereuse de l'admin** : reste sobre et clairement distincte (bordure rouge, pas de décoration), pour éviter toute confusion.

**Illustrations** : uniquement des SVG intégrés au code et des émojis. Aucune image externe ni bibliothèque d'animation.

**Garde-fous** :
- La décoration ne doit jamais gêner la lecture : le texte est toujours posé sur un aplat (crème, rouge ou vert), jamais directement sur un motif.
- Avec `prefers-reduced-motion: reduce` : pas de neige, pas de scintillement, pas de confettis, révélation immédiate.
- Les animations n'utilisent que `transform` et `opacity`, pour rester fluides sur un téléphone d'entrée de gamme.

### 7.2 Règles générales

- Taille de base 16 px minimum (évite le zoom automatique d'iOS sur les champs).
- Contraste suffisant (AA) pour tous les textes, focus visible (contour or), libellés associés aux champs (`<label htmlFor>`).
- Chaque page gère trois états : chargement, erreur (message + bouton « Réessayer »), contenu.
- `index.html` : `lang="fr"`, balise viewport, titre « Secret Santa », `<meta name="robots" content="noindex">`.

## 8. Critères de validation

- Parcours complet utilisable au pouce sur un écran de 375 px, sans défilement horizontal.
- Un double clic sur « Tirer au sort » ne déclenche qu'un seul tirage.
- Après un rechargement de la page, l'utilisateur reste connecté et retrouve son tirage.
- Une lettre contenant `<b>test</b>` ou des sauts de ligne s'affiche telle quelle, sans interprétation HTML.
- L'admin ne voit aucun lien vers « Mon tirage » ni « Ma lettre » ; un participant qui ouvre `/admin` est redirigé vers `/`.
