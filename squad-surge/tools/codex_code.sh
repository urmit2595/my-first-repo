#!/usr/bin/env bash
# Run Codex (gpt-6-astra, Fast/priority tier) on a coding task from a written brief, sandboxed to squad-surge/.
#   tools/codex_code.sh BRIEF.md LOG.txt [effort]      (effort: low | medium | high, default high)
set -uo pipefail
brief="$1"; log="${2:-codex.log}"; effort="${3:-high}"
here="$(cd "$(dirname "$0")/.." && pwd)"
CODEX_HOME="${CODEX_MCP_HOME:-$HOME/.codex-mcp}" codex exec --skip-git-repo-check -m gpt-6-astra \
  -c "model_reasoning_effort=\"$effort\"" -c 'service_tier="priority"' -s workspace-write -C "$here" - < "$brief" > "$log" 2>&1
code=$?
echo "codex exit $code" >> "$log"
exit $code
