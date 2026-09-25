# SportSplitter by Orqea — connexion unique via Orqea

SportSplitter n'a **ni inscription, ni mot de passe, ni formulaire de connexion**. Orqea est son seul
fournisseur d'identité : on y entre uniquement depuis Orqea, et c'est l'administrateur d'Orqea qui accorde
(ou retire) l'accès, personne par personne. SportSplitter ne tient **aucune liste d'accès** : un jeton de
passation valide **est** la preuve de l'accès.

## 1. Le parcours

```
Utilisateur connecté sur Orqea, avec un accès SportSplitter accordé par l'admin
  └─ clique « SportSplitter » (lien visible SEULEMENT s'il a l'accès — côté Orqea)
      └─ Orqea : POST /api/apps/sportsplitter/handoff (sa session) → vérifie l'octroi
          └─ rend un JETON DE PASSATION (60 s) et redirige le navigateur vers
             https://<SPORTSPLITTER_PUBLIC_URL>/sso#sso=<jeton>
              └─ SportSplitter (frontend) lit le FRAGMENT, l'efface de l'URL
                 (history.replaceState), POST /api/auth/sso {token}
                  └─ backend SportSplitter vérifie le jeton, crée SA session
                     (cookie httpOnly), répond 204 → le frontend va sur « / »
```

Le jeton voyage dans le **fragment** (`#…`) : un fragment n'est jamais envoyé au serveur, donc il n'apparaît
ni dans les journaux d'accès nginx ni dans un en-tête `Referer`. Il ne passe **jamais** en query string, et
n'est jamais écrit dans `localStorage` ni `sessionStorage`. nginx envoie `Referrer-Policy: no-referrer`
partout et `Cache-Control: no-store` sur `/sso`.

## 2. Le jeton de passation (émis par Orqea, vérifié par SportSplitter)

JWT **HS256**, signé avec le secret partagé `SPORTSPLITTER_SSO_SECRET` (≥ 32 caractères ; en dessous, considère-le comme **absent** et refuse tout le monde). Claims :

| Claim | Valeur | Vérification obligatoire |
|---|---|---|
| `iss` | `"orqea"` | égalité stricte |
| `aud` | `"sportsplitter"` | égalité stricte |
| `sub` | id utilisateur Orqea, en **chaîne** (ex. `"4821"`) | non vide ; c'est la clé d'identité stable |
| `email` | e-mail Orqea | affichage seulement, **jamais** clé d'identité (il peut changer) |
| `name` | nom affiché | affichage seulement |
| `role` | `"user"` ou `"admin"` | tout autre valeur ⇒ refus |
| `iat`, `exp` | `exp - iat ≤ 60` s | `exp` dans le futur, tolérance d'horloge ≤ 10 s ; durée > 60 s ⇒ refus |
| `jti` | identifiant aléatoire unique | **usage unique** (voir ci-dessous) |

Utilise **PyJWT** avec `algorithms=["HS256"]` explicite (refuse `none` et tout autre algo), `audience` et `issuer` passés à `jwt.decode`, `options={"require": ["exp","iat","iss","aud","sub","jti","role"]}`.

**Usage unique** : table `sso_used_jti(jti PRIMARY KEY, expires_at)` ; insertion dans la même transaction que la création de session ; conflit de clé ⇒ refus 401 `SSO_REPLAYED`. Purge des lignes expirées à chaque échange (pas besoin de tâche de fond).

**Refus** : toute erreur de vérification ⇒ **401** `{ "code": "SSO_INVALID" | "SSO_EXPIRED" | "SSO_REPLAYED" | "SSO_DISABLED" }`. Ne renvoie jamais le détail de l'exception, ne journalise jamais le jeton ni le secret (journalise `code` + `sub` si lisible).

🔴 **Aucune liste d'utilisateurs autorisés côté SportSplitter** : l'octroi vit dans Orqea. Un jeton valide **est** la preuve de l'accès. Première connexion d'un `sub` inconnu ⇒ crée sa ligne `users` (sub, email, name, role, created_at, last_login_at) ; connexions suivantes ⇒ met à jour email/name/role/last_login_at depuis le jeton (Orqea fait foi, y compris pour rétrograder un admin).

### Exemple de jeton décodé (payload)

