# /// script
# dependencies = ["numpy", "scipy", "pillow"]
# ///
"""Key + cut + pack the units2 sheets. Run from squad-surge/: uv run art-src/units2/build.py
Same pipeline as assets/process.py: key green, find objects, uniform bottom-centred cells (feet on one baseline)."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, "tools")
import kit_tools

SRC = Path("art-src/units2"); OUT = Path("assets/units2")
def keyed(name):
    k = SRC / f"{name}-k.png"; kit_tools.key(SRC / f"{name}.png", k, "green"); return Image.open(k).convert("RGBA")

def objects(img, rows, min_area=1500):
    mask = np.asarray(img)[..., 3] > 40
    labels, _ = ndimage.label(ndimage.binary_dilation(mask, iterations=6))
    boxes = [(xs.start, ys.start, xs.stop, ys.stop) for ys, xs in ndimage.find_objects(labels) if (ys.stop - ys.start) * (xs.stop - xs.start) >= min_area]
    band = img.height / rows
    return [sorted(b for b in boxes if int(((b[1] + b[3]) / 2) // band) == r) for r in range(rows)]

def atlas(img, rows, cols, name, cell_h, q=84):
    frames = []; col_w = img.width / cols
    for r, row in enumerate(objects(img, rows)):
        cells = {}
        for b in row:
            c = min(cols - 1, int(((b[0] + b[2]) / 2) // col_w)); o = cells.get(c, b)
            cells[c] = (min(o[0], b[0]), min(o[1], b[1]), max(o[2], b[2]), max(o[3], b[3]))
        if len(cells) != cols:  # touching frames merged: fall back to equal column bands
            print(f"  {name} row {r}: {len(cells)} cols, using column bands")
            a = np.asarray(img)[..., 3] > 40; rb = int(img.height / rows)
            for c in range(cols):
                sub = a[r * rb:(r + 1) * rb, int(c * col_w):int((c + 1) * col_w)]
                sub = ndimage.binary_opening(sub, iterations=2)
                ys, xs = np.where(sub)
                cells[c] = (int(c * col_w) + xs.min(), r * rb + ys.min(), int(c * col_w) + xs.max() + 1, r * rb + ys.max() + 1)
        frames += [cells[c] for c in sorted(cells)]
    w = max(b[2] - b[0] for b in frames); h = max(b[3] - b[1] for b in frames)
    s = cell_h / h; cw, ch = int(w * s) + 4, cell_h + 4
    sheet = Image.new("RGBA", (cw * cols, ch * rows))
    for i, b in enumerate(frames):
        c = img.crop(b); c = c.resize((max(1, int(c.width * s)), max(1, int(c.height * s))), Image.LANCZOS)
        r, cc = divmod(i, cols); sheet.paste(c, (cc * cw + (cw - c.width) // 2, r * ch + ch - c.height - 2))
    sheet.save(OUT / f"{name}.webp", "WEBP", quality=q, method=6)
    kb = (OUT / f"{name}.webp").stat().st_size // 1000
    print(name, sheet.size, f"cell {cw}x{ch} aspect {cw/ch:.3f} {kb}KB")
    return {"cols": cols, "rows": rows, "aspect": round(cw / ch, 3), "cell": [cw, ch]}

meta = {}
for n in ["shieldbearer", "charger", "bomber", "rifleman", "medic", "splitter", "splitter-mini"]:
    meta[n] = atlas(keyed(n), 2, 4, n, 320)
for n in ["bulwark", "ravager", "gunner", "colossus", "warlord"]:
    meta["boss-" + n] = atlas(keyed("boss-" + n), 2, 3, "boss-" + n, 340)
(OUT / "atlas.json").write_text(json.dumps(meta, indent=1))
