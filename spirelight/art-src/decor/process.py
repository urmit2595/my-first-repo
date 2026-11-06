# /// script
# dependencies = ["numpy", "scipy", "pillow"]
# ///
"""Process the raw Codex plant sheets into packed alpha atlases in assets/decor/.
Run:  uv run art-src/decor/process.py   (from spirelight/)"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, "tools")
import kit_tools as kt

SRC = Path("art-src/decor"); OUT = Path("assets/decor"); TMP = SRC / "_tmp"
OUT.mkdir(parents=True, exist_ok=True); TMP.mkdir(exist_ok=True)

def key_black(src, dst, lo=16, hi=52):
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    m = rgb.max(axis=2)
    alpha = np.clip((m - lo) / (hi - lo), 0, 1)
    col = np.clip(rgb / np.maximum(alpha[..., None], 1e-3) * np.minimum(1, alpha[..., None] * 1.0 + 0.0), 0, 255)
    col = np.where(alpha[..., None] >= 1, rgb, np.clip(rgb * 255.0 / np.maximum(m[..., None], 1), 0, 255) * np.clip(m[..., None] / 255.0 * 4, 0, 1) + rgb * (1 - np.clip(m[..., None] / 255.0 * 4, 0, 1)))
    Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8), "RGBA").save(dst)

def boxes(alpha, min_area, dil):
    mask = alpha > 40
    labels, _ = ndimage.label(ndimage.binary_dilation(mask, iterations=dil))
    bs = []
    for ys, xs in ndimage.find_objects(labels):
        if (ys.stop - ys.start) * (xs.stop - xs.start) >= min_area: bs.append((xs.start, ys.start, xs.stop, ys.stop))
    bs.sort(key=lambda b: (b[1] + b[3]) / 2)
    return bs

def order(bs, rows):
    # rows: number of rows; assign by y-centre clustering into `rows` bands then sort by x
    ys = sorted(((b[1] + b[3]) / 2, i) for i, b in enumerate(bs))
    H = max(b[3] for b in bs)
    out = [[] for _ in range(rows)]
    for b in bs:
        r = min(rows - 1, int(((b[1] + b[3]) / 2) / (H / rows) * 0.999))
        out[r].append(b)
    return [b for row in out for b in sorted(row)]

def bleed(arr):
    a = arr[..., 3]
    inv = a < 12
    idx = ndimage.distance_transform_edt(inv, return_distances=False, return_indices=True)
    rgb = arr[..., :3][tuple(idx)]
    arr = arr.copy(); arr[..., :3] = np.where(inv[..., None], rgb, arr[..., :3])
    return arr

def build(name, sheet, names, rows, max_side, dil=10, black=False, min_area=4000, atlas_max=2048, pad=12):
    keyed = TMP / f"{name}-keyed.png"
    if black: key_black(SRC / sheet, keyed)
    else: kt.key(SRC / sheet, keyed, "magenta")
    img = Image.open(keyed).convert("RGBA")
    bs = order(boxes(np.asarray(img)[..., 3], min_area, dil), rows)
    print(name, "objects", len(bs), "expected", len(names))
    sprites = []
    for i, (x0, y0, x1, y1) in enumerate(bs):
        crop = img.crop((max(0, x0 - 6), max(0, y0 - 6), min(img.width, x1 + 6), min(img.height, y1 + 6)))
        s = max_side / max(crop.size)
        if s < 1: crop = crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.LANCZOS)
        arr = bleed(np.asarray(crop))
        sprites.append((names[i] if i < len(names) else f"{name}-x{i}", Image.fromarray(arr, "RGBA")))
    # shelf pack, tallest first
    order_ = sorted(sprites, key=lambda s: -s[1].height)
    W = 1024
    while True:
        x = y = shelf = 0; rects = {}; ok = True
        for n, im in order_:
            if im.width + pad > W: ok = False; break
            if x + im.width + pad > W: x, y, shelf = 0, y + shelf, 0
            rects[n] = [x, y, im.width, im.height]; x += im.width + pad; shelf = max(shelf, im.height + pad)
        H = y + shelf
        if ok and H <= W * 1.0 + 1: break
        W *= 2
        if W > atlas_max: raise SystemExit("atlas too big " + name)
    # round H up to a multiple of 4
    H = (H + 3) // 4 * 4
    sheetim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for n, im in order_: sheetim.paste(im, tuple(rects[n][:2]))
    png = TMP / f"{name}.png"; sheetim.save(png)
    sheetim.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6, alpha_quality=100)
    (OUT / f"{name}.json").write_text(json.dumps({"_size": [W, H], **rects}))
    print(f"  {name}: atlas {W}x{H}, {(OUT / f'{name}.webp').stat().st_size / 1000:.0f} KB")
    for n, im in sorted(sprites, key=lambda s: s[0]): print("   ", n, im.size)

build("ivy", "ivy.png", [f"ivy-{i}" for i in range(1, 9)], 2, 384)
build("vines", "vines.png", [f"vine-{i}" for i in range(1, 7)], 1, 640, dil=14, min_area=6000)
build("plants", "plants.png", ["pot-fern", "pot-shrub", "pot-succ", "pot-herb", "canopy-1", "canopy-2", "tuft", "fern"], 2, 400)
build("flowers", "flowers.png", [f"flower-{i}" for i in range(1, 9)], 2, 320, black=True, dil=8)
