#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# evaluar.sh — MiniMax evalúa el reto de las tareas abiertas.
#
# Lanza al agente `planner-reviewer` (solo lectura) con las tareas que
# aún no tienen evaluación y guarda, por cada una, su dificultad, su
# delicadeza y el motivo (`tasks.mjs reto`). Con eso se escribe
# STATUS.md (`tasks.mjs estado-md`), que publica tools/cola.sh.
#
# Uso:
#   bash tools/minimax/evaluar.sh              las abiertas sin evaluar
#   bash tools/minimax/evaluar.sh --todas      vuelve a evaluar todas las abiertas
#   bash tools/minimax/evaluar.sh T-069 T-070  solo esas
#
# Códigos de salida:
#   0  evaluadas (o no había nada que evaluar)
#   1  MiniMax no devolvió ninguna evaluación válida
#   75 sin saldo o con el límite de peticiones agotado (tools/minimax/sin-saldo.sh)
#
# Del .env solo se leen MINIMAX_REVIEWER_MODEL, OPENCODE_BIN y
# MINIMAX_EVAL_TIMEOUT (segundos; por defecto 1200).
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
  done < <(grep -E '^(MINIMAX_REVIEWER_MODEL|MINIMAX_EVAL_TIMEOUT|OPENCODE_BIN)=' .env)
fi

MINIMAX_MODEL="${MINIMAX_REVIEWER_MODEL:-minimax/MiniMax-M3}"
TIMEOUT="${MINIMAX_EVAL_TIMEOUT:-1200}"
OPENCODE="${OPENCODE_BIN:-$(command -v opencode || echo "$HOME/.opencode/bin/opencode")}"

if [[ "${1:-}" == "--todas" ]]; then
  mapfile -t IDS < <($TASKS sin-reto --todas)
elif [[ $# -gt 0 ]]; then
  IDS=("$@")
else
  mapfile -t IDS < <($TASKS sin-reto)
fi
[[ "${#IDS[@]}" -eq 0 ]] && { echo "No hay tareas que evaluar."; exit 0; }

INICIO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"   # para saber qué se ha evaluado ahora
mkdir -p .tasks/logs
LOG=".tasks/logs/evaluacion-$(date +%Y%m%d-%H%M%S).log"

# Cada tarea recortada: con las notas técnicas basta para evaluarla, y
# el mensaje tiene que caber en el contexto aunque sean muchas.
TAREAS=""
for id in "${IDS[@]}"; do
  TAREAS+="
════ $id
$($TASKS show "$id" | sed '/^Historial:/,$d' | head -c 4000)
"
done

# Las reglas son la skill evaluar-reto (sin su cabecera): los agentes de
# OpenCode no cargan skills, así que va entera en el mensaje.
REGLAS="$(awk 'BEGIN{n=0} /^---$/ && n<2 {n++; next} n>=2' "$ROOT/.claude/skills/evaluar-reto/SKILL.md")"
PROMPT="$REGLAS

---

Tareas a evaluar (${#IDS[@]}): ${IDS[*]}
$TAREAS"

echo "▸ MiniMax evalúa ${#IDS[@]} tarea(s) (registro: $LOG)"
timeout "$TIMEOUT" env -i \
  HOME="$HOME" PATH="$PATH" LANG="${LANG:-C.UTF-8}" TERM="${TERM:-dumb}" \
  PLANNER_ROLE=worker \
  "$OPENCODE" run --standalone --agent "$AGENT" --model "$MINIMAX_MODEL" --auto --title "evaluacion" \
  < <(printf '%s' "$PROMPT") > "$LOG" 2>&1
CODE=$?

GUARDADAS=0
while IFS='|' read -r id dif del motivo; do
  id="${id#RETO:}"; id="${id//[[:space:]]/}"
  dif="${dif//[[:space:]]/}"; del="${del//[[:space:]]/}"
  motivo="${motivo#"${motivo%%[![:space:]]*}"}"; motivo="${motivo%"${motivo##*[![:space:]]}"}"
  [[ " ${IDS[*]} " == *" $id "* ]] || continue
  if $TASKS reto "$id" --dificultad "$dif" --delicadeza "$del" --motivo "$motivo" >/dev/null 2>>"$LOG"; then
    GUARDADAS=$((GUARDADAS+1))
  fi
done < <(grep -aE '^RETO: *T-[0-9]+ *\|' "$LOG")

if [[ "$GUARDADAS" -eq 0 ]]; then
  source "$ROOT/tools/minimax/sin-saldo.sh"
  if [[ $CODE -ne 124 ]] && sin_saldo "$LOG"; then
    echo "⏸ Sin saldo para evaluar. Registro: $LOG" >&2
    exit "$SIN_SALDO_CODIGO"
  fi
  echo "✗ MiniMax no devolvió ninguna evaluación válida (código $CODE). Registro: $LOG" >&2
  tail -n 10 "$LOG" >&2
  exit 1
fi

echo "✓ Evaluadas $GUARDADAS de ${#IDS[@]} tarea(s)."

# Las que faltan (línea mal formada, otro alfabeto, motivo largo: ver
# el registro) se piden una vez más, solas.
if [[ "$GUARDADAS" -lt "${#IDS[@]}" && -z "${EVAL_REINTENTO:-}" ]]; then
  FALTAN=()
  for id in "${IDS[@]}"; do
    grep -q "^$id\$" <(node -e '
      const d = JSON.parse(require("fs").readFileSync(".tasks/tasks.json"));
      const t = d.tasks.find(x => x.id === process.argv[1]);
      if (t?.reto && Date.parse(t.reto.at) >= Date.parse(process.argv[2])) console.log(t.id);' "$id" "$INICIO") || FALTAN+=("$id")
  done
  if [[ "${#FALTAN[@]}" -gt 0 ]]; then
    echo "↻ Se vuelven a pedir: ${FALTAN[*]}"
    EVAL_REINTENTO=1 exec bash "$0" "${FALTAN[@]}"
  fi
fi
exit 0
