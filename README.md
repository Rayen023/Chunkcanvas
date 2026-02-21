# ChunkCanvas

<p>
  <a href="https://chunkcanvas.cc"><strong>🌐 ChunkCanvas.cc</strong></a> is a document-processing GUI designed for RAG workflows. It allows you to parse PDFs, process images, transcribe audio/video, and extract data from Excel/CSV files using either local engines (Ollama, vLLM, Docling) or cloud providers (OpenRouter). From there, you can chunk content with configurable LangChain's RecursiveCharacterTextSplitter, edit parsed text and chunks directly in the UI, generate embeddings with your preferred provider, and ingest (text, embeddings and metadata) into the selected vector database of choice.
</p>

<p align="center">
  <video src="docs/demo.mp4" autoplay loop muted playsinline width="50%"></video>
</p>

## Document Support

<div align="center">

| Format         | Built-in | <img src="public/tech-icons/docling.svg" height="14"/> Docling | <img src="public/tech-icons/ollama.svg" height="14"/> Ollama | <img src="public/tech-icons/vllm-color.svg" height="14"/> vLLM | <img src="public/tech-icons/openrouter.svg" height="14"/> OpenRouter |
| -------------- | :------: | :------------------------------------------------------------: | :----------------------------------------------------------: | :------------------------------------------------------------: | :------------------------------------------------------------------: |
| PDF _(text)_   |    ✅    |                               ✅                               |                                                              |                                                                |                                                                      |
| PDF _(vision)_ |          |                               ✅                               |                              ✅                              |                               ✅                               |                                  ✅                                  |
| Images         |          |                                                                |                              ✅                              |                               ✅                               |                                  ✅                                  |
| Audio          |          |                                                                |                              ✅                              |                               ✅                               |                                  ✅                                  |
| Video          |          |                                                                |                              ✅                              |                               ✅                               |                                  ✅                                  |
| Excel / CSV    |    ✅    |                                                                |                                                              |                                                                |                                                                      |

</div>

## Embeddings & Vector Databases

<table align="center">
<tr>
<td valign="top" width="50%">

| Embeddings Provider                                                   |     |
| --------------------------------------------------------------------- | --- |
| <img src="public/tech-icons/voyage-color.svg" height="15"/> Voyage AI | ☁️  |
| <img src="public/tech-icons/cohere-color.svg" height="15"/> Cohere    | ☁️  |
| <img src="public/tech-icons/openrouter.svg" height="15"/> OpenRouter  | ☁️  |
| <img src="public/tech-icons/ollama.svg" height="15"/> Ollama          | 🖥️  |
| <img src="public/tech-icons/vllm-color.svg" height="15"/> vLLM        | 🖥️  |

</td>
<td valign="top" width="50%">

| Vector Database                                                                             |       |
| ------------------------------------------------------------------------------------------- | ----- |
| <img src="public/tech-icons/Pinecone-Icon--Streamline-Svg-Logos.svg" height="15"/> Pinecone | ☁️    |
| <img src="public/tech-icons/Chroma--Streamline-Svg-Logos.svg" height="15"/> ChromaDB        | ☁️ 🖥️ |
| <img src="public/tech-icons/MongoDB.svg" height="15"/> MongoDB Atlas                        | ☁️    |
| <img src="public/tech-icons/meta-color.svg" height="15"/> FAISS                             | 🖥️    |

</td>
</tr>
</table>

---

## Quick Start (Docker)

```bash
git clone https://github.com/Rayen023/chunkcanvas.git
cd chunkcanvas/

docker compose up -d
```

| Service         | URL                        |
| --------------- | -------------------------- |
| Frontend        | http://localhost:3000      |
| Docling Backend | http://localhost:8020/docs |
| FAISS Backend   | http://localhost:8010/docs |
| Chroma Database | http://localhost:8030      |

---

## Manual Setup

### Frontend

```bash
npm install
npm run dev
```

### Backend (FastAPI + `uv`)

```bash
cd backend
uv sync
uv run uvicorn app.faiss_server:app --reload --port 8010
# separate terminal for Docling:
uv run uvicorn app.docling_server:app --reload --port 8020
```

---

### Local models

**vLLM** — run an OpenAI-compatible server:

```bash
vllm serve Qwen/Qwen3-VL-8B-Instruct-FP8 --port 8000
```

**Ollama** — install from [ollama.com](https://ollama.com), browse available models, then start the server:

- [Vision models](https://ollama.com/search?c=vision)
- [Embedding models](https://ollama.com/search?c=embedding)

```bash
ollama pull <model-name>
```
