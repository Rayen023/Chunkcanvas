from __future__ import annotations

import json
import logging
import tempfile
import traceback
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from docling.datamodel.base_models import ConversionStatus, InputFormat
from docling.datamodel.pipeline_options import VlmConvertOptions, VlmPipelineOptions
from docling.datamodel.vlm_engine_options import ApiVlmEngineOptions, VlmEngineType
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.pipeline.vlm_pipeline import VlmPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("docling-server")

GRANITE_MODEL = "ibm-granite/granite-docling-258M"
DEFAULT_VLLM_URL = "http://localhost:8000/v1/chat/completions"

app = FastAPI(title="ChunkCanvas Docling Server", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _build_converter(vllm_url: str, timeout: int) -> DocumentConverter:
    vlm_options = VlmConvertOptions.from_preset(
        "granite_docling",
        engine_options=ApiVlmEngineOptions(
            runtime_type=VlmEngineType.API,
            url=vllm_url,
            params={"skip_special_tokens": False},
            timeout=timeout,
            concurrency=1,
        ),
    )

    pipeline_options = VlmPipelineOptions(
        vlm_options=vlm_options,
        enable_remote_services=True,
    )

    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_cls=VlmPipeline,
                pipeline_options=pipeline_options,
            )
        }
    )


@app.get("/health")
def health() -> dict[str, str]:

    return {"status": "ok"}


class ParseResponse(BaseModel):

    filename: str

    markdown: str

    num_pages: int | None = None


@app.post("/docling/parse", response_model=ParseResponse)
async def parse_document(
    file: UploadFile = File(...),
    vllm_url: str = Form(DEFAULT_VLLM_URL),
    timeout: int = Form(120),
) -> ParseResponse:

    ext = (file.filename or "document.pdf").rsplit(".", 1)[-1].lower()

    if ext != "pdf":

        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:

        content = await file.read()

        tmp.write(content)

        tmp_path = Path(tmp.name)

    try:

        converter = _build_converter(vllm_url=vllm_url, timeout=timeout)

        result = converter.convert(tmp_path)

        if result.status != ConversionStatus.SUCCESS:

            raise HTTPException(
                status_code=500,
                detail=f"Conversion failed with status: {result.status}",
            )

        markdown = result.document.export_to_markdown()

        num_pages = len(result.pages)

        return ParseResponse(
            filename=file.filename or "document",
            markdown=markdown,
            num_pages=num_pages,
        )

    except HTTPException:

        raise

    except Exception as e:

        logger.error("Docling parse error: %s", traceback.format_exc())

        raise HTTPException(status_code=500, detail=str(e)) from e

    finally:

        tmp_path.unlink(missing_ok=True)


@app.post("/docling/parse/stream")
async def parse_document_stream(
    file: UploadFile = File(...),
    vllm_url: str = Form(DEFAULT_VLLM_URL),
    timeout: int = Form(120),
) -> StreamingResponse:

    ext = (file.filename or "document.pdf").rsplit(".", 1)[-1].lower()

    if ext != "pdf":

        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_content = await file.read()

    def _sse_event(event: str, data: dict) -> str:

        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    async def event_generator():

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:

            tmp.write(file_content)

            tmp_path = Path(tmp.name)

        try:

            converter = _build_converter(vllm_url=vllm_url, timeout=timeout)

            yield _sse_event(
                "progress", {"status": "converting", "page": 0, "total_pages": 0}
            )

            result = converter.convert(tmp_path)

            if result.status != ConversionStatus.SUCCESS:

                yield _sse_event(
                    "error", {"message": f"Conversion failed: {result.status}"}
                )

                return

            doc = result.document

            num_pages = len(result.pages)

            if hasattr(doc, "pages") and doc.pages:

                pages = list(doc.pages.values())

                for i in range(len(pages)):

                    page_no = i + 1

                    yield _sse_event(
                        "progress",
                        {
                            "status": "processing",
                            "page": page_no,
                            "total_pages": num_pages,
                        },
                    )

                    try:

                        page_md = doc.export_to_markdown(page_no=page_no)

                        yield _sse_event(
                            "page_result",
                            {
                                "page": page_no,
                                "markdown": page_md,
                            },
                        )

                    except Exception:

                        logger.debug("Could not export page %d individually", page_no)

            markdown = doc.export_to_markdown()

            yield _sse_event(
                "complete",
                {
                    "markdown": markdown,
                    "num_pages": num_pages,
                },
            )

        except Exception as e:

            logger.error("Docling stream parse error: %s", traceback.format_exc())

            yield _sse_event("error", {"message": str(e)})

        finally:

            tmp_path.unlink(missing_ok=True)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
