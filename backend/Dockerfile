# Use a Python image with uv pre-installed
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

# Set working directory
WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy dependency files first
COPY pyproject.toml uv.lock README.md ./

# Install dependencies using uv
# --frozen ensures we use the exact versions from uv.lock
# --no-install-project installs dependencies but not the project itself yet
RUN uv sync --frozen --no-install-project --no-dev

# Copy the application code
COPY app ./app

# Install the project itself
RUN uv sync --frozen --no-dev

# Place the virtual environment in the PATH
ENV PATH="/app/.venv/bin:$PATH"

# Default command (can be overridden in docker-compose)
CMD ["uvicorn", "app.faiss_server:app", "--host", "0.0.0.0", "--port", "8010"]
