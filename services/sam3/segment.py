"""SAM3 inference and mask post-processing."""

from __future__ import annotations

import base64
import io
import os
from dataclasses import dataclass
from typing import Any, Literal

import numpy as np
import torch
from PIL import Image

ALLOWED_MIME = frozenset({"image/jpeg", "image/png"})
MAX_DECODE_BYTES = 8 * 1024 * 1024
MAX_LONG_EDGE = 768
SCORE_THRESHOLD = 0.5
MASK_THRESHOLD = 0.5


class SegmentError(Exception):
    def __init__(self, code: str, message: str | None = None) -> None:
        super().__init__(message or code)
        self.code = code


@dataclass(frozen=True)
class SegmentOutput:
    width: int
    height: int
    mask_png_base64: str
    overlay_png_base64: str
    label: str
    confidence: float


def resolve_device(requested: str) -> torch.device:
    if requested == "auto":
        if torch.cuda.is_available():
            return torch.device("cuda")
        if torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")
    return torch.device(requested)


def decode_subject_image(mime_type: str, data_b64: str) -> Image.Image:
    if mime_type not in ALLOWED_MIME:
        raise SegmentError("invalid_mime")
    try:
        raw = base64.b64decode(data_b64, validate=True)
    except Exception:
        raise SegmentError("invalid_base64") from None
    if len(raw) > MAX_DECODE_BYTES:
        raise SegmentError("payload_too_large")
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise SegmentError("invalid_image") from None
    return image


def resize_long_edge(image: Image.Image, max_edge: int = MAX_LONG_EDGE) -> Image.Image:
    w, h = image.size
    long_edge = max(w, h)
    if long_edge <= max_edge:
        return image
    scale = max_edge / long_edge
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return image.resize((new_w, new_h), Image.Resampling.LANCZOS)


def largest_connected_component(binary: np.ndarray) -> np.ndarray:
    """binary: H×W uint8, values 0 or 1."""
    h, w = binary.shape
    visited = np.zeros((h, w), dtype=bool)
    best_mask = np.zeros((h, w), dtype=np.uint8)
    best_area = 0

    for y0 in range(h):
        for x0 in range(w):
            if binary[y0, x0] == 0 or visited[y0, x0]:
                continue
            stack = [(y0, x0)]
            visited[y0, x0] = True
            pixels: list[tuple[int, int]] = []
            while stack:
                y, x = stack.pop()
                pixels.append((y, x))
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and binary[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        stack.append((ny, nx))
            if len(pixels) > best_area:
                best_area = len(pixels)
                best_mask.fill(0)
                for y, x in pixels:
                    best_mask[y, x] = 1
    return best_mask


def mask_to_png_base64(mask_uint8: np.ndarray) -> str:
    """mask_uint8: H×W values 0 or 1 → single-channel PNG with 0/255."""
    out = (mask_uint8.astype(np.uint8) * 255)
    img = Image.fromarray(out, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def overlay_png_base64(image: Image.Image, mask_uint8: np.ndarray) -> str:
    """RGBA cutout: subject pixels kept, background fully transparent."""
    rgb = np.array(image.convert("RGB"), dtype=np.uint8)
    alpha = (mask_uint8.astype(np.uint8) * 255)
    out = np.dstack([rgb, alpha])
    buf = io.BytesIO()
    Image.fromarray(out, mode="RGBA").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def pick_best_instance(
    masks: torch.Tensor | np.ndarray,
    scores: torch.Tensor | np.ndarray,
    score_threshold: float = SCORE_THRESHOLD,
    mask_threshold: float = MASK_THRESHOLD,
) -> tuple[np.ndarray, float] | None:
    if isinstance(masks, torch.Tensor):
        masks_np = masks.detach().cpu().numpy()
    else:
        masks_np = np.asarray(masks)
    if isinstance(scores, torch.Tensor):
        scores_np = scores.detach().cpu().numpy().reshape(-1)
    else:
        scores_np = np.asarray(scores).reshape(-1)

    if masks_np.ndim == 2:
        masks_np = masks_np[np.newaxis, ...]
    n = min(masks_np.shape[0], scores_np.shape[0])
    if n == 0:
        return None

    best_area = 0
    best_mask: np.ndarray | None = None
    best_score = 0.0

    for i in range(n):
        score = float(scores_np[i])
        if score < score_threshold:
            continue
        m = masks_np[i]
        if m.ndim == 3:
            m = m.squeeze()
        binary = (m > mask_threshold).astype(np.uint8)
        area = int(binary.sum())
        if area > best_area:
            best_area = area
            best_mask = binary
            best_score = score

    if best_mask is None or best_area == 0:
        return None
    return best_mask, best_score


class Sam3Segmenter:
    def __init__(
        self,
        model_id: str,
        device: torch.device,
        default_prompt: str,
    ) -> None:
        self.model_id = model_id
        self.device = device
        self.default_prompt = default_prompt
        self._model: Any = None
        self._processor: Any = None

    @property
    def loaded(self) -> bool:
        return self._model is not None and self._processor is not None

    def load(self) -> None:
        from transformers import Sam3Model, Sam3Processor

        token = os.environ.get("HF_TOKEN", "").strip() or None
        kwargs: dict[str, Any] = {}
        if token:
            kwargs["token"] = token

        self._processor = Sam3Processor.from_pretrained(self.model_id, **kwargs)
        self._model = Sam3Model.from_pretrained(self.model_id, **kwargs)
        self._model.to(self.device)
        self._model.eval()

    def segment(self, image: Image.Image, prompt: str | None) -> SegmentOutput:
        if not self.loaded:
            raise SegmentError("model_unavailable")

        text = (prompt or "").strip() or self.default_prompt
        image = resize_long_edge(image)
        w, h = image.size

        try:
            inputs = self._processor(images=image, text=text, return_tensors="pt").to(self.device)
            with torch.no_grad():
                outputs = self._model(**inputs)
            original_sizes = inputs.get("original_sizes")
            if original_sizes is not None:
                target_sizes = original_sizes.tolist()
            else:
                target_sizes = [[h, w]]
            results = self._processor.post_process_instance_segmentation(
                outputs,
                threshold=SCORE_THRESHOLD,
                mask_threshold=MASK_THRESHOLD,
                target_sizes=target_sizes,
            )[0]
        except torch.cuda.OutOfMemoryError:
            raise SegmentError("out_of_memory") from None
        except RuntimeError as exc:
            if "out of memory" in str(exc).lower():
                raise SegmentError("out_of_memory") from None
            raise SegmentError("segmentation_failed") from exc

        masks = results.get("masks")
        scores = results.get("scores")
        if masks is None or scores is None:
            raise SegmentError("no_subject")

        picked = pick_best_instance(masks, scores)
        if picked is None:
            raise SegmentError("no_subject")

        binary, confidence = picked
        binary = largest_connected_component(binary)
        if int(binary.sum()) == 0:
            raise SegmentError("no_subject")

        return SegmentOutput(
            width=w,
            height=h,
            mask_png_base64=mask_to_png_base64(binary),
            overlay_png_base64=overlay_png_base64(image, binary),
            label=text,
            confidence=round(confidence, 4),
        )


def create_segmenter_from_env() -> Sam3Segmenter:
    model_id = os.environ.get("SAM3_MODEL_ID", "facebook/sam3").strip()
    device_name = os.environ.get("SAM3_DEVICE", "auto").strip().lower()
    default_prompt = os.environ.get("SAM3_DEFAULT_PROMPT", "object").strip() or "object"
    device = resolve_device(device_name)
    return Sam3Segmenter(model_id=model_id, device=device, default_prompt=default_prompt)
