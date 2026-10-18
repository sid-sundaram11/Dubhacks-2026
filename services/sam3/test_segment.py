"""HTTP and mask post-processing tests (no SAM3 weights required)."""

import base64
import io
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app as sam_app
from segment import (
    SegmentOutput,
    decode_subject_image,
    largest_connected_component,
    mask_to_png_base64,
    overlay_png_base64,
    pick_best_instance,
    resize_long_edge,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"


class FakeSegmenter:
    loaded = True

    def segment(self, image, prompt=None):
        w, h = image.size
        mask = np.zeros((h, w), dtype=np.uint8)
        mask[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4] = 1
        image_rgb = image.convert("RGB")
        return SegmentOutput(
            width=w,
            height=h,
            mask_png_base64=mask_to_png_base64(mask),
            overlay_png_base64=overlay_png_base64(image_rgb, mask),
            label=prompt or "object",
            confidence=0.91,
        )


@pytest.fixture
def client():
    with TestClient(sam_app.app) as c:
        sam_app.segmenter = FakeSegmenter()
        sam_app.load_error = None
        yield c
    sam_app.segmenter = None
    sam_app.load_error = None


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_health_unavailable():
    with TestClient(sam_app.app) as client:
        sam_app.segmenter = None
        sam_app.load_error = "model_unavailable"
        r = client.get("/health")
    assert r.status_code == 503
    assert r.json() == {"ok": False, "error": "model_unavailable"}


def test_segment_success(client):
    raw = (FIXTURES / "subject.png").read_bytes()
    body = {
        "mimeType": "image/png",
        "data": base64.b64encode(raw).decode("ascii"),
        "prompt": "circle",
    }
    r = client.post("/segment", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["width"] == 128
    assert data["height"] == 96
    assert data["label"] == "circle"
    assert data["confidence"] == 0.91
    overlay_bytes = base64.b64decode(data["overlay"])
    overlay_img = Image.open(io.BytesIO(overlay_bytes))
    assert overlay_img.mode == "RGB"
    assert overlay_img.size == (128, 96)
    mask_bytes = base64.b64decode(data["mask"])
    mask_img = Image.open(io.BytesIO(mask_bytes))
    assert mask_img.mode == "L"
    arr = np.array(mask_img)
    assert set(np.unique(arr)).issubset({0, 255})
    assert arr.sum() > 0


def test_segment_invalid_mime(client):
    r = client.post(
        "/segment",
        json={"mimeType": "image/gif", "data": base64.b64encode(b"x").decode()},
    )
    assert r.status_code == 400
    assert r.json() == {"error": "invalid_mime"}


def test_segment_invalid_base64(client):
    r = client.post(
        "/segment",
        json={"mimeType": "image/png", "data": "not!!!base64"},
    )
    assert r.status_code == 400
    assert r.json() == {"error": "invalid_base64"}


def test_pick_best_instance_largest_area():
    masks = np.zeros((2, 4, 4), dtype=np.float32)
    masks[0, 0:2, 0:2] = 1.0
    masks[1, :] = 1.0
    scores = np.array([0.9, 0.85])
    picked = pick_best_instance(masks, scores)
    assert picked is not None
    binary, score = picked
    assert score == 0.85
    assert binary.sum() == 16


def test_largest_connected_component_keeps_big_blob():
    binary = np.zeros((5, 5), dtype=np.uint8)
    binary[0:2, 0:2] = 1
    binary[3:5, 3:5] = 1
    out = largest_connected_component(binary)
    assert out.sum() == 4


def test_resize_long_edge_caps():
    img = Image.new("RGB", (1000, 500), (0, 0, 0))
    out = resize_long_edge(img, max_edge=768)
    assert max(out.size) == 768


def test_decode_fixture_png():
    raw = (FIXTURES / "subject.png").read_bytes()
    img = decode_subject_image("image/png", base64.b64encode(raw).decode())
    assert img.size == (128, 96)
