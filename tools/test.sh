#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# test.sh — Pruebas del Planificador Semanal.
#
#   unit  Lógica de back/ con node:test (sin DOM ni dependencias).
#   e2e   La app REAL: compila el binario de Tauri y lo maneja con
#         WebdriverIO + tauri-driver dentro de un Xvfb invisible.
# ─────────────────────────────────────────────────────────────────────
# Uso:
#   bash tools/test.sh                    → unit + e2e
#   bash tools/test.sh unit               → solo unitarias (segundos)
#   bash tools/test.sh e2e                → solo E2E
#   bash tools/test.sh e2e --spec tests/e2e/specs/00-arranque.spec.mjs
#   bash tools/test.sh --help
#
# La salida completa va a logs/test-<objetivo>-<fecha>.log (ignorada
# por git); por pantalla solo sale el resumen y los fallos.
#
# Garantías de los E2E:
#   * La ventana se abre solo en el Xvfb: se quita el acceso a Wayland,
#     que en otro caso la mostraría en el escritorio y robaría el foco.
#   * Datos aislados en tests/e2e/.tmp/ (XDG_DATA_HOME): nunca se tocan
#     las tareas reales del usuario. Cada spec empieza con datos vacíos.
#   * Binario propio en src-tauri/target-e2e/, compilado sin anuncios
#     (no aparece la pantalla de consentimiento).
#   * Puerto propio (4446) para no chocar con otros proyectos.
#
# Requisitos de los E2E (el script dice qué falta):
#   sudo apt install -y xvfb webkit2gtk-driver
#   cargo install tauri-driver --locked
#   cargo install tauri-cli --version "^2.0" --locked
# Las dependencias npm de tests/e2e/ se instalan solas la primera vez.
# ─────────────────────────────────────────────────────────────────────
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Zona horaria fija para que las fechas den lo mismo en cualquier
# máquina; Madrid porque tiene cambio de hora (detecta fallos de DST).
export TZ="${PLANNER_TEST_TZ:-Europe/Madrid}"

E2E_PORT=4446
E2E_NATIVE_PORT=4447
E2E_TARGET_DIR="$ROOT/src-tauri/target-e2e"
E2E_BIN="$E2E_TARGET_DIR/debug/planner"
E2E_TMP="$ROOT/tests/e2e/.tmp"

# ─────────────── Argumentos ──────────────────────────────────────────
TARGETS=()
SPEC=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    unit|e2e) TARGETS+=("$1") ;;
    all)      TARGETS+=(unit e2e) ;;
    --spec)   shift; SPEC="${1:-}"
              [[ -f "$SPEC" ]] || { echo "✗ No existe la spec: $SPEC" >&2; exit 2; } ;;
    --help|-h)
      awk '/^#!/ {next} /^# ─+/ {next} /^#/ {sub(/^# ?/,""); print; next} {exit}' "$0"
      exit 0 ;;
    *) echo "✗ Argumento desconocido: $1 (usa --help)" >&2; exit 2 ;;
  esac
  shift
