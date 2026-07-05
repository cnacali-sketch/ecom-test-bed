# Savvyarchitect E-Commerce

Full-stack e-commerce project: AI-agent-ready backend (FastAPI) + storefront frontend (Next.js), open-source stack only. Frontend design is synthesized from three scraped reference sites (Accessorize London, France Luxe, Zara) — see `graphify-out/` in the scrape scratchpad for the cross-site design graph this was derived from.

## Structure

```
savvyarchitect-ecommerce/
  frontend/          Next.js storefront (App Router, TypeScript, Tailwind)
  backend/           FastAPI backend — Phase 1: pricing calculators, inventory generators, recommendation-quality checkers
  docker-compose.yml Postgres + Redis + RabbitMQ + backend container
```

## Running it

### Infra (Postgres/Redis/RabbitMQ)

Requires a Linux-container runtime on Windows — **Podman Desktop** (open source, Apache 2.0, no paid tier) via WSL2. Docker Desktop is intentionally not used here (its license isn't OSI open-source).

```bash
podman compose up -d
```

(Podman's CLI is docker-compose-file-compatible; `docker compose` works identically if you have a compatible engine.)

### Backend (local dev, without full infra)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Runs on http://localhost:8000. Unit tests for the Phase 1 calculators don't need Postgres/Redis/RabbitMQ running:

```bash
pytest -v
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:3000, renders with mock data if the backend isn't running.

## Roadmap

Following `savvyarchitect.md` (project root notes):
- **Phase 1 (this scaffold)**: Pricing/Inventory/Recommendation calculators
- **Phase 2**: Eval dashboard (CAC, LTV, conversion, ROAS)
- **Phase 3**: Operations & growth tooling (size charts, import duty, UTM builder)
- **Later**: LLM-backed agents (Ollama/Mistral) for actual recommendation/inventory/pricing reasoning, Celery async execution at scale
