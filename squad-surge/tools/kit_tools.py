# /// script
# dependencies = ["numpy", "scipy", "pillow"]
# ///
"""Shared art-kit tools. Run with:  uv run tools/kit_tools.py <command> ...

  key IN OUT [--bg auto|green|magenta]
      Chroma-key a generated sheet (flat green #00FF00 or magenta #FF00FF background) to an RGBA PNG.
  split IN_RGBA OUTDIR [--names a,b,c] [--min-area 2500] [--pad 4] [--max-side 1024]
      Cut every separate object (reading order: rows top to bottom, then left to right) into its own tight PNG.
      Fragments closer than ~8 px are merged into one object. Prints name, size and aspect for each.
  pack OUT_PNG OUT_JSON IMG... [--max 2048] [--pad 4]
      Shelf-pack sprites into one atlas. JSON maps file stem -> [x, y, w, h] in atlas pixels (top-left origin)
      plus "_size": [W, H]. Fails if it does not fit; downscale the inputs first.
  seamless IN OUT [--size 1024] [--quality 88]
      Make an organic texture tile seamlessly (half-offset cross-fade) and save it square as JPEG or PNG.
  fit IN OUT [--max-side 1024]
      Downscale an image so its longer side is at most --max-side (keeps alpha), PNG or JPEG by extension.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def detect_bg(rgb: np.ndarray) -> str:
    border = np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3), rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3)])
    r, g, b = np.median(border, axis=0)
    if g > 150 and g - max(r, b) > 60:
        return "green"
    if min(r, b) > 150 and min(r, b) - g > 60:
        return "magenta"
    raise SystemExit(f"background is neither green nor magenta (median border colour {r:.0f},{g:.0f},{b:.0f})")


def key(src: Path, dst: Path, bg: str = "auto") -> None:
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    bg = detect_bg(rgb) if bg == "auto" else bg
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if bg == "green":
        amount = g - np.maximum(r, b)
        alpha = np.clip(1 - (amount - 40) / 80, 0, 1)
        spill = amount > 0
        rgb[..., 1] = np.where(spill, np.minimum(g, np.maximum(r, b) + 8), g)
    else:
        amount = np.minimum(r, b) - g
        alpha = np.clip(1 - (amount - 40) / 80, 0, 1)
        spill = amount > 0
        cap = g + 8
        rgb[..., 0] = np.where(spill, np.minimum(r, np.maximum(cap, r - amount)), r)
        rgb[..., 2] = np.where(spill, np.minimum(b, np.maximum(cap, b - amount)), b)
    # drop isolated speckles and soften the very edge by one pixel
    solid = ndimage.binary_opening(alpha > 0.5, iterations=1)
    alpha = np.where(solid | (alpha > 0.5), alpha, 0)
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(dst, optimize=True)
    print(f"keyed {src.name} ({bg}) -> {dst}")


def objects(alpha: np.ndarray, min_area: int) -> list[tuple[int, int, int, int]]:
    mask = alpha > 40
    labels, _ = ndimage.label(ndimage.binary_dilation(mask, iterations=4))
    boxes = []
    for sl in ndimage.find_objects(labels):
        ys, xs = sl
        if (ys.stop - ys.start) * (xs.stop - xs.start) >= min_area:
            boxes.append((xs.start, ys.start, xs.stop, ys.stop))
    # reading order: cluster by vertical centre into rows, then left to right
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows: list[list[tuple[int, int, int, int]]] = []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        if rows and abs(cy - np.mean([(q[1] + q[3]) / 2 for q in rows[-1]])) < 0.5 * (b[3] - b[1]):
            rows[-1].append(b)
        else:
            rows.append([b])
    return [b for row in rows for b in sorted(row)]


def split(src: Path, outdir: Path, names: list[str], min_area: int, pad: int, max_side: int) -> None:
    img = Image.open(src).convert("RGBA")
    boxes = objects(np.asarray(img)[..., 3], min_area)
    outdir.mkdir(parents=True, exist_ok=True)
    if names and len(names) != len(boxes):
        print(f"WARNING: found {len(boxes)} objects but {len(names)} names; extra objects are named obj-N", file=sys.stderr)
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        crop = img.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad)))
        crop.thumbnail((max_side, max_side), Image.LANCZOS)
        name = names[i] if i < len(names) else f"obj-{i + 1}"
        crop.save(outdir / f"{name}.png", optimize=True)
        print(f"{name}: {crop.width}x{crop.height} aspect {crop.width / crop.height:.3f}")


def pack(out_png: Path, out_json: Path, files: list[Path], max_size: int, pad: int) -> None:
    sprites = sorted(((Image.open(f).convert("RGBA"), f.stem) for f in files), key=lambda s: -s[0].height)
    width = max_size
    x = y = shelf = 0
    rects = {}
    for im, name in sprites:
        if im.width + pad > width:
            raise SystemExit(f"{name} is wider than the atlas")
        if x + im.width + pad > width:
            x, y, shelf = 0, y + shelf, 0
        rects[name] = [x, y, im.width, im.height]
        x += im.width + pad
        shelf = max(shelf, im.height + pad)
    height = y + shelf
    if height > max_size:
        raise SystemExit(f"atlas needs {width}x{height}; downscale sprites (fit --max-side) and retry")
    used_w = max(r[0] + r[2] for r in rects.values())
    sheet = Image.new("RGBA", (used_w, height))
    for im, name in sprites:
        sheet.paste(im, tuple(rects[name][:2]))
    sheet.save(out_png, optimize=True)
    out_json.write_text(json.dumps({"_size": [used_w, height], **rects}, indent=1))
    print(f"packed {len(rects)} sprites into {out_png} ({used_w}x{height})")


def seamless(src: Path, dst: Path, size: int, quality: int) -> None:
    img = Image.open(src).convert("RGB")
    s = min(img.size)
    img = img.crop(((img.width - s) // 2, (img.height - s) // 2, (img.width + s) // 2, (img.height + s) // 2)).resize((size, size), Image.LANCZOS)
    a = np.asarray(img).astype(np.float32)
    rolled = np.roll(np.roll(a, size // 2, axis=0), size // 2, axis=1)
    t = np.linspace(0, 1, size)
    w1 = np.sin(np.pi * t) ** 2  # 1 in the middle, 0 at the edges
    w = np.minimum.outer(w1, w1)[..., None]
    out = (a * w + rolled * (1 - w)).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out)
    im.save(dst, quality=quality) if dst.suffix.lower() in (".jpg", ".jpeg") else im.save(dst, optimize=True)
    print(f"seamless {dst} {size}x{size}")


def fit(src: Path, dst: Path, max_side: int) -> None:
    img = Image.open(src)
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    if dst.suffix.lower() in (".jpg", ".jpeg"):
        img.convert("RGB").save(dst, quality=88)
    else:
        img.save(dst, optimize=True)
    print(f"fit {dst} {img.width}x{img.height}")


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    k = sub.add_parser("key"); k.add_argument("src"); k.add_argument("dst"); k.add_argument("--bg", default="auto")
    s = sub.add_parser("split"); s.add_argument("src"); s.add_argument("outdir"); s.add_argument("--names", default="")
    s.add_argument("--min-area", type=int, default=2500); s.add_argument("--pad", type=int, default=4); s.add_argument("--max-side", type=int, default=1024)
    p = sub.add_parser("pack"); p.add_argument("out_png"); p.add_argument("out_json"); p.add_argument("files", nargs="+")
    p.add_argument("--max", type=int, default=2048); p.add_argument("--pad", type=int, default=4)
    m = sub.add_parser("seamless"); m.add_argument("src"); m.add_argument("dst"); m.add_argument("--size", type=int, default=1024); m.add_argument("--quality", type=int, default=88)
    f = sub.add_parser("fit"); f.add_argument("src"); f.add_argument("dst"); f.add_argument("--max-side", type=int, default=1024)
    a = ap.parse_args()
    if a.cmd == "key":
        key(Path(a.src), Path(a.dst), a.bg)
    elif a.cmd == "split":
        split(Path(a.src), Path(a.outdir), [n for n in a.names.split(",") if n], a.min_area, a.pad, a.max_side)
    elif a.cmd == "pack":
        pack(Path(a.out_png), Path(a.out_json), [Path(x) for x in a.files], a.max, a.pad)
    elif a.cmd == "seamless":
        seamless(Path(a.src), Path(a.dst), a.size, a.quality)
    elif a.cmd == "fit":
        fit(Path(a.src), Path(a.dst), a.max_side)


if __name__ == "__main__":
    main()
