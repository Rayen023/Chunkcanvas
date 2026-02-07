/**
 * Script generator — produces pipeline.py + pyproject.toml + .env.example
 * as text strings that can be zipped client-side.
 *
 * Three stages: "chunks" | "embeddings" | "pinecone"
 */

import { PIPELINE } from "./constants";
import type { ChunkingParams, PdfEngine } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────

export type ScriptStage = "chunks" | "embeddings" | "pinecone";

export interface ScriptConfig {
  pipeline: string;
  chunkingParams: ChunkingParams;
  // OpenRouter extras
  openrouterModel?: string;
  openrouterPrompt?: string;
  pdfEngine?: PdfEngine;
  // Excel extras
  excelColumn?: string;
  // Voyage model (for embeddings/pinecone)
  voyageModel?: string;
  // Pinecone (for pinecone stage)
  pineconeIndexName?: string;
  pineconeCloud?: string;
  pineconeRegion?: string;
}

// ─── Dependency Sets ──────────────────────────────────────────────────────

function getDeps(pipeline: string, stage: ScriptStage): string[] {
  const base = [
    '"langchain-text-splitters>=0.2"',
    '"python-dotenv>=1.0"',
  ];

  switch (pipeline) {
    case PIPELINE.SIMPLE_TEXT:
      base.push('"PyPDF2>=3.0"', '"docx2txt>=0.8"');
      break;
    case PIPELINE.EXCEL_SPREADSHEET:
      base.push('"openpyxl>=3.1"', '"pandas>=2.0"');
      break;
    case PIPELINE.OPENROUTER_PDF:
      base.push('"httpx>=0.27"', '"PyPDF2>=3.0"');
      break;
    case PIPELINE.OPENROUTER_IMAGE:
    case PIPELINE.OPENROUTER_AUDIO:
    case PIPELINE.OPENROUTER_VIDEO:
      base.push('"httpx>=0.27"');
      break;
  }

  if (stage === "embeddings" || stage === "pinecone") {
    base.push('"langchain-voyageai>=0.0.3"');
  }
  if (stage === "pinecone") {
    base.push('"langchain-pinecone>=0.1.4"', '"pinecone>=5.0"', '"langchain-core>=0.2"');
  }

  return base;
}

// ─── Read Function Generators ─────────────────────────────────────────────

function genReadSimpleText(): string {
  return `
import os
from PyPDF2 import PdfReader
import docx2txt

def read_document(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        reader = PdfReader(file_path)
        return "\\n\\n".join(page.extract_text() or "" for page in reader.pages)
    elif ext == ".docx":
        return docx2txt.process(file_path)
    else:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
`;
}

function genReadExcel(column: string): string {
  return `
import pandas as pd

def read_document(file_path: str) -> list[str]:
    df = pd.read_excel(file_path, engine="openpyxl")
    column = ${JSON.stringify(column)}
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found. Available: {list(df.columns)}")
    return [str(v) for v in df[column].dropna().tolist()]
`;
}

function genOpenRouterHelper(): string {
  return `
import httpx, base64, time, os

OPENROUTER_API_URL = "https://openrouter.ai/api/v1"
MAX_RETRIES = 3
RETRY_DELAY = 2

def _call_openrouter(api_key: str, model: str, messages: list, plugins: list | None = None) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/chunkcanvas",
        "X-Title": "ChunkCanvas",
    }
    body = {"model": model, "messages": messages}
    if plugins:
        body["plugins"] = plugins

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            with httpx.Client(timeout=120) as client:
                resp = client.post(f"{OPENROUTER_API_URL}/chat/completions", headers=headers, json=body)
                if resp.status_code == 429 or resp.status_code >= 500:
                    last_error = Exception(f"HTTP {resp.status_code}")
                    time.sleep(RETRY_DELAY * (2 ** attempt))
                    continue
                resp.raise_for_status()
                data = resp.json()
                if "error" in data:
                    raise Exception(f"API error: {data['error']}")
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            last_error = e
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (2 ** attempt))
    raise last_error or Exception("OpenRouter request failed")
`;
}

