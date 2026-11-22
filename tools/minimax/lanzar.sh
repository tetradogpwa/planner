#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# lanzar.sh — Lanza run-task.sh desacoplado de la sesión de Claude y
# espera a que termine.
#
# run-task.sh corre en su propia sesión (setsid): si el usuario hace
# /clear o cierra Claude Code, MiniMax sigue trabajando y deja la tarea
# en en_revision (o pendiente si falla). Este script solo espera y, al
# final, imprime el resultado; si muere con la sesión no pasa nada: la
# skill `avanzar` retoma el ciclo desde la cola.
#
# Uso:
#   bash tools/minimax/lanzar.sh T-001          lanza y espera
#   bash tools/minimax/lanzar.sh T-001 --esperar solo espera a uno ya lanzado
# ────────────────────────────────────────────────────────────────────
set -uo pipefail

cd "$(dirname "$0")/../.."
ID="${1:-}"
[[ -z "$ID" ]] && { echo "Uso: bash tools/minimax/lanzar.sh T-001 [--esperar]"; exit 2; }

running() { pgrep -f "minimax/run-task.sh $ID" >/dev/null; }

if [[ "${2:-}" != "--esperar" ]]; then
  if running; then
    echo "MiniMax ya está con $ID; solo espero."
  else
    mkdir -p .tasks/logs
    OUT=".tasks/logs/$ID-lanzador.out"
    setsid -f bash tools/minimax/run-task.sh "$ID" > "$OUT" 2>&1 < /dev/null
    sleep 2
    running || { echo "✗ run-task.sh no arrancó:"; cat "$OUT"; exit 1; }
    echo "▸ MiniMax lanzado con $ID (desacoplado; /clear no lo corta). Salida: $OUT"
  fi
fi

while running; do sleep 10; done

STATUS="$(node tools/tasks/tasks.mjs show "$ID" | head -1)"
echo "■ run-task.sh terminado: $STATUS"
cat ".tasks/logs/$ID-lanzador.out" 2>/dev/null | tail -n 45
