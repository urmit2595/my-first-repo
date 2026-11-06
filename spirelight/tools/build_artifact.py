#!/usr/bin/env python3
"""Build the files for publishing Spirelight as a claude.ai Artifact.

The Artifact publisher wraps the page in its own <!doctype html><head><body> skeleton, so dist/index.html is
index.html without the document wrapper, charset and viewport tags. Everything else (the modules, levels and assets)
is published next to it at the same relative paths. Prints the `files` map as JSON.

  python3 tools/build_artifact.py > /tmp/files.json
"""
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
page = (root / "index.html").read_text()
for pattern in (r"<!doctype html>\s*", r"</?html[^>]*>\s*", r"</?head>\s*", r"</?body>\s*",
                r'<meta charset[^>]*>\s*', r'<meta name="viewport"[^>]*>\s*'):
    page = re.sub(pattern, "", page, flags=re.I)
(root / "dist").mkdir(exist_ok=True)
(root / "dist" / "index.html").write_text(page)

files = {}
for pattern in ("js/*.js", "levels/*.js", "assets/**/*.webp", "assets/**/*.json", "assets/fonts/*.woff2"):
    for f in sorted(root.glob(pattern)):
        files[f.relative_to(root).as_posix()] = str(f)
print(json.dumps(files, indent=1))