function genReadOpenRouterPdf(model: string, prompt: string, engine: PdfEngine): string {
  const pluginLine =
    engine !== "native"
      ? `    plugins = [{"id": "file-parser", "pdf": {"engine": ${JSON.stringify(engine)}}}]`
      : `    plugins = None`;

  return `${genOpenRouterHelper()}
from PyPDF2 import PdfReader, PdfWriter
from io import BytesIO

def read_document(file_path: str) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    model = ${JSON.stringify(model)}
    prompt = ${JSON.stringify(prompt)}
${pluginLine}

    reader = PdfReader(file_path)
    pages = []
    for i, page in enumerate(reader.pages):
        writer = PdfWriter()
        writer.add_page(page)
        buf = BytesIO()
        writer.write(buf)
        b64 = base64.b64encode(buf.getvalue()).decode()
        messages = [{"role": "user", "content": [
            {"type": "text", "text": f"[Page {i+1}/{len(reader.pages)}] {prompt}"},
            {"type": "file", "file": {"filename": f"page_{i+1}.pdf", "file_data": f"data:application/pdf;base64,{b64}"}}
        ]}]
        try:
            text = _call_openrouter(api_key, model, messages, plugins)
            pages.append(f"--- Page {i+1} ---\\n{text}")
        except Exception as e:
            pages.append(f"--- Page {i+1} ---\\n[ERROR] {e}")
        print(f"  Page {i+1}/{len(reader.pages)} done")
    return "\\n\\n".join(pages)
`;
}

function genReadOpenRouterImage(model: string, prompt: string): string {
  return `${genOpenRouterHelper()}

_IMAGE_MIME = {"png":"image/png","jpg":"image/jpeg","jpeg":"image/jpeg","webp":"image/webp","gif":"image/gif","bmp":"image/bmp","tiff":"image/tiff","tif":"image/tiff"}

def read_document(file_path: str) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    ext = os.path.splitext(file_path)[1].lower().lstrip(".")
    mime = _IMAGE_MIME.get(ext, "image/png")
    with open(file_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    messages = [{"role": "user", "content": [
        {"type": "text", "text": ${JSON.stringify(prompt)}},
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}
    ]}]
    return _call_openrouter(api_key, ${JSON.stringify(model)}, messages)
`;
}

function genReadOpenRouterAudio(model: string, prompt: string): string {
  return `${genOpenRouterHelper()}

def read_document(file_path: str) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    ext = os.path.splitext(file_path)[1].lower().lstrip(".")
    with open(file_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    messages = [{"role": "user", "content": [
        {"type": "text", "text": ${JSON.stringify(prompt)}},
        {"type": "input_audio", "input_audio": {"data": b64, "format": ext}}
    ]}]
    return _call_openrouter(api_key, ${JSON.stringify(model)}, messages)
`;
}

function genReadOpenRouterVideo(model: string, prompt: string): string {
  return `${genOpenRouterHelper()}

_VIDEO_MIME = {"mp4":"video/mp4","mpeg":"video/mpeg","mov":"video/mov","webm":"video/webm","mkv":"video/x-matroska","avi":"video/x-msvideo"}

def read_document(file_path: str) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    ext = os.path.splitext(file_path)[1].lower().lstrip(".")
    mime = _VIDEO_MIME.get(ext, "video/mp4")
    with open(file_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    messages = [{"role": "user", "content": [
        {"type": "text", "text": ${JSON.stringify(prompt)}},
        {"type": "video_url", "video_url": {"url": f"data:{mime};base64,{b64}"}}
    ]}]
    return _call_openrouter(api_key, ${JSON.stringify(model)}, messages)
`;
}

// ─── Chunking Code ────────────────────────────────────────────────────────

