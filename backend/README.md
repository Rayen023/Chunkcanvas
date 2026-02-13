# ChunkCanvas FAISS Backend (FastAPI + uv)

Local service to create, update (upsert), and inspect FAISS indexes used by ChunkCanvas.

## 1) Create environment with `uv`

```bash
cd backend
uv venv
source .venv/bin/activate
uv sync
```

If you prefer explicit add commands:

```bash
uv add fastapi "uvicorn[standard]" faiss-cpu numpy pydantic
```

## 2) Run API

```bash
uv run uvicorn app.main:app --reload --port 8010
```

## 3) Health check

```bash
curl http://localhost:8010/health
```

## API Summary

- `POST /faiss/indexes/create` create a FAISS DB file at a user-provided path.
- `POST /faiss/indexes/upsert` add/update vectors by id.
- `GET /faiss/indexes/content` inspect stored records (with pagination).
- `GET /faiss/indexes/info` index details (dimension, metric, count).

Indexes are saved as `*.faiss` plus sidecar metadata `*.meta.json`.
