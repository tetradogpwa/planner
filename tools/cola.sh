#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# cola.sh — Ciclo autónomo del Planificador Semanal.
#
# Recorre la cola de tareas (.tasks/tasks.json) y va sacando una a una
# las que están pendientes, hasta que no queda ninguna:
#
#   1. el TRABAJADOR (MiniMax en OpenCode) implementa la tarea y la deja
#      en revisión  →  tools/minimax/run-task.sh
#   2. el REVISOR comprueba los criterios de aceptación contra el diff
#      →  tools/minimax/revisar.sh
#   3. si el revisor aprueba: se pasan las pruebas y se hace el commit
#      ("T-0XX: título", solo con los ficheros de esa tarea) y la tarea
#      queda HECHA. Si no aprueba: la tarea vuelve al trabajador con las
#      correcciones (hasta --max-intentos veces).
#
# El script es independiente de la conversación: se puede lanzar
# desacoplado (setsid) y sigue trabajando aunque se cierre la sesión o
# se haga /clear. Todo el estado vive en .tasks/ y en git.
#
# Uso:
#   bash tools/cola.sh                    → todas las tareas pendientes
#   bash tools/cola.sh T-039              → solo esa tarea
#   bash tools/cola.sh --sin-revision     → solo implementar (sin revisar)
#   bash tools/cola.sh --max-tareas 1     → cerrar solo una tarea y parar
#   bash tools/cola.sh --check            → comprobar la configuración
#   bash tools/cola.sh --dry-run          → mostrar qué haría
#   bash tools/cola.sh --ayuda
#
# Nunca hace `git push`: los commits se quedan en la máquina.
# ────────────────────────────────────────────────────────────────────
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
TASKS="node $ROOT/tools/tasks/tasks.mjs"
STORE="$ROOT/.tasks/tasks.json"

SOLO_TAREA=""
SIN_REVISION=0
MAX_TAREAS=0        # 0 = todas
MAX_INTENTOS=4      # intentos por tarea
DRY=0
CHECK_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tarea)        shift; SOLO_TAREA="${1:-}" ;;
    --sin-revision) SIN_REVISION=1 ;;
    --max-tareas)   shift; MAX_TAREAS="${1:-0}" ;;
    --max-intentos) shift; MAX_INTENTOS="${1:-4}" ;;
    --dry-run)      DRY=1 ;;
    --check)        CHECK_ONLY=1 ;;
    --ayuda|-h)
      awk '/^#!/ {next} /^# ─+/ {next} /^#/ {sub(/^# ?/,""); print; next} {exit}' "$0"
      exit 0 ;;
    -*) echo "✗ Argumento desconocido: $1 (usa --ayuda)" >&2; exit 2 ;;
    *)  SOLO_TAREA="$1" ;;
  esac
  shift
done

mkdir -p .tasks/logs logs
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG=".tasks/logs/cola-$STAMP.log"
ESTADO=".tasks/logs/cola-$STAMP"     # fotos y diffs de este recorrido
mkdir -p "$ESTADO"

say() { echo "$*" | tee -a "$LOG"; }

# ── Utilidades sobre la cola ────────────────────────────────────────

listar() {  # listar <estado>
  node -e '
    const db = require(process.argv[1]);
    for (const t of db.tasks) if (t.status === process.argv[2]) console.log(t.id);
  ' "$STORE" "$1" 2>/dev/null
}

campo() {  # campo <id> <baseTree|title|attempts>
  node -e '
    const db = require(process.argv[1]);
    const t = db.tasks.find(x => x.id === process.argv[2]);
    if (!t) process.exit(0);
    process.stdout.write(String(t[process.argv[3]] ?? ""));
  ' "$STORE" "$1" "$2" 2>/dev/null
}

estado() {  # estado <id>
  node -e '
    const db = require(process.argv[1]);
    const t = db.tasks.find(x => x.id === process.argv[2]);
    process.stdout.write(t ? t.status : "");
  ' "$STORE" "$1" 2>/dev/null
}

# Árbol git del directorio de trabajo (como workingTree de tasks.mjs,
# pero sin tocar el índice del usuario).
arbol_actual() {
  local git_dir index
  git_dir="$(git rev-parse --absolute-git-dir)"
  index="$git_dir/tasks-index-cola-$$-${RANDOM}"
  rm -f "$index"
  GIT_INDEX_FILE="$index" git read-tree HEAD
  GIT_INDEX_FILE="$index" git add -A
  GIT_INDEX_FILE="$index" git write-tree
  rm -f "$index"
}

# Diff de un árbol a otro, sin .tasks/.
diff_entre() {
  git diff "$1" "$2" -- . ':(exclude).tasks'
}