```json
{
  "iss": "orqea",
  "aud": "sportsplitter",
  "sub": "4821",
  "email": "erwann@orqea.dev",
  "name": "Erwann Laplante",
  "role": "admin",
  "iat": 1790282649,
  "exp": 1790282709,
  "jti": "3950db2ae9d14e6c895f51a3a9bcd6c0"
}
```

En-tête : `{"alg": "HS256", "typ": "JWT"}`. Produit (avec un secret d'exemple) par :

```bash
SPORTSPLITTER_SSO_SECRET=exemple-de-secret-partage-NE-PAS-UTILISER-0123 \
SPORTSPLITTER_PUBLIC_URL=https://sportsplitter.example \
python scripts/mint_sso_token.py --sub 4821 --role admin --email erwann@orqea.dev --name "Erwann Laplante" --decode
```

qui affiche le payload, le jeton, puis l'URL de redirection `https://sportsplitter.example/sso#sso=<jeton>`.

### Précisions d'implémentation (`backend/app/auth.py`)

* `aud` doit être la chaîne `"sportsplitter"` : une liste (même contenant `"sportsplitter"`) est refusée
  (`strict_aud`).
* `iat` et `exp` doivent être des entiers (secondes Unix) ; un `iat` dans le futur (au-delà des 10 s de
  tolérance) est refusé.
* Un jeton expiré ⇒ `SSO_EXPIRED` ; toute autre erreur de format ou de vérification ⇒ `SSO_INVALID`.
* L'utilisateur est créé ou mis à jour dans la même transaction que la consommation du `jti`.
* Le refus renvoie exactement `{"code": …}`. Seul le 401 `UNAUTHENTICATED` (routes protégées sans session)
  ajoute `orqeaUrl`, pour que l'écran « Accès via Orqea » pointe vers `SPORTSPLITTER_ORQEA_URL`.

## 3. La session SportSplitter

* **Deux secrets distincts** : `SPORTSPLITTER_SSO_SECRET` (partagé avec Orqea, ne sert qu'à vérifier les
  jetons de passation) et `SPORTSPLITTER_SESSION_SECRET` (propre à SportSplitter, signe la session). Le
  démarrage est refusé s'ils sont identiques ; une session signée avec le secret partagé est refusée.
* Cookie `ss_session` : `HttpOnly`, `SameSite=Lax`, `Secure` quand `SPORTSPLITTER_ENV=production`,
  `Path=/`. Contenu : JWT HS256 (`sub`, `role`, `iat`, `exp`, audience `sportsplitter-session`).
* Durée : **8 h**, sans rafraîchissement silencieux. `POST /api/auth/logout` efface le cookie (204).
  L'interface ne propose **pas** de déconnexion : la session vient d'Orqea, le menu offre
  « Retour sur Orqea » (vers `SPORTSPLITTER_ORQEA_URL`). Se déconnecter de SportSplitter seul
  laissait croire qu'on était sorti d'Orqea.
* `GET /api/me` ⇒ 401 sans session ; sinon `{ sub, email, name, role, permissions }`
  (`edit_workspace` pour tous, `edit_rules` pour `admin`).
* **CSRF** : toute requête `POST/PUT/PATCH/DELETE` (sauf `/api/auth/sso`) exige l'en-tête
  `X-Requested-With: sportsplitter` (sinon 403 `CSRF`) ; si l'en-tête `Origin` est présent, il doit valoir
  l'origine de `SPORTSPLITTER_PUBLIC_URL` (sinon 403 `BAD_ORIGIN`).
* **Pas de CORS** : le frontend est servi sur la même origine que `/api/` (nginx).
* **Tout est fermé par défaut** : toutes les routes `/api/*` exigent une session, sauf `GET /api/health`,
  `POST /api/auth/sso` et `POST /api/auth/logout`. C'est une dépendance (`require_user`) posée sur le routeur,
  et un test parcourt toutes les routes. La documentation OpenAPI (`/docs`) est désactivée en production.
* Sans session, le frontend n'affiche **rien** de l'application : seulement « Accès via Orqea » et un bouton
  vers `SPORTSPLITTER_ORQEA_URL`. Si la session expire en cours d'usage, la modification en cours est gardée
  dans la sauvegarde locale de cet utilisateur (clé `sportsplitter.workspace.<sub>`) puis renvoyée au
  serveur à la connexion suivante.

### Révocation

L'accès se retire **dans Orqea**. SportSplitter ne rappelle jamais Orqea (aucune dépendance d'exécution) :
une session déjà ouverte reste valable jusqu'à son expiration. **Délai maximal de propagation d'une
révocation : 8 h.** Pour couper immédiatement tous les accès, changez `SPORTSPLITTER_SESSION_SECRET` et
redémarrez (toutes les sessions deviennent invalides) ; pour couper Orqea, changez `SPORTSPLITTER_SSO_SECRET`.

