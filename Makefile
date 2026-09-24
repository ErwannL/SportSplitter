.PHONY: up down logs dev-backend dev-frontend install test test-backend test-frontend lint

up:            ## Lance toute l'application (http://localhost:8080)
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

install:
	pip install -r backend/requirements-dev.txt
	cd frontend && npm install

dev-backend:   ## API sur :8000 (SQLite local)
	cd backend && uvicorn app.main:app --reload

dev-frontend:  ## Interface sur :5173
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && python -m pytest -q

test-frontend:
	cd frontend && npm test

lint:
	cd backend && ruff check app tests
	cd frontend && npm run typecheck
