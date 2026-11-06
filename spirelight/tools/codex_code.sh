#!/usr/bin/env bash
# Run Codex (gpt-6-astra) on a coding task from a written brief, sandboxed to the spirelight/ folder.
#   tools/codex_code.sh BRIEF.md LOG.txt [effort]      (effort: low | medium | high, default high)
# Codex edits files in place. Takes 3-20 minutes; run it in the background and wait for it to exit.
# The last lines of LOG.txt hold Codex's own summary of what it did.
set -uo pipefail
brief="$1"; log="${2:-codex.log}"; effort="${3:-high}"
here="$(cd "$(dirname "$0")/.." && pwd)"
CODEX_HOME="${CODEX_MCP_HOME:-$HOME/.codex-mcp}" codex exec --skip-git-repo-check -m gpt-6-astra \
  -c "model_reasoning_effort=\"$effort\"" -c 'service_tier="default"' -s workspace-write -C "$here" - < "$brief" > "$log" 2>&1
code=$?
echo "codex exit $code" >> "$log"
exit $code
