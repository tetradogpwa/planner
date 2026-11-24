#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# continuar.sh — Retoma el trabajo de MiniMax (p. ej. tras reiniciar el PC).
#
# Un solo comando, seguro de repetir: si la cola autónoma (tools/cola.sh)
# ya está trabajando, solo dice cómo va; si está parada y quedan tareas
# abiertas, la relanza desacoplada (sobrevive a cerrar la terminal).
# Lo que se cortó con el reinicio se recupera solo: una tarea que se
# quedó "en curso" vuelve a la cola y una "en revisión" se revisa.
#
# Uso:
#   bash tools/continuar.sh                  → ver estado y relanzar si hace falta
#   bash tools/continuar.sh --estado         → solo ver el estado (no lanza nada)
#   bash tools/continuar.sh --parar          → parar la cola y lo que tenga en marcha
#   bash tools/continuar.sh --al-arrancar    → relanzar solo al iniciar sesión (systemd --user)
#   bash tools/continuar.sh --quitar-arranque
#   bash tools/continuar.sh --ayuda
# ────────────────────────────────────────────────────────────────────
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
STORE="$ROOT/.tasks/tasks.json"
UNIDAD="planner-cola.service"
UNIDAD_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

MODO="continuar"
case "${1:-}" in
  "")                MODO="continuar" ;;
  --estado)          MODO="estado" ;;
  --parar)           MODO="parar" ;;
  --al-arrancar)     MODO="instalar" ;;
  --quitar-arranque) MODO="desinstalar" ;;
  --ayuda|-h)
    awk '/^#!/ {next} /^# ─+/ {next} /^#/ {sub(/^# ?/,""); print; next} {exit}' "$0"
    exit 0 ;;
  *) echo "✗ Argumento desconocido: $1 (usa --ayuda)" >&2; exit 2 ;;
esac

pid_cola() { pgrep -f "^bash tools/cola.sh" | head -1; }

abiertas() {  # número de tareas pendientes, en curso o en revisión
  node -e '
    const db = require(process.argv[1]);
    console.log(db.tasks.filter(t => ["pendiente","en_curso","en_revision"].includes(t.status)).length);
  ' "$STORE" 2>/dev/null || echo 0
}

estado() {
  local pid log
  pid="$(pid_cola)"
  echo "════ Planificador · trabajo de MiniMax"
  if [[ -n "$pid" && -f .tasks/logs/espera-saldo ]]; then
    echo "⏸ La cola está esperando a que MiniMax tenga cuota: sigue sola a las $(cat .tasks/logs/espera-saldo)."
  elif [[ -n "$pid" ]]; then
    echo "▶ La cola está trabajando (pid $pid)."
  else
    echo "⏸ La cola está parada."
  fi
  echo
  node tools/tasks/tasks.mjs list 2>/dev/null | sed 's/^/  /'
  log="$(ls -t .tasks/logs/cola-2*.log 2>/dev/null | head -1)"
  if [[ -n "$log" ]]; then
    echo
    echo "── Últimas líneas de $log"
    tail -n 12 "$log" | sed 's/^/  /'
  fi
  echo
  echo "── Últimos commits"
  git log --oneline -5 | sed 's/^/  /'
}

lanzar() {
  if [[ -n "$(pid_cola)" ]]; then return 0; fi
  if [[ "$(abiertas)" -eq 0 ]]; then
    echo "✓ No quedan tareas abiertas: no hay nada que relanzar."
    return 0
  fi
  # Restos de una ejecución cortada: weston/tauri-driver de las E2E.
  pkill -f "tauri-driver" 2>/dev/null || true
  rm -f .tasks/logs/espera-saldo   # de una espera anterior (la cola la recalcula)
  mkdir -p .tasks/logs
  setsid -f bash tools/cola.sh > .tasks/logs/cola-nohup.log 2>&1 < /dev/null
  sleep 2
  if [[ -n "$(pid_cola)" ]]; then
    echo "▶ Cola relanzada. Sigue sola; puedes cerrar la terminal."
  else
    echo "✗ La cola no ha arrancado. Mira .tasks/logs/cola-nohup.log" >&2
    tail -n 20 .tasks/logs/cola-nohup.log >&2
    return 1
  fi
}

parar() {
  local pid sid
  pid="$(pid_cola)"
  if [[ -z "$pid" ]]; then echo "✓ La cola ya estaba parada."; return 0; fi
  # cola.sh se lanza con setsid: todo lo que arranca (OpenCode, pruebas…)
  # está en su sesión, aunque `timeout` lo meta en otro grupo.
  sid="$(ps -o sid= -p "$pid" | tr -d ' ')"
  pkill -TERM -s "$sid" 2>/dev/null || true
  sleep 3
  pkill -KILL -s "$sid" 2>/dev/null || true
  echo "■ Cola parada. La tarea que estuviera en curso se recupera al continuar."
}

instalar() {
  mkdir -p "$UNIDAD_DIR"
  cat > "$UNIDAD_DIR/$UNIDAD" <<EOF
[Unit]
Description=Planificador: retomar la cola de MiniMax al iniciar sesión
After=default.target network-online.target

[Service]
Type=oneshot
# Sin esto, al acabar continuar.sh systemd mataría la cola que ha
# lanzado (setsid no la saca del cgroup del servicio).
RemainAfterExit=yes
KillMode=process
WorkingDirectory=$ROOT
Environment=PATH=$PATH
ExecStart=/usr/bin/env bash $ROOT/tools/continuar.sh

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable "$UNIDAD"
  echo "✓ Al iniciar sesión se relanzará la cola si quedan tareas abiertas."
  echo "  Quitarlo: bash tools/continuar.sh --quitar-arranque"
}

desinstalar() {
  systemctl --user disable "$UNIDAD" 2>/dev/null || true
  rm -f "$UNIDAD_DIR/$UNIDAD"
  systemctl --user daemon-reload
  echo "✓ Ya no se relanza al iniciar sesión."
}

case "$MODO" in
  estado)      estado ;;
  parar)       parar ;;
  instalar)    instalar ;;
  desinstalar) desinstalar ;;
  continuar)   lanzar; rc=$?; echo; estado; exit $rc ;;
esac
