#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# revisar.sh — Revisa el trabajo de MiniMax en una tarea y da un veredicto.
#
# Lanza al agente `planner-reviewer` (opencode.json) con el diff de la
# tarea. El revisor NO edita nada: solo lee, comprueba los criterios de
# aceptación y responde con un veredicto:
#
#   VEREDICTO: APROBADO
#   VEREDICTO: CORRECCIONES
#   CORRECCION: <texto>
#
# Uso:
#   bash tools/minimax/revisar.sh T-001        → veredicto por pantalla
#   bash tools/minimax/revisar.sh T-001 --check → comprueba la configuración
#
# Códigos de salida:
#   0  APROBADO
#   1  hay correcciones (o el revisor no pudo opinar)
#   2  error de uso o de configuración
#
# Del .env solo se leen MINIMAX_MODEL, MINIMAX_TIMEOUT y OPENCODE_BIN.
# ────────────────────────────────────────────────────────────────────
set -uo pipefail

cd "$(dirname "$0")/../.."
ROOT="$PWD"
TASKS="node $ROOT/tools/tasks/tasks.mjs"
AGENT="planner-reviewer"

if [[ -f .env ]]; then
  while IFS= read -r line; do
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    export "$key=$val"
  done < <(grep -E '^(MINIMAX_MODEL|MINIMAX_TIMEOUT|OPENCODE_BIN)=' .env)
fi

MINIMAX_MODEL="${MINIMAX_MODEL:-minimax/MiniMax-M3}"
MINIMAX_TIMEOUT="${MINIMAX_TIMEOUT:-3600}"
OPENCODE="${OPENCODE_BIN:-$(command -v opencode || echo "$HOME/.opencode/bin/opencode")}"

OPENCODE_CMD=(
  env -i
  HOME="$HOME" PATH="$PATH" LANG="${LANG:-C.UTF-8}" TERM="${TERM:-dumb}"
  ${CARGO_HOME:+CARGO_HOME="$CARGO_HOME"} ${RUSTUP_HOME:+RUSTUP_HOME="$RUSTUP_HOME"}
  PLANNER_ROLE=worker
  "$OPENCODE" run --standalone --agent "$AGENT" --model "$MINIMAX_MODEL" --auto
)

check() {
  local ok=0
  if [[ ! -x "$OPENCODE" ]]; then
    echo "✗ No encuentro OpenCode. Instálalo o pon OPENCODE_BIN en .env."; return 1
  fi
  echo "✓ OpenCode: $OPENCODE ($("$OPENCODE" --version 2>/dev/null))"
  if ! grep -q "\"$AGENT\"" "$ROOT/opencode.json" 2>/dev/null; then
    echo "✗ Falta el agente $AGENT en opencode.json."; ok=1
  fi
  local models
  models="$(timeout 60 "$OPENCODE" models 2>/dev/null)"
  if ! grep -qx "$MINIMAX_MODEL" <<<"$models"; then
    echo "✗ OpenCode no ofrece el modelo $MINIMAX_MODEL."; ok=1
  fi
  return $ok
}

ID="${1:-}"
DIFF_FICHERO=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --diff) shift; DIFF_FICHERO="${1:-}" ;;
    --check) check; exit $? ;;
  esac
  shift
done
[[ -z "$ID" ]] && { echo "Uso: bash tools/minimax/revisar.sh T-001 [--diff fichero] | --check"; exit 2; }

$TASKS show "$ID" >/dev/null || exit 2

check >/dev/null || { check; exit 2; }

mkdir -p .tasks/logs
LOG=".tasks/logs/$ID-revision-$(date +%Y%m%d-%H%M%S).log"

if [[ -n "$DIFF_FICHERO" && -f "$DIFF_FICHERO" ]]; then
  DIFF="$(cat "$DIFF_FICHERO")"
else
  DIFF="$($TASKS diff "$ID" --total)"
fi

PROMPT="$(cat "$ROOT/tools/minimax/reviewer-prompt.md")

---

Tarea a revisar: $ID

$($TASKS show "$ID")

Diff de la tarea (cambios desde la foto del árbol):

$DIFF
"

timeout "$MINIMAX_TIMEOUT" "${OPENCODE_CMD[@]}" --title "$ID-revision" "$PROMPT" < /dev/null > "$LOG" 2>&1
CODE=$?

# El veredicto se busca en la salida del revisor.
VEREDICTO="$(grep -aE '^VEREDICTO:' "$LOG" | tail -1)"

if [[ -z "$VEREDICTO" ]]; then
  echo "✗ El revisor no dio veredicto (código $CODE). Registro: $LOG"
  tail -n 20 "$LOG" >&2
  exit 1
fi

if grep -qa 'APROBADO' <<<"$VEREDICTO"; then
  echo "$VEREDICTO"
  echo "Revisión: $LOG"
  exit 0
fi

echo "$VEREDICTO"
grep -aE '^CORRECCION:' "$LOG" || true
echo "Revisión: $LOG"
exit 1
