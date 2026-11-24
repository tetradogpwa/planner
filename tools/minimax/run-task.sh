#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# run-task.sh — Ejecuta una tarea de la cola con MiniMax en OpenCode.
#
# MiniMax corre con `opencode run` y el agente `planner-worker`
# (opencode.json en la raíz), que define sus permisos: puede leer y
# editar el código y lanzar comprobaciones, pero no tocar la cola de
# tareas, .env, .claude/, CLAUDE.md ni el historial de git. La clave de
# MiniMax la guarda OpenCode (`opencode auth login`), no este script.
#
# Uso:
#   bash tools/minimax/run-task.sh T-001           ejecuta la tarea
#   bash tools/minimax/run-task.sh T-001 --dry-run muestra qué haría
#   bash tools/minimax/run-task.sh --check         comprueba la configuración (sin gasto)
#   bash tools/minimax/run-task.sh --ping          pide "OK" a MiniMax (gasta unos pocos tokens)
#
# Opcional en .env: MINIMAX_WORKER_MODEL (formato proveedor/modelo de OpenCode;
# por defecto minimax/MiniMax-M3.1-Flash), MINIMAX_TIMEOUT (segundos; por defecto
# 3600) y OPENCODE_BIN.
# ────────────────────────────────────────────────────────────────────
set -uo pipefail

cd "$(dirname "$0")/../.."
ROOT="$PWD"
TASKS="node $ROOT/tools/tasks/tasks.mjs"
AGENT="planner-worker"

# Del .env solo se leen estas variables.
if [[ -f .env ]]; then
  while IFS= read -r line; do
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    export "$key=$val"
  done < <(grep -E '^(MINIMAX_WORKER_MODEL|MINIMAX_TIMEOUT|OPENCODE_BIN)=' .env)
fi

MINIMAX_MODEL="${MINIMAX_WORKER_MODEL:-minimax/MiniMax-M3.1-Flash}"
MINIMAX_TIMEOUT="${MINIMAX_TIMEOUT:-3600}"
OPENCODE="${OPENCODE_BIN:-$(command -v opencode || echo "$HOME/.opencode/bin/opencode")}"

# OpenCode en un entorno limpio: nada de la sesión del supervisor llega a
# MiniMax. PLANNER_ROLE=worker hace que el hook del supervisor no actúe.
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
  if grep -q "\"$AGENT\"" "$ROOT/opencode.json" 2>/dev/null; then
    echo "✓ Agente $AGENT definido en opencode.json"
  else
    echo "✗ Falta el agente $AGENT en opencode.json."; ok=1
  fi
  local models
  models="$(timeout 60 "$OPENCODE" models 2>/dev/null)"
  if grep -qx "$MINIMAX_MODEL" <<<"$models"; then
    echo "✓ Modelo disponible: $MINIMAX_MODEL"
  else
    echo "✗ OpenCode no ofrece el modelo $MINIMAX_MODEL. Modelos de MiniMax disponibles:"
    grep -i '^minimax/' <<<"$models" | sed 's/^/    /'
    echo "  Si no aparece ninguno, conecta MiniMax con: opencode auth login"
    ok=1
  fi
  return $ok
}

case "${1:-}" in
  --check)
    check; exit $? ;;
  --ping)
    check >/dev/null || { check; exit 2; }
    timeout 180 "${OPENCODE_CMD[@]}" "Responde solo con la palabra OK. No uses herramientas." < /dev/null
    exit $? ;;
esac

ID="${1:-}"
DRY="${2:-}"
[[ -z "$ID" ]] && { echo "Uso: bash tools/minimax/run-task.sh T-001 [--dry-run] | --check | --ping"; exit 2; }

$TASKS show "$ID" >/dev/null || exit 2

if running="$($TASKS busy)"; then :; else
  if [[ "$running" != "$ID" ]]; then
    echo "MiniMax ya está con $running. Espera a que termine (una tarea cada vez)."; exit 3
  fi
fi

# Instrucciones = reglas del desarrollador + la tarea.
PROMPT="$(cat "$ROOT/tools/minimax/worker-prompt.md")

---

$($TASKS prompt "$ID")"

if [[ "$DRY" == "--dry-run" ]]; then
  echo "── Se ejecutaría: opencode run --standalone --agent $AGENT --model $MINIMAX_MODEL --auto --title $ID"
  echo "── Permisos: agent.$AGENT en opencode.json"
  echo "── Instrucciones:"; echo "$PROMPT"
  exit 0
fi

check >/dev/null || { check; exit 2; }

mkdir -p .tasks/logs
LOG=".tasks/logs/$ID-$(date +%Y%m%d-%H%M%S).log"

$TASKS snapshot "$ID" >/dev/null
$TASKS status "$ID" en_curso --note "MiniMax ($MINIMAX_MODEL en OpenCode) empieza; registro en $LOG" >/dev/null
echo "▸ MiniMax trabajando en $ID (registro: $LOG)"

# El prompt va por la entrada estándar, no como argumento: con muchas
# correcciones acumuladas el mensaje puede pasar del tamaño máximo que
# acepta el sistema ("argument list too long") y el MiniMax no llega a
# arrancar.
timeout "$MINIMAX_TIMEOUT" "${OPENCODE_CMD[@]}" --title "$ID" < <(printf '%s' "$PROMPT") > "$LOG" 2>&1
CODE=$?

# OpenCode puede salir con 0 aunque el proveedor haya fallado.
if [[ $CODE -eq 0 ]] && grep -qiE 'ProviderAuthError|AI_APICallError|APIError|unauthorized|invalid api key' "$LOG"; then
  CODE=1
fi

# Sin saldo o con el límite de peticiones agotado: no es un fallo de la
# tarea. Vuelve a pendiente sin correcciones y se sale con 75 para que
# cola.sh espere a que haya saldo y repita sin contar el intento.
source "$ROOT/tools/minimax/sin-saldo.sh"
if [[ $CODE -ne 124 ]] && sin_saldo "$LOG"; then
  $TASKS status "$ID" pendiente --note "MiniMax sin saldo o con el límite de peticiones agotado; se reintentará cuando haya. Ver $LOG" >/dev/null
  echo "⏸ MiniMax sin saldo o con el límite agotado en $ID. Últimas líneas:"
  tail -n 10 "$LOG"
  exit "$SIN_SALDO_CODIGO"
fi

if [[ $CODE -eq 0 ]]; then
  $TASKS status "$ID" en_revision --note "MiniMax ha terminado" >/dev/null
  echo "✓ $ID lista para revisión. Resumen de MiniMax:"
  tail -n 40 "$LOG"
else
  [[ $CODE -eq 124 ]] && echo "(Se agotó el tiempo máximo de ${MINIMAX_TIMEOUT}s.)"
  $TASKS status "$ID" pendiente --note "MiniMax falló (código $CODE); ver $LOG" >/dev/null
  echo "✗ MiniMax falló en $ID (código $CODE). Últimas líneas:"
  tail -n 20 "$LOG"
fi
exit $CODE