done
[[ ${#TARGETS[@]} -eq 0 ]] && TARGETS=(unit e2e)
[[ -n "$SPEC" ]] && SPEC="$(cd "$(dirname "$SPEC")" && pwd)/$(basename "$SPEC")"

mkdir -p logs
STAMP="$(date +%Y%m%d-%H%M%S)"

# ─────────────── Unitarias ───────────────────────────────────────────
run_unit() {
  node --test 'tests/unit/*.test.mjs'
}

summary_unit() {
  grep -aE '^# (tests|pass|fail) ' "$1" | sed 's/^# /  /'
}

failures_unit() {
  # Nombre de cada prueba fallida y las líneas de su error.
  grep -aE '^\s*not ok |^\s+(error|expected|actual|location):' "$1" | head -40
}

# ─────────────── E2E ────────────────────────────────────────────────
TAURI_DRIVER="$(command -v tauri-driver || echo "$HOME/.cargo/bin/tauri-driver")"

check_e2e_reqs() {
  local ok=0
  command -v xvfb-run        >/dev/null || { echo "✗ Falta xvfb-run → sudo apt install -y xvfb"; ok=1; }
  command -v WebKitWebDriver >/dev/null || { echo "✗ Falta WebKitWebDriver → sudo apt install -y webkit2gtk-driver"; ok=1; }
  [[ -x "$TAURI_DRIVER" ]]              || { echo "✗ Falta tauri-driver → cargo install tauri-driver --locked"; ok=1; }
  cargo tauri --version >/dev/null 2>&1 || { echo "✗ Falta cargo-tauri → cargo install tauri-cli --version \"^2.0\" --locked"; ok=1; }
  if (exec 3<>/dev/tcp/127.0.0.1/$E2E_PORT) 2>/dev/null; then
    echo "✗ El puerto $E2E_PORT está ocupado (¿otra ejecución de los E2E?)"; ok=1
  fi
  return $ok
}

run_e2e() {
  check_e2e_reqs || return 1

  if [[ ! -d tests/e2e/node_modules ]]; then
    echo "▸ Instalando dependencias de tests/e2e (solo la primera vez)"
    (cd tests/e2e && npm ci --no-audit --no-fund) || return 1
  fi

  echo "▸ Compilando el binario de pruebas (debug, sin anuncios)"
  # Variables vacías: build.rs da prioridad al entorno sobre .env, así
  # que el binario de pruebas no lleva claves de anuncios.
  GOOGLE_ADSENSE_CLIENT= GOOGLE_ADSENSE_SLOT= \
  GOOGLE_ADMOB_APP_ID= GOOGLE_ADMOB_BANNER_ID= GOOGLE_ADMOB_INTERSTITIAL_ID= \
  CARGO_TARGET_DIR="$E2E_TARGET_DIR" \
    cargo tauri build --debug --no-bundle || return 1
  [[ -x "$E2E_BIN" ]] || { echo "✗ No se encontró el binario $E2E_BIN"; return 1; }

  # Solo el Xvfb: sin Wayland, GTK abriría la ventana en el escritorio.
  unset WAYLAND_DISPLAY WAYLAND_SOCKET
  export GDK_BACKEND=x11 XDG_SESSION_TYPE=x11

  # Datos, configuración y caché aislados de los del usuario.
  rm -rf "$E2E_TMP"
  export XDG_DATA_HOME="$E2E_TMP/datos"
  export XDG_CONFIG_HOME="$E2E_TMP/config"
  export XDG_CACHE_HOME="$E2E_TMP/cache"
  mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

  export PLANNER_E2E_BIN="$E2E_BIN"
  export PLANNER_E2E_DATOS="$XDG_DATA_HOME"
  export PLANNER_E2E_PORT="$E2E_PORT"
  export TAURI_DRIVER E2E_PORT E2E_NATIVE_PORT SPEC

  echo "▸ Ejecutando WebdriverIO en Xvfb (tauri-driver en el puerto $E2E_PORT)"
  xvfb-run -a --server-args='-screen 0 1280x800x24' bash -c '
    "$TAURI_DRIVER" --port "$E2E_PORT" --native-port "$E2E_NATIVE_PORT" &
    TD_PID=$!
    trap "kill $TD_PID 2>/dev/null" EXIT
    for _ in $(seq 50); do
      (exec 3<>/dev/tcp/127.0.0.1/$E2E_PORT) 2>/dev/null && break
      sleep 0.2
    done
    cd tests/e2e
    if [[ -n "$SPEC" ]]; then
      npx wdio run wdio.conf.mjs --spec "$SPEC"
    else
      npx wdio run wdio.conf.mjs
    fi
  '
}

summary_e2e() {
  # Requisitos que faltan, cada prueba (✓/✖) y el total por archivo.
  grep -aE '^✗ |^\s*\[[^]]+\] +(»|✓|✖)|Spec Files:' "$1" \
    | sed -E 's/^\s*\[[^]]+\] +/  /' | head -80
}

failures_e2e() {
  # Errores de compilación y, de cada prueba fallida, su mensaje.
  grep -anE '^error(\[|:)|Error in "|^Error: |^(Expected|Received)|^[-+] |^\s+at .*\.spec\.mjs' "$1" | head -40
}

# ─────────────── Ejecución ──────────────────────────────────────────
declare -a NAMES=() CODES=() LOGS=()

for t in "${TARGETS[@]}"; do
  log="logs/test-${t}-${STAMP}.log"
  echo "════ Pruebas: $t"
  "run_$t" >"$log" 2>&1
  rc=$?
  NAMES+=("$t"); CODES+=("$rc"); LOGS+=("$log")
  "summary_$t" "$log"
  if [[ $rc -ne 0 ]]; then
    echo "  ── Fallos (primeras líneas; el resto en el log):"
    "failures_$t" "$log" | sed 's/^/    /'
  fi
  echo ""
done

echo "════ Resumen"
any_fail=0
for i in "${!NAMES[@]}"; do
  if [[ "${CODES[$i]}" -eq 0 ]]; then mark="✓"; else mark="✗"; any_fail=1; fi
  printf "  %s  %-5s  código %s · log: %s\n" "$mark" "${NAMES[$i]}" "${CODES[$i]}" "${LOGS[$i]}"
done
exit "$any_fail"
