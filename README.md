# Savvy In Teal — E-Commerce Test Bed

Full-stack e-commerce project: AI-agent-ready backend (FastAPI) + storefront frontend (Next.js), open-source stack only. The storefront is **Savvy In Teal** — hair accessories & everyday jewellery — with design direction synthesized from three reference-site blueprints (Accessorize London, France Luxe, Zara; see `docs/research/`).

**The frontend is built to be edited by any LLM or by the owner in plain language.** All content lives in `frontend/content/` (brand/nav/homepage in `site.config.ts`, products in `catalog.ts`) and the palette in `app/globals.css` tokens; components read from config and contain no copy. See `docs/EDITING.md` for owner prompts and `.claude/skills/storefront-editing/` + `.claude/skills/karpathy/` for the agent rules. Cloning the store to another product genre = rewriting the two content files and swapping `frontend/public/brand/`. Product/editorial photography is Pexels (free license, no attribution required).

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
