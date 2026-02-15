FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1

COPY pyproject.toml uv.lock README.md ./

RUN uv sync --frozen --no-install-project --no-dev

COPY app ./app

RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

CMD ["uvicorn", "app.faiss_server:app", "--host", "0.0.0.0", "--port", "8010"]
