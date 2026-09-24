# SportSplitter by Orqea

> Propulsé par [Orqea](https://orqea.dev) · Développé par [Erwann Laplante](https://github.com/ErwannL/ErwannL)

Génère automatiquement la répartition des sports d'EPS : quelle classe fait quel sport, à quelle période et dans quel lieu, à partir de l'emploi du temps de l'établissement.

## Démarrage rapide

```bash
cp .env.example .env   # puis remplissez les secrets (voir Docs/ORQEA_SSO.md)
make up                # docker compose : http://localhost:8090 (ports publiés sur 127.0.0.1)
```

Services : `frontend` (React, servi par nginx), `backend` (FastAPI + OR-Tools), `db` (PostgreSQL).

### Développement sans Docker

```bash
make install
make dev-backend   # http://localhost:8000 (SQLite local)
make dev-frontend  # http://localhost:5173
make test          # pytest + vitest
```

## Parcours

Les professeurs d'EPS indiquent quand l'EPS est possible ; SportSplitter construit l'emploi du temps des classes.

1. **Planning** : import de la grille vide des créneaux (Excel). Cliquez sur une case pour l'ouvrir ou la fermer.
2. **Classes** : niveaux libres (6e, Terminale, L1… ou n'importe quel nom), avec :
   * un **rythme** sur 1 à 4 semaines, par exemple 1h par semaine, 2×2h30, 2h puis 4h en alternance, ou 4×1h / 2×1h30 / rien ;
   * le nombre de **classes en même temps** ;
   * le fonctionnement par trimestre ou semestre, et les sports.
3. **Sports** : *prioritaire* (toujours placé), *barrette* (les classes simultanées du niveau ensemble dans un lieu) et lieux possibles.
4. **Lieux** : couleur, extérieur ou non, capacité (nombre de classes en même temps), disponibilités peintes sur la grille par période.
5. Le bouton **Générer** se débloque quand tout est configuré.
6. L'algorithme **place les séances** dans la grille (même créneau toute l'année), choisit le sport de chaque période et le lieu de chaque séance. Il énumère les solutions (200 au maximum par défaut). Si aucune n'existe, il propose les meilleurs compromis et indique la règle non respectée. Vous pouvez parcourir les solutions, semaine par semaine du cycle, puis télécharger la meilleure, celle affichée ou toutes (Excel).

## Interface

* Thème clair / sombre, interface en français ou en anglais, menu latéral repliable.
* Un guide s'ouvre à la première visite (réouvrable via « Guide de démarrage ») et un bandeau en haut de chaque page indique la prochaine étape.
* Quand aucun planning n'est possible, chaque problème est un lien vers l'élément à corriger.
* Chaque lieu reçoit une couleur automatique, stable, vive et distincte des autres lieux.
* Sauvegarde automatique : chaque modification est enregistrée ; hors ligne, elle est gardée dans le navigateur.

## Administration

La page **Administration** permet de modifier les règles métier de l'algorithme (hiver souple, strict ou ignoré, nombre d'écarts tolérés, sports prioritaires obligatoires, répétition des sports, taille minimale d'une barrette, nombre de solutions et temps de calcul).
Ces règles sont **globales** ; seul un utilisateur de rôle `admin` (rôle transmis par Orqea) peut les modifier.

## Connexion via Orqea

SportSplitter n'a ni inscription ni mot de passe : on y entre uniquement depuis [Orqea](https://orqea.dev), qui accorde l'accès personne par personne. Orqea redirige vers `/sso#sso=<jeton>` ; SportSplitter vérifie ce jeton (60 s, usage unique) et ouvre une session de 8 h. Sans session, l'application n'affiche que « Accès via Orqea ». Chaque utilisateur a son propre espace de travail.

Tout est décrit dans [`Docs/ORQEA_SSO.md`](Docs/ORQEA_SSO.md) : contrat du jeton, variables (`.env.example`), révocation (≤ 8 h), reprise de l'ancien espace (`SPORTSPLITTER_LEGACY_OWNER_SUB`), mode développement (`make dev-backend`, `make sso-url SUB=1 ROLE=admin`).

## Dump de diagnostic

Quand un planning ne sort pas comme prévu, avec l'application lancée :

```bash
SS_SESSION=<valeur du cookie ss_session> ./scripts/dump.sh   # cookie visible dans les outils du navigateur
DEV_SUB=1 ./scripts/dump.sh                                  # en développement (SPORTSPLITTER_DEV_LOGIN=1)
```

Le dump ne concerne que l'espace de l'utilisateur connecté. Le script télécharge `test/dumps/dump_AAAA-MM-JJ_HH-MM-SS.zip`, le commite et le pousse sur la branche courante. Le zip contient :

* `LISEZMOI.txt` : résumé lisible de la grille (cases ouvertes et fermées), des niveaux, des sports, des lieux et des réglages ;
* `erreurs.txt` et `avertissements.txt` : le résultat du calcul ;
* `donnees.json` et `resultat.json` : les données complètes et le résultat brut.

## Tests

`make test` lance pytest et vitest avec une couverture exigée de 100 %.

## Format Excel attendu

| Heures   | Lundi | Mardi | Mercredi | … |
|----------|-------|-------|----------|---|
| 8h - 9h  |       |       |          |   |
| 9h - 10h |       | X     |          |   |

* Première ligne : jours. Première colonne : créneaux avec heure de début et de fin (`8h - 9h`, `8h30 - 10h`, `08:00-09:00`), qui donnent la durée de chaque créneau.
* Une séance occupe des créneaux contigus d'un même jour dont la durée totale vaut la durée de la séance. Pour des séances de 1h30, utilisez des créneaux de 30 min ou de 1h30.
* Une case vide est ouverte. Une case marquée `X` ou `fermé`, ou une cellule fusionnée vide, est fermée. Dans l'appli, un clic ouvre ou ferme une case (un bloc fusionné rouvert est redécoupé en créneaux).
* Le modèle téléchargeable va de 8h à 18h au pas de 30 min, midi fermé ; la colonne Samedi est ajoutée si « Cours le samedi » est activé dans Configuration.

## Modèle de l'année

L'année est découpée en 4 segments : Sept–Nov (T1), Déc–Janv (T2/S1), Févr–Mars (T2/S2), Avr–Juin (T3). Un lieu peut donc être partagé entre une classe au trimestre et une classe au semestre sans conflit. Par défaut, les segments d'hiver sont Déc–Janv et Févr–Mars : un lieu extérieur y est évité autant que possible.

## Règles du solveur

| Règle | Type |
|---|---|
| Séances placées sur des créneaux ouverts contigus de la bonne durée, même créneau toute l'année | stricte |
| Séances d'un niveau dans une même semaine : sans chevauchement, sur des jours différents | réglable |
| Classes simultanées d'un niveau hors barrette dans des lieux différents | réglable : obligatoire, souhaité (écarts limités) ou libre |
| Un sport par période et par niveau ; chaque sport au plus une fois (au moins une fois s'il y a moins de sports que de périodes) | stricte |
| Sport prioritaire toujours placé | stricte |
| Lieu compatible avec le sport, disponible sur toute la période | stricte |
| Capacité du lieu sur chaque créneau, chaque segment et chaque semaine réelle du cycle commun | stricte |
| Barrette : au moins 2 classes simultanées, toutes dans le même lieu | stricte |
| Pas de lieu extérieur en hiver | réglable : souple (écarts limités, 1 par défaut), stricte ou ignorée |

## Structure

```
backend/   FastAPI, solveur CP-SAT (app/solver.py), import/export Excel, tests pytest
frontend/  React + TypeScript + Tailwind + Zustand, tests vitest
```
