# Copilot Instructions for EcoPlate

## Project Overview
- **EcoPlate** is a monorepo for a sustainability-focused food management platform.
- Major components:
  - `backend/` — Bun API server (TypeScript, Drizzle ORM, SQLite)
  - `frontend/` — React 18 + Vite + Capacitor (TypeScript, Tailwind CSS, shadcn/ui)
  - `recommendation-engine/` — Python Flask API for ML-powered recommendations

## Architecture & Data Flow
- **Frontend** communicates with the backend via REST API; uses Capacitor for mobile.
- **Backend** exposes REST endpoints, handles auth (JWT via `jose`), and business logic.
- **Database**: SQLite via Drizzle ORM; schema in `backend/src/db/`.
- **Recommendation Engine**: Flask service for price suggestions, notifications, and matching; called from backend.
- **OpenAI Vision**: Used for receipt scanning (see `/myfridge/receipt/scan`).

## Developer Workflows
- **Backend**: Use Bun (`bun run dev` for dev, `bun run start` for prod). No Express, no Node.js-only modules.
- **Frontend**: Use Bun (`bun run dev`, `bun run build`). Use Vite, React Router, Tailwind, shadcn/ui. Mobile: `npx cap sync` and open with Capacitor.
- **Recommendation Engine**: Python (`pip install -r requirements.txt`, `python app.py`).
- **Docker**: `docker-compose up -d` to run all services.
- **Pre-push**: Always type-check (`bunx tsc --noEmit` in backend, build frontend, check errors in IDE). Docker build will fail on TS errors.

## Project Conventions
- **TypeScript everywhere** (backend/frontend). Use async/await, try/catch, Zod for validation, `jose` for JWT.
- **No Express, no `dotenv`** (Bun loads `.env` automatically).
- **No new root `.md` files** except `README.md` and `claude.md`. All other docs go in `docs/` or `PRDs/`.
- **Component/Hook/Service structure**: Export from `index.ts` in their folders. Use functional React components and hooks.
- **Routes**: Add new backend routes in `backend/src/routes/`, register in `backend/src/index.ts`.
- **Frontend pages**: Add in `frontend/src/pages/`, register in router.
- **shadcn/ui**: Use `npx shadcn-ui@latest add <component>` for UI primitives.

## Integration Points
- **OpenAI API**: For receipt scanning (backend route `/myfridge/receipt/scan`).
- **Recommendation Engine**: Flask API, called from backend for price and matching.
- **JWT Auth**: Use `jose` (not `jsonwebtoken`).

## Key Files & Directories
- `backend/src/routes/` — API endpoints
- `backend/src/services/` — Business logic
- `backend/src/db/` — Database schema
- `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/hooks/` — UI and logic
- `recommendation-engine/app.py` — ML API
- `README.md`, `claude.md` — Project rules and architecture

## Example: Adding a Backend Route
1. Create file in `backend/src/routes/` (e.g., `users.ts`).
2. Export a register function (e.g., `registerUserRoutes`).
3. Import and call it in `backend/src/index.ts`.

## Example: Adding a Frontend Page
1. Create component in `frontend/src/pages/`.
2. Add route in `frontend/src/router/index.tsx`.

---
For more, see `README.md` and `claude.md`.
