# ChunkCanvas

ChunkCanvas is a document processing GUI and pipeline builder that transforms raw files (PDF, Images, Audio, Video, Excel, CSV) into structured, chunked data for vector databases. It supports local AI models (Ollama, vLLM, Docling) and cloud providers (OpenRouter).

## Quick Start (Docker)

The easiest way to run the full stack (Frontend + FAISS Backend + Docling Backend) is with Docker.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Rayen023/chunkcanvas.git
    cd chunkcanvas/frontend
    ```

2.  **Configure Environment Variables:**
    Create a `.env.local` file in the `frontend` directory. You can copy the example below:

    ```bash
    # .env.local

    # Public API URL (Required for browser access)
    NEXT_PUBLIC_API_URL=http://localhost:3000

    # Backend URLs (Internal Docker communication)
    BACKEND_FAISS_URL=http://faiss:8010
    BACKEND_DOCLING_URL=http://docling:8020

    # NEXT_PUBLIC_OPENROUTER_API_KEY=sk-or-...
    # NEXT_PUBLIC_VOYAGEAI_API_KEY=pa-...
    # NEXT_PUBLIC_COHERE_API_KEY=...
    # NEXT_PUBLIC_PINECONE_API_KEY=pc-...
    ```

3.  **Run with Docker Compose:**
    ```bash
    docker compose up -d
    ```
    - **Frontend:** [http://localhost:3000](http://localhost:3000)
    - **FAISS Backend:** [http://localhost:8010/docs](http://localhost:8010/docs)
    - **Docling Backend:** [http://localhost:8020/docs](http://localhost:8020/docs)

4.  **Stop:**
    ```bash
    docker compose down
    ```

## Manual Setup (Development)

If you prefer to run services individually without Docker:

### 1. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 2. Backend (FastAPI)

The backend manages local FAISS indexes and Docling parsing.

**Prerequisites:** Python 3.11+, `uv` (recommended) or `pip`.

```bash
cd frontend/backend

# Using uv (Recommended)
uv sync
uv run uvicorn app.faiss_server:app --reload --port 8010
# In a separate terminal for Docling:
uv run uvicorn app.docling_server:app --reload --port 8020
```

## Local AI Setup

To use local AI features, you need running instances of Ollama or vLLM.

### Ollama
1.  Install [Ollama](https://ollama.com/).
2.  Pull models: `ollama pull ministral-3:latest`, `ollama pull qwen3-embedding:0.6b`.

### vLLM
1.  Install `vllm`.
2.  Run an OpenAI-compatible server:
    ```bash
    vllm serve wen/Qwen3-VL-8B-Instruct-FP8 --port 8000
    ```

## Features

- **Multi-modal parsing:** Text, Vision, Audio, Video via local (Ollama/vLLM/Docling) or cloud (OpenRouter) models.
- **Intelligent Chunking:** Customizable text/table chunking.
- **Embedding Generation:** Voyage, OpenRouter, Ollama, vLLM, Cohere.
- **Vector DB Integration:** Pinecone, ChromaDB (Local/Cloud), MongoDB and local FAISS.
- **Export:** JSON chunks and auto-generated Python pipeline scripts.
