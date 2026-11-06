#!/usr/bin/env python3
"""Generate images with Codex's built-in image tool (gpt-6-astra), without the 60 s MCP tool timeout.

Usage:
  python3 tools/codex_image.py --out DIR --name NAME [--count N] [--ref IMG ...] (--prompt TEXT | --prompt-file FILE)

Prints one saved file path per line (NAME.png, or NAME-1.png ... NAME-N.png when --count > 1) and writes
NAME.prompt.txt next to them. Each run is matched to its own images through the Codex thread id, so several
runs can go in parallel. Exits 1 if no image came back after the retries.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

CODEX_HOME = os.environ.get("CODEX_MCP_HOME", str(Path.home() / ".codex-mcp"))
GENERATED = Path(CODEX_HOME) / "generated_images"
SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


def run_once(prompt: str, refs: list[str], count: int, timeout: int) -> tuple[list[Path], str]:
    instruction = (
        f"Use the built-in image generation tool to create {count} image(s). "
        + ("Use the attached image(s) as references. " if refs else "")
        + f"Request: {prompt}\n\nDo not write code or files yourself. When done, reply with one short line describing the result."
    )
    cmd = [
        shutil.which("codex") or "codex", "exec", "--ephemeral", "--skip-git-repo-check", "--json",
        "-m", "gpt-6-astra", "-c", 'model_reasoning_effort="medium"', "-c", 'service_tier="default"',
        "-s", "read-only", "-C", tempfile.gettempdir(),
    ]
    for ref in refs:
        cmd += ["-i", ref]
    cmd += ["--", instruction]
    proc = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "CODEX_HOME": CODEX_HOME})
    thread, message = None, ""
    for line in proc.stdout.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") == "thread.started":
            thread = event.get("thread_id")
        item = event.get("item") or {}
        if item.get("type") == "agent_message":
            message = item.get("text", "")
    folder = GENERATED / thread if thread else None
    images = sorted((p for p in folder.iterdir() if p.suffix.lower() in SUFFIXES), key=lambda p: p.stat().st_mtime) \
        if folder and folder.is_dir() else []
    if not images:
        message = message or (proc.stdout[-1500:] + proc.stderr[-1500:])
    return images, message


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--count", type=int, default=1)
    ap.add_argument("--ref", action="append", default=[])
    ap.add_argument("--prompt")
    ap.add_argument("--prompt-file")
    ap.add_argument("--retries", type=int, default=2)
    ap.add_argument("--timeout", type=int, default=900)
    a = ap.parse_args()
    prompt = a.prompt if a.prompt else Path(a.prompt_file).read_text()
    refs = [str(Path(r).expanduser().resolve()) for r in a.ref]
    missing = [r for r in refs if not Path(r).is_file()]
    if missing:
        print(f"reference images not found: {missing}", file=sys.stderr)
        return 1
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{a.name}.prompt.txt").write_text(prompt + ("\n\nrefs: " + ", ".join(refs) if refs else "") + "\n")
    for attempt in range(a.retries + 1):
        try:
            images, message = run_once(prompt, refs, a.count, a.timeout)
        except subprocess.TimeoutExpired:
            images, message = [], f"timed out after {a.timeout}s"
        if images:
            saved = []
            for i, src in enumerate(images[: a.count]):
                dst = out / (f"{a.name}{src.suffix}" if a.count == 1 else f"{a.name}-{i + 1}{src.suffix}")
                shutil.copy2(src, dst)
                saved.append(dst)
            for path in saved:
                print(path)
            if message:
                print(f"# codex: {message.strip()[:300]}", file=sys.stderr)
            return 0
        wait = 20 * (attempt + 1)
        print(f"# attempt {attempt + 1} gave no image ({message.strip()[:400]}); retrying in {wait}s", file=sys.stderr)
        if attempt < a.retries:
            time.sleep(wait)
    return 1


if __name__ == "__main__":
    sys.exit(main())
