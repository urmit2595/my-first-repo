#!/usr/bin/env python3
"""Deep-merge assets/kit-*.json (one per art agent) into assets/kit.json, which the engine loads."""
import json, glob
from pathlib import Path
A = Path(__file__).resolve().parent.parent / "assets"
def merge(a, b):
    for k, v in b.items():
        a[k] = merge(a.get(k, {}), v) if isinstance(v, dict) and isinstance(a.get(k), dict) else v
    return a
kit = {}
for f in sorted(glob.glob(str(A / "kit-*.json"))):
    merge(kit, json.loads(Path(f).read_text())); print("merged", Path(f).name)
(A / "kit.json").write_text(json.dumps(kit, indent=1)); print("wrote assets/kit.json with", list(kit.keys()))