# ── Comprobación de la configuración ────────────────────────────────

check_config() {
  local ok=0
  if ! command -v node >/dev/null; then echo "✗ Falta node"; ok=1; fi
  if ! command -v git  >/dev/null; then echo "✗ Falta git"; ok=1; fi
  local bin
  bin="$(command -v opencode || echo "$HOME/.opencode/bin/opencode")"
  if [[ -x "$bin" ]]; then
    echo "✓ OpenCode: $bin ($("$bin" --version 2>/dev/null))"
  else
    echo "✗ No encuentro OpenCode (pon OPENCODE_BIN en .env)"; ok=1
  fi
  grep -q '"planner-worker"'   opencode.json 2>/dev/null || { echo "✗ Falta el agente planner-worker en opencode.json"; ok=1; }
  grep -q '"planner-reviewer"' opencode.json 2>/dev/null || { echo "✗ Falta el agente planner-reviewer en opencode.json"; ok=1; }
  [[ -f "$ROOT/tools/minimax/run-task.sh" ]] || { echo "✗ Falta tools/minimax/run-task.sh"; ok=1; }
  [[ -f "$ROOT/tools/minimax/revisar.sh" ]] || { echo "✗ Falta tools/minimax/revisar.sh"; ok=1; }
  git config user.name  >/dev/null 2>&1 || { echo "✗ git config user.name no está puesto (los commits fallarán)"; ok=1; }
  git config user.email >/dev/null 2>&1 || { echo "✗ git config user.email no está puesto (los commits fallarán)"; ok=1; }
  local abiertas
  abiertas="$(listar pendiente; listar en_revision; listar en_curso)"
  if [[ -z "$abiertas" ]]; then echo "✓ No hay tareas abiertas: no hay nada que hacer"; else
    echo "✓ Tareas abiertas:"; sed 's/^/    /' <<<"$abiertas"
  fi
  return $ok
}

if [[ "$CHECK_ONLY" -eq 1 ]]; then check_config; exit $?; fi

# ── Recuperación: tareas en curso sin trabajador vivo ───────────────
# Si una sesión anterior murió a mitad de una tarea, esa tarea se queda
# en "en curso" para siempre. Si no hay ningún proceso run-task.sh
# trabajando en ella, se devuelve a la cola.

recuperar() {
  local id pid espera=0
  # Hasta que no quede ninguna tarea "en curso" sin trabajador vivo:
  # si no, run-task.sh se niega a empezar otra ("MiniMax ya está con
  # T-0XX") y la cola se queda bloqueada.
  while :; do
    id=""
    while read -r x; do
      [[ -n "$x" ]] && { id="$x"; break; }
    done < <(listar en_curso)
    [[ -z "$id" ]] && return 0

    pid="$(pgrep -f "minimax/run-task.sh $id" 2>/dev/null | head -1)"
    if [[ -n "$pid" ]]; then
      say "▸ [$id] hay un MiniMax trabajando (pid $pid): se espera."
      sleep 30
      espera=$((espera+1))
      if [[ "$espera" -gt 120 ]]; then
        say "✗ [$id] lleva demasiado tiempo en curso: se para aquí para que la mire una persona."
        return 1
      fi
      continue
    fi
    say "↻ [$id] estaba en curso sin nadie trabajando: vuelve a la cola."
    $TASKS status "$id" pendiente --note "Recuperada por cola.sh: no había ningún MiniMax trabajando en ella." >> "$LOG" 2>&1
  done
}

if [[ "$DRY" -eq 1 ]]; then
  say "▸ Simulación (no se ejecuta nada):"
  while read -r id; do
    [[ -z "$id" ]] && continue
    [[ -n "$SOLO_TAREA" && "$id" != "$SOLO_TAREA" ]] && continue
    say "   $id  $(campo "$id" title)"
    say "      1) bash tools/minimax/run-task.sh $id"
    [[ "$SIN_REVISION" -eq 0 ]] && say "      2) bash tools/minimax/revisar.sh $id"
    [[ "$SIN_REVISION" -eq 0 ]] && say "      3) bash tools/test.sh  &&  commit '$id: <título>'"
  done < <(listar pendiente; listar en_revision; listar en_curso)
  exit 0
fi

# ── El ciclo ────────────────────────────────────────────────────────

declare -A SALTAR=()          # tareas que agotaron sus intentos
declare -A INTENTOS=()        # intentos de trabajo por tarea (este recorrido)
CERRADAS=0
FALLIDAS=0