function genChunkFunction(params: ChunkingParams, isExcel: boolean): string {
  const seps = JSON.stringify(params.separators);
  if (isExcel) {
    return `
from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_rows(rows: list[str], filename: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=${params.chunkSize},
        chunk_overlap=${params.chunkOverlap},
        length_function=len,
        separators=${seps},
    )
    chunks = []
    for row in rows:
        docs = splitter.create_documents([str(row)], [{"filename": filename}])
        chunks.extend(d.page_content for d in docs)
    return chunks
`;
  }
  return `
from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_text(text: str, filename: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=${params.chunkSize},
        chunk_overlap=${params.chunkOverlap},
        length_function=len,
        separators=${seps},
    )
    docs = splitter.create_documents([text], [{"filename": filename}])
    return [d.page_content for d in docs]
`;
}

// ─── Main Function Generators ─────────────────────────────────────────────

function genMainChunks(isExcel: boolean): string {
  const chunkCall = isExcel
    ? `    rows = read_document(file_path)\n    chunks = chunk_rows(rows, filename)`
    : `    text = read_document(file_path)\n    chunks = chunk_text(text, filename)`;

  return `
import argparse, json, os

def main():
    parser = argparse.ArgumentParser(description="ChunkCanvas pipeline")
    parser.add_argument("file", help="Path to document")
    args = parser.parse_args()
    file_path = args.file
    filename = os.path.basename(file_path)

${chunkCall}

    output = {
        "metadata": {"source_file": filename, "num_chunks": len(chunks)},
        "chunks": [{"index": i, "text": t} for i, t in enumerate(chunks)],
    }
    out_path = os.path.splitext(filename)[0] + "_chunks.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(chunks)} chunks to {out_path}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
`;
}

function genMainEmbeddings(voyageModel: string, isExcel: boolean): string {
  const chunkCall = isExcel
    ? `    rows = read_document(file_path)\n    chunks = chunk_rows(rows, filename)`
    : `    text = read_document(file_path)\n    chunks = chunk_text(text, filename)`;

  return `
import argparse, json, os

def main():
    parser = argparse.ArgumentParser(description="ChunkCanvas pipeline with embeddings")
    parser.add_argument("file", help="Path to document")
    args = parser.parse_args()
    file_path = args.file
    filename = os.path.basename(file_path)

${chunkCall}

    from langchain_voyageai import VoyageAIEmbeddings
    embedder = VoyageAIEmbeddings(model=${JSON.stringify(voyageModel)})
    embeddings = embedder.embed_documents(chunks)

    output = {
        "metadata": {
            "source_file": filename,
            "embedding_model": ${JSON.stringify(voyageModel)},
            "num_chunks": len(chunks),
            "embedding_dimensions": len(embeddings[0]) if embeddings else 0,
        },
        "chunks": [{"index": i, "text": t, "embedding": e} for i, (t, e) in enumerate(zip(chunks, embeddings))],
    }
    out_path = os.path.splitext(filename)[0] + "_embeddings.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(chunks)} embeddings to {out_path}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
`;
}

function genMainPinecone(
  voyageModel: string,
  indexName: string,
  cloud: string,
  region: string,
  isExcel: boolean,
): string {
  const chunkCall = isExcel
    ? `    rows = read_document(file_path)\n    chunks = chunk_rows(rows, filename)`
    : `    text = read_document(file_path)\n    chunks = chunk_text(text, filename)`;

  return `
import argparse, os

def main():
    parser = argparse.ArgumentParser(description="ChunkCanvas pipeline → Pinecone")
    parser.add_argument("file", help="Path to document")
    args = parser.parse_args()
    file_path = args.file
    filename = os.path.basename(file_path)

${chunkCall}

    from langchain_voyageai import VoyageAIEmbeddings
    from langchain_core.documents import Document
    from langchain_pinecone import PineconeVectorStore
    from pinecone import Pinecone, ServerlessSpec

    embedder = VoyageAIEmbeddings(model=${JSON.stringify(voyageModel)})
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])

    index_name = ${JSON.stringify(indexName)}
    existing = [idx.name for idx in pc.list_indexes()]
    if index_name not in existing:
        pc.create_index(
            name=index_name, dimension=1024, metric="cosine",
            spec=ServerlessSpec(cloud=${JSON.stringify(cloud)}, region=${JSON.stringify(region)})
        )
        print(f"Created index: {index_name}")

    docs = [Document(page_content=t, metadata={"filename": filename}) for t in chunks]
    vectorstore = PineconeVectorStore.from_documents(docs, embedder, index_name=index_name)
    print(f"Uploaded {len(docs)} chunks to Pinecone index: {index_name}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
`;
}

