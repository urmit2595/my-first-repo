# /// script
# dependencies = ["numpy", "scipy", "pillow"]
# ///
"""Re-cut the character and FX atlases at 2x resolution. Run from squad-surge/: uv run --with numpy --with scipy --with pillow python tools/recut_sprites.py"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

RAW = Path("/home/user/squad-surge/assets/raw")
OUT = Path("/home/user/my-first-repo/squad-surge/assets")


def key_green(path: Path) -> Image.Image:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    greenness = g - np.maximum(r, b)
    alpha = np.clip(1 - (greenness - 40) / 80, 0, 1)
    rgb[..., 1] = np.minimum(g, np.maximum(r, b) + 12)  # spill suppression
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8), "RGBA")


def objects(img: Image.Image, rows: int, min_area: int = 1500) -> list[list[tuple[int, int, int, int]]]:
    """Bounding boxes of separate objects, grouped into `rows` rows (top to bottom), each sorted left to right."""
    mask = np.asarray(img)[..., 3] > 40
    labels, _ = ndimage.label(ndimage.binary_dilation(mask, iterations=5))
    boxes = []
    for ys, xs in ndimage.find_objects(labels):
        if (ys.stop - ys.start) * (xs.stop - xs.start) >= min_area:
            boxes.append((xs.start, ys.start, xs.stop, ys.stop))
    band = img.height / rows
    grouped = [sorted([b for b in boxes if int(((b[1] + b[3]) / 2) // band) == r]) for r in range(rows)]
    return grouped


def atlas(img: Image.Image, rows: int, cols: int, name: str, cell_h: int) -> dict:
    """Uniform-cell atlas, each frame bottom-centred (feet stay planted between frames)."""
    frames = []
    col_w = img.width / cols
    for r, row in enumerate(objects(img, rows)):
        cells: dict[int, tuple[int, int, int, int]] = {}
        for b in row:  # fragments (smoke, sparks) merge into the frame whose column they sit in
            c = min(cols - 1, int(((b[0] + b[2]) / 2) // col_w))
            o = cells.get(c, b)
            cells[c] = (min(o[0], b[0]), min(o[1], b[1]), max(o[2], b[2]), max(o[3], b[3]))
        if len(cells) != cols:
            print(f"  warning {name} row {r}: {len(cells)} columns filled, expected {cols}")
        frames += [cells[c] for c in sorted(cells)]
    w = max(b[2] - b[0] for b in frames)
    h = max(b[3] - b[1] for b in frames)
    scale = cell_h / h
    cw, ch = int(w * scale) + 4, cell_h + 4
    sheet = Image.new("RGBA", (cw * cols, ch * rows))
    for i, b in enumerate(frames):
        crop = img.crop(b)
        crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))), Image.LANCZOS)
        r, c = divmod(i, cols)
        sheet.paste(crop, (c * cw + (cw - crop.width) // 2, r * ch + ch - crop.height - 2))
    sheet.save(OUT / f"{name}.png", optimize=True)
    print(name, sheet.size, f"cell {cw}x{ch}", f"aspect {cw / ch:.3f}")
    return {"cols": cols, "rows": rows, "aspect": round(cw / ch, 3)}


ATLASES = {
    "soldier": ("anim/soldier-blue-run-shoot.png", 2, 4, 320),
    "grunt": ("anim/grunt-red-run-die.png", 2, 4, 320),
    "zombie": ("anim/zombie-walk-die.png", 2, 4, 320),
    "brute": ("anim/brute-grey-run-die.png", 2, 4, 400),
    "boss": ("anim/boss-ogre.png", 2, 3, 680),  # 720 gives 2166 px wide, over the 2048 limit
}

meta = {name: atlas(key_green(RAW / src), rows, cols, name, cell_h)
        for name, (src, rows, cols, cell_h) in ATLASES.items()}
Image.open(RAW / "fx/vfx-sheet-black.png").convert("RGB").resize((1024, 1024), Image.LANCZOS).save(OUT / "fx.jpg", quality=90)
print(meta)