## 4. Données par utilisateur

* Chaque utilisateur (clé : `sub`) a son propre espace de travail (`workspace.owner_sub`, unique).
* Les **règles de l'algorithme** (page Administration) sont **globales** (table `app_settings`) et ne sont
  modifiables que par `role=admin` (403 `RULES_ADMIN_ONLY` sinon). Les préférences de l'onglet Configuration
  (sens de remplissage, samedi) restent propres à chaque utilisateur.
* **Ancien espace unique** (ligne créée avant les comptes, sans propriétaire) : il n'est jamais supprimé.
  Posez `SPORTSPLITTER_LEGACY_OWNER_SUB=<sub Orqea>` et redémarrez : il est attribué à ce `sub`. La
  vérification est refaite à **chaque démarrage** tant qu'il n'a pas de propriétaire, donc la variable peut
  être ajoutée plus tard. Si ce `sub` a déjà un espace, rien n'est écrasé (un message le signale).
* `make dump` / `scripts/dump.sh` ne concerne que l'espace de l'utilisateur connecté :
  `SS_SESSION=<valeur du cookie ss_session> ./scripts/dump.sh` (ou `DEV_SUB=1` en développement).

## 5. Variables

| Variable | Rôle | Défaut |
|---|---|---|
| `SPORTSPLITTER_SSO_SECRET` | secret partagé avec Orqea (≥ 32 car.) | absent ⇒ tout refusé (`SSO_DISABLED`) |
| `SPORTSPLITTER_SESSION_SECRET` | signe les sessions | absent en prod ⇒ le démarrage échoue ; en dev, valeur aléatoire par processus |
| `SPORTSPLITTER_PUBLIC_URL` | origine publique (contrôle `Origin`) | `http://localhost:8090` |
| `SPORTSPLITTER_ORQEA_URL` | liens « Accès via Orqea », « Retour sur Orqea » et crédit « Propulsé par Orqea » ; exposé par `GET /api/health` (`orqeaUrl`) pour que le frontend vise l'Orqea de l'environnement (localhost en dev) | `https://orqea.dev` |
| `SPORTSPLITTER_ENV` | `development` / `production` | `development` |
| `SPORTSPLITTER_DEV_LOGIN` | active le login de dev | absent |
| `SPORTSPLITTER_LEGACY_OWNER_SUB` | propriétaire de l'ancien espace unique | absent |

Modèle : `.env.example` (à copier en `.env`, jamais commité). En production :
`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` (les secrets et l'URL publique y
sont obligatoires). Les ports du compose sont publiés sur `127.0.0.1` uniquement.

## 6. Mode développement

* `make dev-backend` démarre l'API avec `SPORTSPLITTER_DEV_LOGIN=1` et un secret SSO de développement.
* `POST /api/auth/dev-login {"sub": "1", "role": "admin"}` (avec `X-Requested-With: sportsplitter`) ouvre
  une session sans Orqea. Cette route **n'existe pas** (404) sans la variable, et le démarrage **échoue** si
  la variable est posée avec `SPORTSPLITTER_ENV=production`.

### Tester le vrai parcours `/sso#sso=…` en local

```bash
make dev-backend            # terminal 1
make dev-frontend           # terminal 2
make sso-url SUB=1 ROLE=admin
# ou : SPORTSPLITTER_SSO_SECRET=... python scripts/mint_sso_token.py --sub 1 --role admin --decode
```

Le script affiche le jeton puis l'URL `http://localhost:5173/sso#sso=<jeton>` à ouvrir dans les 60 secondes
(usage unique). Avec Docker, mettez le même `SPORTSPLITTER_SSO_SECRET` dans `.env` et utilisez
`SPORTSPLITTER_PUBLIC_URL=http://localhost:8090`.
