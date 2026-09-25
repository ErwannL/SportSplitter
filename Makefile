.PHONY: dump sso-url up down logs dev-backend dev-frontend install test test-backend test-frontend lint

up:            ## Lance toute l'application (http://localhost:8090)
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

install:
	pip install -r backend/requirements-dev.txt
	cd frontend && npm install

# secret de développement : n'est jamais utilisé hors de votre machine
DEV_SSO_SECRET ?= dev-only-sso-secret-change-me-0123456789

dev-backend:   ## API sur :8000 (SQLite local), login de dev + secret SSO de dev
	cd backend && SPORTSPLITTER_DEV_LOGIN=1 SPORTSPLITTER_SSO_SECRET=$(DEV_SSO_SECRET) \
		SPORTSPLITTER_PUBLIC_URL=http://localhost:5173 uvicorn app.main:app --reload

SUB ?= 1
ROLE ?= admin
sso-url:       ## URL de connexion locale : make sso-url SUB=1 ROLE=admin (secret de dev ou SPORTSPLITTER_SSO_SECRET)
	SPORTSPLITTER_SSO_SECRET=$${SPORTSPLITTER_SSO_SECRET:-$(DEV_SSO_SECRET)} \
		SPORTSPLITTER_PUBLIC_URL=$${SPORTSPLITTER_PUBLIC_URL:-http://localhost:5173} \
		python scripts/mint_sso_token.py --sub $(SUB) --role $(ROLE)

dev-frontend:  ## Interface sur :5173
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && python -m pytest -q

test-frontend:
	cd frontend && npm run test:coverage

lint:
	cd backend && ruff check app tests
	cd frontend && npm run typecheck

dump:          ## Dump de diagnostic (données + erreurs) dans test/dumps, commité et poussé
	./scripts/dump.sh
