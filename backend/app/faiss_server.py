from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Literal

import faiss
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

MetricName = Literal["cosine", "l2", "ip"]


class CreateIndexRequest(BaseModel):
    db_path: str | None = None
    base_dir: str | None = None
    db_name: str | None = None
    dimension: int = Field(..., gt=0)
    metric: MetricName = "cosine"
    overwrite: bool = False

    @model_validator(mode="after")
    def validate_location(self) -> "CreateIndexRequest":
        if self.db_path and self.db_path.strip():
            return self
        if (
            self.base_dir
            and self.base_dir.strip()
            and self.db_name
            and self.db_name.strip()
        ):
            return self
        raise ValueError("Provide either db_path or both base_dir and db_name")


class UpsertItem(BaseModel):
    id: int
    text: str
    vector: list[float]
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpsertRequest(BaseModel):
    db_path: str = Field(..., min_length=1)
    items: list[UpsertItem] = Field(..., min_length=1)

    @field_validator("items")
    @classmethod
    def validate_items(cls, items: list[UpsertItem]) -> list[UpsertItem]:
        ids = [item.id for item in items]
        if len(set(ids)) != len(ids):
            raise ValueError("Duplicate ids in request")
        return items


class RecordView(BaseModel):
    id: int
    text: str
    metadata: dict[str, Any]
    embedding_preview: list[float] = Field(default_factory=list)


class ContentResponse(BaseModel):
    db_path: str
    total: int
    metric: MetricName
    dimension: int
    items: list[RecordView]


class InfoResponse(BaseModel):
    db_path: str
    total: int
    metric: MetricName
    dimension: int


class IndexEntry(BaseModel):
    name: str
    db_path: str


class ListIndexesResponse(BaseModel):
    base_dir: str
    indexes: list[IndexEntry]


app = FastAPI(title="ChunkCanvas FAISS API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _normalize_db_path(db_path: str) -> Path:
    path = Path(db_path).expanduser().resolve()
    if path.suffix != ".faiss":
        path = path.with_suffix(".faiss")
    return path


def _safe_db_name(name: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9._-]+", "-", name.strip())
    normalized = normalized.strip(".-_")
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid db_name")
    return normalized


def _resolve_create_db_path(payload: CreateIndexRequest) -> Path:
    if payload.db_path and payload.db_path.strip():
        return _normalize_db_path(payload.db_path)

    if not payload.base_dir or not payload.db_name:
        raise HTTPException(status_code=400, detail="Missing base_dir/db_name")

    safe_name = _safe_db_name(payload.db_name)
    base_dir = Path(payload.base_dir).expanduser().resolve()
    return _normalize_db_path(str(base_dir / safe_name))


def _meta_path(db_file: Path) -> Path:
    return db_file.with_suffix(".meta.json")


def _metric_type(metric: MetricName) -> int:
    if metric == "l2":
        return faiss.METRIC_L2
    return faiss.METRIC_INNER_PRODUCT


def _new_index(dimension: int, metric: MetricName) -> faiss.IndexIDMap2:
    metric_type = _metric_type(metric)
    base = faiss.IndexFlat(dimension, metric_type)
    return faiss.IndexIDMap2(base)


def _load_meta(db_file: Path) -> dict[str, Any]:
    path = _meta_path(db_file)
    if not path.exists():
        return {"records": {}, "dimension": None, "metric": "cosine"}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("invalid meta format")
        if "records" not in data or not isinstance(data["records"], dict):
            data["records"] = {}
        return data
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to read metadata: {exc}"
        ) from exc


def _save_meta(db_file: Path, payload: dict[str, Any]) -> None:
    meta_file = _meta_path(db_file)
    meta_file.parent.mkdir(parents=True, exist_ok=True)
    meta_file.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _read_index(db_file: Path) -> faiss.IndexIDMap2:
    try:
        loaded = faiss.read_index(str(db_file))
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to load FAISS index: {exc}"
        ) from exc

    if isinstance(loaded, faiss.IndexIDMap2):
        return loaded

    wrapped = faiss.IndexIDMap2(loaded)
    return wrapped


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/faiss/indexes/list")
def list_indexes(
    base_dir: str = Query(..., min_length=1),
    recursive: bool = Query(True),
) -> ListIndexesResponse:
    root = Path(base_dir).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=404, detail="base_dir not found")

    pattern = "**/*.faiss" if recursive else "*.faiss"
    files = sorted(root.glob(pattern), key=lambda p: str(p))
    indexes = [
        IndexEntry(
            name=path.stem,
            db_path=str(path.resolve()),
        )
        for path in files
        if path.is_file()
    ]
    return ListIndexesResponse(base_dir=str(root), indexes=indexes)