elegir() {  # elegir <estado> → id de la primera tarea de ese estado
  local id
  while read -r id; do
    [[ -z "$id" ]] && continue
    [[ -n "${SALTAR[$id]:-}" ]] && continue
    if [[ -n "$SOLO_TAREA" && "$id" != "$SOLO_TAREA" ]]; then continue; fi
    echo "$id"; return 0
  done < <(listar "$1")
  return 1
}

trabajar() {  # trabajar <id>
  local id="$1" salida
  # Cuántas veces ha trabajado el trabajador en esta tarea ESTE
  # recorrido (el contador de la cola no vale: lo incrementan otros
  # actores, como una sesión que empezó la tarea a mano).
  INTENTOS[$id]=$(( ${INTENTOS[$id]:-0} + 1 ))
  # La foto de partida es el ÚLTIMO COMMIT, no el árbol: así el diff de
  # la tarea y su commit incluyen todo lo que se haya hecho en ella,
  # aunque el trabajo empezara con cambios sin commitear de otra tarea.
  git rev-parse HEAD > "$ESTADO/$id.base"
  local sucios
  sucios="$(git status --porcelain | head -10)"
  if [[ -n "$sucios" ]]; then
    say "   ⚠ El árbol ya tenía cambios sin commitear; el diff de la tarea los incluye:"
    printf '     %s\n' "$sucios" | tee -a "$LOG"
  fi
  say "▸ [$id] MiniMax trabaja en la tarea (intento ${INTENTOS[$id]}/$MAX_INTENTOS)…"
  salida="$(bash tools/minimax/run-task.sh "$id" 2>&1)"
  echo "$salida" >> "$LOG"
  tail -n 3 <<<"$salida" | head -2 | sed 's/^/   /' | tee -a "$LOG"
  return 0
}

revisar() {  # revisar <id> → 0 si aprueba
  local id="$1" salida diff_fichero base actual
  diff_fichero="$ESTADO/$id.diff"
  base="$(cat "$ESTADO/$id.base" 2>/dev/null)"
  if [[ -n "$base" ]]; then
    # El diff de ESTA tarea: desde la foto que se hizo antes de que el
    # trabajador tocara nada hasta ahora.
    actual="$(arbol_actual)"
    diff_entre "$base" "$actual" > "$diff_fichero"
  else
    # Sin foto propia (trabajo hecho en otra sesión): el diff de la
    # tarea, desde su primer intento.
    $TASKS diff "$id" --total > "$diff_fichero" 2>/dev/null || true
  fi
  say "▸ [$id] Revisión automática…"
  salida="$(bash tools/minimax/revisar.sh "$id" --diff "$diff_fichero" 2>&1)"
  echo "$salida" >> "$LOG"
  if grep -qa 'VEREDICTO: APROBADO' <<<"$salida"; then
    say "   ✓ Aprobada"
    return 0
  fi
  if grep -qa 'no dio veredicto' <<<"$salida"; then
    # La revisión falló (no el trabajo): no se le devuelve la tarea al
    # trabajador, que no tiene nada que arreglar.
    say "   ✗ La revisión falló (no es un defecto del trabajo):"
    tail -n 6 <<<"$salida" | sed 's/^/     /' | tee -a "$LOG"
    return 2
  fi
  say "   ✗ Correcciones:"
  grep -aE '^CORRECCION:' <<<"$salida" | sed 's/^/     /' | tee -a "$LOG"
  return 1
}

aprobar_y_commitear() {  # aprobar_y_commitear <id>
  local id="$1" titulo base actual ficheros log_pruebas
  titulo="$(campo "$id" title)"
  log_pruebas="logs/test-cola-$id-$(date +%Y%m%d-%H%M%S).log"

  say "   ▸ Pasando las pruebas antes del commit…"
  if ! bash tools/test.sh > "$log_pruebas" 2>&1; then
    say "   ✗ Las pruebas NO pasan (log: $log_pruebas). La tarea vuelve al trabajador."
    tail -n 12 "$log_pruebas" | sed 's/^/     /' | tee -a "$LOG"
    return 1
  fi
  grep -aE '^  [✓✗]' "$log_pruebas" | sed 's/^/     /' | tee -a "$LOG"

  base="$(cat "$ESTADO/$id.base" 2>/dev/null)"
  [[ -z "$base" ]] && base="$(campo "$id" baseTree)"
  [[ -z "$base" ]] && { say "   ✗ La tarea no tiene foto del árbol: no se puede commitear"; return 1; }
  actual="$(arbol_actual)"
  mapfile -t ficheros < <(git diff --name-only "$base" "$actual" -- . ':(exclude).tasks')
  if [[ "${#ficheros[@]}" -eq 0 ]]; then
    say "   ✗ La tarea no ha cambiado ningún fichero: no hay nada que commitear"
    return 1
  fi
  say "   ▸ Commit: $id: $titulo"
  printf '     %s\n' "${ficheros[@]}" | tee -a "$LOG"
  # Los ficheros nuevos (los que aún no están en git) no se pueden
  # commitear con `git commit -- <fichero>`: hay que añadirlos antes.
  git add -A -- "${ficheros[@]}" >> "$LOG" 2>&1
  if ! git commit -q -m "$id: $titulo" -- "${ficheros[@]}" >> "$LOG" 2>&1; then
    say "   ✗ El commit falló (ver $LOG). La tarea vuelve al trabajador."
    return 2
  fi
  say "   ✓ Commit hecho: $(git rev-parse --short HEAD)"
  return 0
}

