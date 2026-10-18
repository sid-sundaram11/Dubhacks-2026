"""FastAPI entry for SAM3 segmentation."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv(Path(__file__).resolve().parent / ".env")
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from segment import (
    Sam3Segmenter,
    SegmentError,
    create_segmenter_from_env,
    decode_subject_image,
)

segmenter: Sam3Segmenter | None = None
load_error: str | None = None


class SegmentRequest(BaseModel):
    mimeType: str
    data: str
    prompt: str | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global segmenter, load_error
    load_error = None
    if os.environ.get("SAM3_SKIP_LOAD") == "1":
        segmenter = None
        yield
        return
    segmenter = create_segmenter_from_env()
    try:
        segmenter.load()
    except Exception:
        load_error = "model_unavailable"
        segmenter = None
    yield


app = FastAPI(title="SAM3 Segmentation", lifespan=lifespan)


def _error_response(status: int, code: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code})


@app.get("/health")
def health() -> JSONResponse:
    if segmenter is not None and segmenter.loaded:
        return JSONResponse(status_code=200, content={"ok": True})
    return JSONResponse(
        status_code=503,
        content={"ok": False, "error": load_error or "model_unavailable"},
    )


@app.post("/segment")
async def segment(body: SegmentRequest) -> JSONResponse:
    if segmenter is None or not segmenter.loaded:
        return _error_response(503, "model_unavailable")

    try:
        image = decode_subject_image(body.mimeType, body.data)
    except SegmentError as exc:
        if exc.code == "payload_too_large":
            return _error_response(413, exc.code)
        return _error_response(400, exc.code)

    try:
        result = segmenter.segment(image, body.prompt)
    except SegmentError as exc:
        if exc.code == "no_subject":
            return _error_response(422, exc.code)
        if exc.code in ("model_unavailable", "out_of_memory"):
            return _error_response(503, exc.code)
        return _error_response(500, exc.code)

    return JSONResponse(
        status_code=200,
        content={
            "width": result.width,
            "height": result.height,
            "mask": result.mask_png_base64,
            "overlay": result.overlay_png_base64,
            "label": result.label,
            "confidence": result.confidence,
        },
    )


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8790"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    main()
