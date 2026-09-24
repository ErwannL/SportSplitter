# SportsSplitter

Génère automatiquement la répartition des sports d'EPS : quelle classe fait quel sport, à quelle période et dans quel lieu, à partir de l'emploi du temps de l'établissement.

## Démarrage rapide

```bash
make up          # docker compose : http://localhost:8080
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

1. **Planning** : import de l'emploi du temps Excel (un modèle est téléchargeable dans l'appli).
2. **Classes** : niveaux libres (6e, Terminale, L1… ou n'importe quel nom), en trimestre ou semestre, avec leurs sports.
3. **Sports** : *prioritaire* (toujours placé), *barrette* (2 classes du même niveau ensemble dans un lieu) et lieux possibles.
4. **Lieux** : couleur, extérieur ou non, capacité (nombre de classes en même temps), disponibilités peintes sur la grille par période.
5. Le bouton **Générer** se débloque quand tout est configuré.
6. Le solveur énumère les plannings valides (200 au maximum par défaut). Si aucun n'existe, il propose les meilleurs compromis et indique la règle non respectée. Vous pouvez parcourir les solutions puis télécharger la meilleure, celle affichée ou toutes (Excel).

## Format Excel attendu

| Heures    | Lundi | Mardi   | Mercredi | … |
|-----------|-------|---------|----------|---|
| 8h - 10h  | 6eme  | 4eme x2 |          |   |
| 10h - 12h |       | 5eme, 3eme |       |   |

* Première colonne : créneaux. Première ligne : jours.
* Dans une case : les niveaux qui ont EPS. `4eme x2` = deux classes de 4eme en même temps.
* Une cellule fusionnée vide, ou contenant `X` ou `fermé`, est un créneau fermé (par exemple le mercredi après-midi).

## Modèle de l'année

L'année est découpée en 4 segments : Sept–Nov (T1), Déc–Janv (T2/S1), Févr–Mars (T2/S2), Avr–Juin (T3). Un lieu peut donc être partagé entre une classe au trimestre et une classe au semestre sans conflit. Par défaut, les segments d'hiver sont Déc–Janv et Févr–Mars : un lieu extérieur y est évité autant que possible.

## Règles du solveur

| Règle | Type |
|---|---|
| Un sport par période et par niveau ; chaque sport au plus une fois (au moins une fois s'il y a moins de sports que de périodes) | stricte |
| Sport prioritaire toujours placé | stricte |
| Lieu compatible avec le sport, disponible sur toute la période | stricte |
| Capacité du lieu sur chaque créneau et chaque segment | stricte |
| Barrette : au moins 2 classes du niveau, toutes dans le même lieu | stricte |
| Pas de lieu extérieur en hiver | assouplissable (minimisée) |

## Structure

```
backend/   FastAPI, solveur CP-SAT (app/solver.py), import/export Excel, tests pytest
frontend/  React + TypeScript + Tailwind + Zustand, tests vitest
```