@app.post("/faiss/indexes/create")
def create_index(payload: CreateIndexRequest) -> InfoResponse:
    db_file = _resolve_create_db_path(payload)

    if db_file.exists() and not payload.overwrite:
        raise HTTPException(status_code=400, detail="Index already exists.")

    db_file.parent.mkdir(parents=True, exist_ok=True)
    index = _new_index(payload.dimension, payload.metric)

    try:
        faiss.write_index(index, str(db_file))
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to write index: {exc}"
        ) from exc

    meta = {
        "dimension": payload.dimension,
        "metric": payload.metric,
        "records": {},
    }
    _save_meta(db_file, meta)

    return InfoResponse(
        db_path=str(db_file),
        total=0,
        dimension=payload.dimension,
        metric=payload.metric,
    )


@app.post("/faiss/indexes/upsert")
def upsert_items(payload: UpsertRequest) -> dict[str, Any]:
    db_file = _normalize_db_path(payload.db_path)

    if not db_file.exists():
        raise HTTPException(
            status_code=404, detail="Index file not found. Create the index first."
        )

    index = _read_index(db_file)
    meta = _load_meta(db_file)

    dimension = index.d
    metric = meta.get("metric", "cosine")
    if metric not in {"cosine", "l2", "ip"}:
        metric = "cosine"

    vectors = np.array([item.vector for item in payload.items], dtype=np.float32)
    if vectors.ndim != 2 or vectors.shape[1] != dimension:
        raise HTTPException(
            status_code=400,
            detail=f"Vector dimension mismatch. Expected {dimension}, got {vectors.shape[1] if vectors.ndim == 2 else 'invalid'}.",
        )

    ids = np.array([item.id for item in payload.items], dtype=np.int64)

    if metric == "cosine":
        faiss.normalize_L2(vectors)

    selector = faiss.IDSelectorArray(ids.size, faiss.swig_ptr(ids))
    index.remove_ids(selector)
    index.add_with_ids(vectors, ids)

    records: dict[str, Any] = meta.get("records", {})
    for item in payload.items:
        records[str(item.id)] = {
            "text": item.text,
            "metadata": item.metadata,
        }

    meta["records"] = records
    meta["dimension"] = dimension
    meta["metric"] = metric

    try:
        faiss.write_index(index, str(db_file))
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to save index: {exc}"
        ) from exc

    _save_meta(db_file, meta)

    return {
        "db_path": str(db_file),
        "upserted": len(payload.items),
        "total": index.ntotal,
        "dimension": dimension,
        "metric": metric,
    }


@app.get("/faiss/indexes/info")
def get_info(db_path: str = Query(..., min_length=1)) -> InfoResponse:
    db_file = _normalize_db_path(db_path)
    if not db_file.exists():
        raise HTTPException(status_code=404, detail="Index not found")

    index = _read_index(db_file)
    meta = _load_meta(db_file)

    metric = meta.get("metric", "cosine")
    if metric not in {"cosine", "l2", "ip"}:
        metric = "cosine"

    return InfoResponse(
        db_path=str(db_file),
        total=index.ntotal,
        dimension=index.d,
        metric=metric,
    )


@app.get("/faiss/indexes/content")
def get_content(
    db_path: str = Query(..., min_length=1),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    preview_dim: int = Query(8, ge=1, le=64),
) -> ContentResponse:
    db_file = _normalize_db_path(db_path)
    if not db_file.exists():
        raise HTTPException(status_code=404, detail="Index not found")

    index = _read_index(db_file)
    meta = _load_meta(db_file)
    records = meta.get("records", {})

    metric = meta.get("metric", "cosine")
    if metric not in {"cosine", "l2", "ip"}:
        metric = "cosine"

    all_items = []
    for key, value in records.items():
        try:
            item_id = int(key)
        except Exception:
            continue
        text = value.get("text", "") if isinstance(value, dict) else ""
        metadata = value.get("metadata", {}) if isinstance(value, dict) else {}
        embedding_preview: list[float] = []
        try:
            vector = index.reconstruct(item_id)
            embedding_preview = [float(v) for v in vector[:preview_dim]]
        except Exception:
            embedding_preview = []
        all_items.append(
            {
                "id": item_id,
                "text": text,
                "metadata": metadata,
                "embedding_preview": embedding_preview,
            }
        )

    all_items.sort(key=lambda item: item["id"])
    page = all_items[offset : offset + limit]

    return ContentResponse(
        db_path=str(db_file),
        total=index.ntotal,
        dimension=index.d,
        metric=metric,
        items=[RecordView(**item) for item in page],
    )