// ─── pyproject.toml Generator ─────────────────────────────────────────────

function genPyproject(deps: string[], stage: string): string {
  return `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "chunkcanvas-pipeline-${stage}"
version = "0.1.0"
description = "Auto-generated ChunkCanvas ${stage} pipeline"
requires-python = ">=3.10"
dependencies = [
    ${deps.join(",\n    ")},
]

[project.scripts]
pipeline = "pipeline:main"
`;
}

// ─── .env.example Generator ───────────────────────────────────────────────

function genEnvExample(pipeline: string, stage: ScriptStage): string {
  const lines: string[] = [];
  if (pipeline.startsWith("OpenRouter")) {
    lines.push("OPENROUTER_API_KEY=");
  }
  if (stage === "embeddings" || stage === "pinecone") {
    lines.push("VOYAGEAI_API_KEY=");
  }
  if (stage === "pinecone") {
    lines.push("PINECONE_API_KEY=");
  }
  return lines.join("\n") + "\n";
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface GeneratedScript {
  "pipeline.py": string;
  "pyproject.toml": string;
  ".env.example": string;
}

export function generatePipelineScript(
  stage: ScriptStage,
  config: ScriptConfig,
): GeneratedScript {
  const { pipeline, chunkingParams } = config;
  const isExcel = pipeline === PIPELINE.EXCEL_SPREADSHEET;

  // Build read function
  let readFn: string;
  switch (pipeline) {
    case PIPELINE.SIMPLE_TEXT:
      readFn = genReadSimpleText();
      break;
    case PIPELINE.EXCEL_SPREADSHEET:
      readFn = genReadExcel(config.excelColumn ?? "");
      break;
    case PIPELINE.OPENROUTER_PDF:
      readFn = genReadOpenRouterPdf(
        config.openrouterModel ?? "",
        config.openrouterPrompt ?? "",
        config.pdfEngine ?? "native",
      );
      break;
    case PIPELINE.OPENROUTER_IMAGE:
      readFn = genReadOpenRouterImage(
        config.openrouterModel ?? "",
        config.openrouterPrompt ?? "",
      );
      break;
    case PIPELINE.OPENROUTER_AUDIO:
      readFn = genReadOpenRouterAudio(
        config.openrouterModel ?? "",
        config.openrouterPrompt ?? "",
      );
      break;
    case PIPELINE.OPENROUTER_VIDEO:
      readFn = genReadOpenRouterVideo(
        config.openrouterModel ?? "",
        config.openrouterPrompt ?? "",
      );
      break;
    default:
      readFn = genReadSimpleText();
  }

  // Build chunk function
  const chunkFn = genChunkFunction(chunkingParams, isExcel);

  // Build main
  let mainFn: string;
  switch (stage) {
    case "chunks":
      mainFn = genMainChunks(isExcel);
      break;
    case "embeddings":
      mainFn = genMainEmbeddings(config.voyageModel ?? "voyage-4", isExcel);
      break;
    case "pinecone":
      mainFn = genMainPinecone(
        config.voyageModel ?? "voyage-4",
        config.pineconeIndexName ?? "chunkcanvas",
        config.pineconeCloud ?? "aws",
        config.pineconeRegion ?? "us-east-1",
        isExcel,
      );
      break;
  }

  const pipelinePy = `#!/usr/bin/env python3
"""Auto-generated by ChunkCanvas — ${stage} pipeline"""
${readFn}
${chunkFn}
${mainFn}`;

  const deps = getDeps(pipeline, stage);
  const pyproject = genPyproject(deps, stage);
  const envExample = genEnvExample(pipeline, stage);

  return {
    "pipeline.py": pipelinePy,
    "pyproject.toml": pyproject,
    ".env.example": envExample,
  };
}
