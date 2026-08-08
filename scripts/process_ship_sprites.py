#!/usr/bin/env python3
"""Trim generated alpha sprites and keep a small safe equipment margin."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHIP_DIR = ROOT / "assets" / "ships"
NAMES = ("carrier", "battleship", "cruiser", "destroyer", "submarine")
MAX_WIDTH = 1200


def process(path: Path) -> None:
    with Image.open(path).convert("RGBA") as image:
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if not bbox:
            raise ValueError(f"No visible pixels found in {path.name}")

        left, top, right, bottom = bbox
        width, height = right - left, bottom - top
        pad_x = max(8, round(width * 0.025))
        pad_y = max(8, round(height * 0.08))
        crop_box = (
            max(0, left - pad_x),
            max(0, top - pad_y),
            min(image.width, right + pad_x),
            min(image.height, bottom + pad_y),
        )
        trimmed = image.crop(crop_box)

        if trimmed.width > MAX_WIDTH:
            scale = MAX_WIDTH / trimmed.width
            trimmed = trimmed.resize(
                (MAX_WIDTH, max(1, round(trimmed.height * scale))),
                Image.Resampling.LANCZOS,
            )

        trimmed.save(path, optimize=True)
        vertical_path = path.with_name(f"{path.stem}-v.png")
        trimmed.rotate(-90, expand=True).save(vertical_path, optimize=True)
        print(
            f"{path.name}: {image.width}x{image.height} -> "
            f"{trimmed.width}x{trimmed.height}; vertical {vertical_path.name}"
        )


if __name__ == "__main__":
    for name in NAMES:
        process(SHIP_DIR / f"{name}.png")
