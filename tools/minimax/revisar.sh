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
# Del .env solo se leen MINIMAX_REVIEWER_MODEL (por defecto minimax/MiniMax-M3), MINIMAX_TIMEOUT y OPENCODE_BIN.
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
  done < <(grep -E '^(MINIMAX_REVIEWER_MODEL|MINIMAX_TIMEOUT|OPENCODE_BIN)=' .env)
fi

MINIMAX_MODEL="${MINIMAX_REVIEWER_MODEL:-minimax/MiniMax-M3}"
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
  # El diff va ADJUNTO (--file), no dentro del mensaje: con los diffs
  # grandes la línea de órdenes revienta ("argument list too long") y
  # la revisión falla sin decir nada.
  DIFF_ARGS=(--file "$DIFF_FICHERO")
  DIFF_TXT="El diff completo de la tarea va ADJUNTO a este mensaje (fichero
$DIFF_FICHERO). Léelo con la herramienta de lectura antes de opinar: sin
él no puedes comprobar los criterios."
else
  DIFF_ARGS=()
  DIFF_TXT="Diff de la tarea (cambios desde la foto del primer intento):

$($TASKS diff "$ID" --total)"
fi

PROMPT="$(cat "$ROOT/tools/minimax/reviewer-prompt.md")

---

Tarea a revisar: $ID

$($TASKS show "$ID" | head -c 24000)

(El detalle completo de la tarea, con todo el historial de correcciones,
está en .tasks/tasks.json: léelo con la herramienta de lectura si lo
necesitas.)

$DIFF_TXT
"

timeout "$MINIMAX_TIMEOUT" "${OPENCODE_CMD[@]}" --title "$ID-revision" "${DIFF_ARGS[@]}" < <(printf '%s' "$PROMPT") > "$LOG" 2>&1
CODE=$?

# El veredicto se busca en la salida del revisor.
VEREDICTO="$(grep -aE '^VEREDICTO:' "$LOG" | tail -1)"

if [[ -z "$VEREDICTO" ]]; then
  source "$ROOT/tools/minimax/sin-saldo.sh"
  if [[ $CODE -ne 124 ]] && sin_saldo "$LOG"; then
    echo "⏸ El revisor se ha quedado sin saldo o con el límite agotado. Registro: $LOG" >&2
    tail -n 10 "$LOG" >&2
    exit "$SIN_SALDO_CODIGO"
  fi
  echo "✗ El revisor no dio veredicto (código $CODE). Esto NO es un defecto" >&2
  echo "  del trabajo revisado: es un fallo de la revisión. Registro: $LOG" >&2
  tail -n 15 "$LOG" >&2
  exit 2
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