recuperar

while :; do
  # Red de seguridad: si alguien dejó una tarea en curso sin trabajador
  # (una sesión que murió), se devuelve a la cola antes de seguir.
  recuperar || break

  # 1) Tareas en revisión (trabajo hecho, sin revisar) o pendientes.
  id=""
  id="$(elegir en_revision)" || id=""
  [[ -z "$id" ]] && { id="$(elegir pendiente)" || id=""; }
  [[ -z "$id" ]] && break

  est="$(estado "$id")"
  if [[ "$est" == "pendiente" ]]; then
    if [[ "${INTENTOS[$id]:-0}" -ge "$MAX_INTENTOS" ]]; then
      say "✗ [$id] Agotó los intentos de este recorrido ($MAX_INTENTOS). Se deja pendiente para que la mire una persona."
      SALTAR["$id"]=1
      FALLIDAS=$((FALLIDAS+1))
      continue
    fi
    trabajar "$id"
    est="$(estado "$id")"
    if [[ "$est" == "pendiente" ]]; then
      # El trabajador falló: la tarea vuelve a la cola.
      say "↻ [$id] el trabajador falló; vuelve a la cola."
      continue
    fi
  fi

  # 2) Revisión.
  if [[ "$SIN_REVISION" -eq 1 ]]; then
    say "▸ [$id] Dejada en revisión (--sin-revision)."
    continue
  fi

  if revisar "$id"; then
    aprobar_y_commitear "$id"
    case $? in
      0)
        $TASKS status "$id" hecha --note "Aprobada por la revisión automática; pruebas en verde y commit hecho." >> "$LOG" 2>&1
        say "✓ [$id] HECHA"
        CERRADAS=$((CERRADAS+1))
        ;;
      2)
        $TASKS feedback "$id" --note "La revisión automática aprobó el trabajo, pero el commit falló (mira .tasks/logs/cola-*.log). Vuelve a hacer el cambio: el commit lo hace el script." >> "$LOG" 2>&1
        say "↻ [$id] devuelta al trabajador (el commit falló)"
        ;;
      *)
        $TASKS feedback "$id" --note "La revisión automática aprobó el trabajo, pero las pruebas no pasan (log en logs/). Corrige lo que fallen." >> "$LOG" 2>&1
        say "↻ [$id] devuelta al trabajador (las pruebas fallan)"
        ;;
    esac
  else
    case $? in
      2)
        # La revisión falló (no el trabajo): la tarea se queda en
        # revisión para que la mire una persona. Devolverla al
        # trabajador no ayudaría: no tiene nada que arreglar.
        say "↻ [$id] se queda en revisión: la revisión automática falló."
        ;;
      *)
        # Correcciones del revisor → vuelven al trabajador.
        correcciones="$(grep -ahE '^CORRECCION:' ".tasks/logs/${id}-revision-"*.log 2>/dev/null | tail -20 | sed 's/^CORRECCION: //')"
        [[ -z "$correcciones" ]] && correcciones="La revisión automática pidió correcciones (mira el registro en .tasks/logs/)."
        $TASKS feedback "$id" --note "$correcciones" >> "$LOG" 2>&1
        say "↻ [$id] devuelta al trabajador con correcciones"
        ;;
    esac
  fi

  if [[ "$MAX_TAREAS" -gt 0 && "$CERRADAS" -ge "$MAX_TAREAS" ]]; then
    say "▸ Límite de tareas alcanzado ($MAX_TAREAS)."
    break
  fi
done

say ""
say "════ Cola autónoma terminada"
say "  Tareas cerradas: $CERRADAS"
say "  Tareas con problemas: $FALLIDAS"
node tools/tasks/tasks.mjs list 2>/dev/null | sed 's/^/  /' | tee -a "$LOG"
[[ "$FALLIDAS" -eq 0 ]]
