#!/usr/bin/env python3
"""Validate assets/env/*/kit.json and backdrop.json against design/overhaul.md section 5. Prints problems; exit 1 if any."""
import json, sys
from pathlib import Path
from PIL import Image

ENV = Path(__file__).resolve().parent.parent / "assets/env"
ZONES = {"curb", "walk", "lot", "far", "water"}
problems = []
for theme in sorted(p for p in ENV.iterdir() if p.is_dir() and p.name != "common"):
    kit_path, bd_path = theme / "kit.json", theme / "backdrop.json"
    if bd_path.exists():
        bd = json.loads(bd_path.read_text())
        if not (theme / bd.get("file", "")).exists(): problems.append(f"{theme.name}: backdrop file missing")
    else:
        problems.append(f"{theme.name}: no backdrop.json")
    if not kit_path.exists():
        problems.append(f"{theme.name}: no kit.json"); continue
    kit = json.loads(kit_path.read_text())
    for key, t in (kit.get("textures") or {}).items():
        if not (theme / t["file"]).exists(): problems.append(f"{theme.name}: texture {key} file missing")
        if not t.get("tile", 0) > 0: problems.append(f"{theme.name}: texture {key} has no tile size")
    for f in kit.get("facades") or []:
        if not (theme / f["file"]).exists(): problems.append(f"{theme.name}: facade {f['file']} missing")
        elif abs(f["w"] / f["h"] - (lambda im: im.width / im.height)(Image.open(theme / f["file"]))) > 0.05:
            problems.append(f"{theme.name}: facade {f['file']} w/h does not match the image aspect")
    props = kit.get("props") or {}
    if props:
        atlas = theme / props["atlas"]
        if not atlas.exists(): problems.append(f"{theme.name}: atlas missing"); continue
        W, H = Image.open(atlas).size
        for it in props["items"]:
            x, y, w, h = it["rect"]
            if x < 0 or y < 0 or x + w > W or y + h > H: problems.append(f"{theme.name}: {it['name']} rect outside atlas")
            if it.get("zone") not in ZONES: problems.append(f"{theme.name}: {it['name']} bad zone {it.get('zone')}")
            if not 0.2 <= it.get("h", 0) <= 20: problems.append(f"{theme.name}: {it['name']} odd height {it.get('h')}")
    n = len(props.get("items", [])) if props else 0
    print(f"{theme.name}: {n} props, {len(kit.get('facades') or [])} facades, textures {sorted((kit.get('textures') or {}).keys())}")
common = ENV / "common"
for f in ["road.jpg", "decals.png", "decals.json"]:
    if not (common / f).exists(): problems.append(f"common: {f} missing")
print("\n".join(problems) if problems else "all kits OK")
sys.exit(1 if problems else 0)
