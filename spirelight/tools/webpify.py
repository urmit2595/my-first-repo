#!/usr/bin/env python3
"""Convert PNG/JPEG assets to WebP (lossy, alpha kept) and print the savings.
Usage: python3 tools/webpify.py [--quality 88] [--keep] FILE...   (writes FILE.webp next to each; deletes the source unless --keep)"""
import argparse, os, sys
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("files", nargs="+"); ap.add_argument("--quality", type=int, default=88); ap.add_argument("--keep", action="store_true")
a = ap.parse_args()
before = after = 0
for f in a.files:
    out = os.path.splitext(f)[0] + ".webp"
    im = Image.open(f)
    im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
    im.save(out, "WEBP", quality=a.quality, method=6)
    b, w = os.path.getsize(f), os.path.getsize(out)
    before += b; after += w
    print(f"{f}: {b/1e3:.0f} KB -> {w/1e3:.0f} KB")
    if not a.keep and out != f: os.remove(f)
print(f"total {before/1e6:.2f} MB -> {after/1e6:.2f} MB")
