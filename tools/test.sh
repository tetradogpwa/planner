#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# test.sh — Pruebas del Planificador Semanal.
#
#   unit  Lógica de back/ con node:test (sin DOM ni dependencias).
#   e2e   La app REAL: compila el binario de Tauri y lo maneja con
#         WebdriverIO + tauri-driver dentro de un Wayland invisible
#         (weston sin pantalla) o, si se pide, de un Xvfb.
#
#   check Lo que NO es una prueba pero tiene que estar bien antes de
#         probar nada: `node --check` de todo el JavaScript y
#         `cargo test` + `cargo clippy` de la capa nativa.
# ─────────────────────────────────────────────────────────────────────
# Uso:
#   bash tools/test.sh                    → unit + check + e2e
#   bash tools/test.sh unit               → solo unitarias (segundos)
#   bash tools/test.sh check              → solo sintaxis y Rust
#   bash tools/test.sh e2e                → solo E2E
#   bash tools/test.sh e2e --spec tests/e2e/specs/00-arranque.spec.mjs
#   bash tools/test.sh --help
#   PLANNER_E2E_DISPLAY=x11 bash tools/test.sh e2e   → E2E en Xvfb
#
# La salida completa va a logs/test-<objetivo>-<fecha>-<pid>.log
# (ignorada por git); por pantalla solo sale el resumen y los fallos.
# PLANNER_LOG_DIR cambia la carpeta de los logs y PLANNER_LOG_KEPT
# cuántos se conservan.
#
# Garantías del script (T-039):
#   * Comprueba la versión de Node ANTES de nada: el glob entrecomillado
#     'tests/unit/*.test.mjs' solo lo expande Node desde la v22, y con
#     una versión menor el script se saldría en verde sin ejecutar
#     ninguna prueba.
#   * Si no se ha ejecutado ninguna prueba, el script sale con código
#     distinto de cero (nunca en verde porno haber corrido nada).
#   * Muestra la cobertura de las unitarias.
#   * Un E2E que falla deja capturas y trazas en tests/e2e/.tmp/.
#   * Poda logs/: conserva los N últimos ficheros (PLANNER_LOG_KEPT).
#   * Cada vuelta tiene su propio log (el nombre lleva el PID): dos
#     ejecuciones en el mismo segundo no se pisan el fichero.
#
# Garantías de los E2E:
#   * La ventana se abre en segundo plano, nunca en el escritorio:
#     por defecto en un weston sin pantalla (--backend=headless) con
#     su propio socket Wayland; con PLANNER_E2E_DISPLAY=x11, en un
#     Xvfb. En ambos casos se apunta GTK solo a ese servidor (el
#     WAYLAND_DISPLAY del escritorio no llega a la app).
#   * Datos aislados en tests/e2e/.tmp/ (XDG_DATA_HOME): nunca se tocan
#     las tareas reales del usuario. Cada spec empieza con datos vacíos.
#   * Binario propio en src-tauri/target-e2e/, compilado sin anuncios
#     (no aparece la pantalla de consentimiento). El build lleva
#     ALLOW_NO_ADS=1: sin claves de anuncios, el build falla salvo que
#     se pida explícitamente (T-034).
#   * Puerto propio (4446) para no chocar con otros proyectos. El
#     puerto del MCP (41237) también se comprueba: si está ocupado, la
#     app de los E2E no podría arrancar su servidor MCP y las pruebas
#     de MCP pasarían por un motivo equivocado.
#
# Requisitos de los E2E (el script dice qué falta):
#   sudo apt install -y weston webkit2gtk-driver   (xvfb si usas x11)
#   cargo install tauri-driver --version "2.1.0" --locked
#   cargo install tauri-cli --version "2.12.3" --locked
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
# Puerto del servidor MCP local (el de por defecto de la app). Si está
# ocupado, los E2E no podrían arrancar el MCP y las pruebas de MCP
# medirían el Occupied error (o el timeout) en vez de la app.
MCP_PORT=41237
E2E_TARGET_DIR="$ROOT/src-tauri/target-e2e"
E2E_BIN="$E2E_TARGET_DIR/debug/planner"
E2E_TMP="$ROOT/tests/e2e/.tmp"
# wayland (weston sin pantalla, por defecto) o x11 (Xvfb).
E2E_DISPLAY="${PLANNER_E2E_DISPLAY:-wayland}"
# Cuántos logs se conservan en logs/ (los más antiguos se borran).
LOG_KEPT="${PLANNER_LOG_KEPT:-20}"
# Dónde se escriben los logs. PLANNER_LOG_DIR permite apartarlos (las
# pruebas de este propio script lancan Copies en un directorio
# temporal, para no dejar rastro en logs/ del repositorio).
LOG_DIR="${PLANNER_LOG_DIR:-$ROOT/logs}"
# Versión mínima de Node: el glob entrecomillado de `node --test` solo
# lo expande Node desde la v22.
NODE_MIN=22

# ─────────────── Versión de Node ─────────────────────────────────────
# El glob entrecomillado 'tests/unit/*.test.mjs' solo lo expande Node
# desde la v22. Con una versión menor, `node --test` no encuentra
# ninguna prueba y sale con código 0: el script se iría en verde sin
# haber ejecutado nada. Por eso la versión se comprueba ANTES de nada.
check_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "✗ Node no está instalado." >&2
    echo "  Instálalo con Node $NODE_MIN o superior: https://nodejs.org/es/download" >&2
    echo "  (alternativa: nvm install $NODE_MIN)" >&2
    return 1
  fi

  local crude version major
  crude="$(node --version 2>/dev/null)"   # p. ej. v22.23.3
  version="${crude#v}"
  major="${version%%.*}"

  if [[ ! "$major" =~ ^[0-9]+$ ]]; then
    echo "✗ No se pudo leer la versión de Node (salió: '$crude')." >&2
    return 1
  fi

  if (( major < NODE_MIN )); then
    echo "✗ Node $NODE_MIN o superior es necesario, y tienes $crude." >&2
    echo "  Motivo: 'node --test \"tests/unit/*.test.mjs\"' solo expande el" >&2
    echo "  glob a partir de Node $NODE_MIN; con una versión menor el" >&2
    echo "  script se saldría en verde sin ejecutar ninguna prueba." >&2
    echo "  Solución: instala Node $NODE_MIN o superior." >&2
    echo "    nvm install $NODE_MIN && nvm use $NODE_MIN" >&2
    echo "    o descárgalo de https://nodejs.org/es/download" >&2
    return 1
  fi

  echo "✓ Node $crude (mínimo $NODE_MIN)"
  return 0
}

# ─────────────── Argumentos ──────────────────────────────────────────
TARGETS=()
SPEC=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    unit|e2e|check) TARGETS+=("$1") ;;
    all)      TARGETS+=(unit check e2e) ;;
    --spec)   shift; SPEC="${1:-}"
              [[ -f "$SPEC" ]] || { echo "✗ No existe la spec: $SPEC" >&2; exit 2; } ;;
    --help|-h)
      awk '/^#!/ {next} /^# ─+/ {next} /^#/ {sub(/^# ?/,""); print; next} {exit}' "$0"
      exit 0 ;;
    *) echo "✗ Argumento desconocido: $1 (usa --help)" >&2; exit 2 ;;
  esac
  shift
done
[[ ${#TARGETS[@]} -eq 0 ]] && TARGETS=(unit check e2e)
[[ -n "$SPEC" ]] && SPEC="$(cd "$(dirname "$SPEC")" && pwd)/$(basename "$SPEC")"

mkdir -p "$LOG_DIR"
# El sello lleva el PID: con solo los segundos, dos ejecuciones que
# empiecen en el mismo segundo (o una que lance a otra, como hacen las
# pruebas de este script) comparten el nombre del log y la segunda
# machaca el log de la primera con contenido que no le corresponde.
STAMP="$(date +%Y%m%d-%H%M%S)-$$"

# ─────────────── Poda de logs/ ───────────────────────────────────────
# logs/ acumula un fichero por ejecución. Sin poda, en unos meses son
# cientos de ficheros y ni se sabe cuál es el último. Se conservan los
# N más recientes (por fecha, en el nombre) y se borran los demás.
podar_logs() {
  local keep="$LOG_KEPT"
  [[ "$keep" =~ ^[0-9]+$ ]] || { echo "⚠ PLANNER_LOG_KEPT no es un número: no se poda $LOG_DIR"; return 0; }
  (( keep <= 0 )) && return 0

  local total
  total=$(find "$LOG_DIR" -maxdepth 1 -type f -name 'test-*.log' | wc -l)
  (( total <= keep )) && return 0

  # ls -1t ordena por fecha de modificación (de más nuevo a más viejo).
  local -a viejos
  mapfile -t viejos < <(ls -1t "$LOG_DIR"/test-*.log 2>/dev/null | tail -n "+$((keep + 1))")
  if (( ${#viejos[@]} > 0 )); then
    rm -f -- "${viejos[@]}"
    echo "▸ Poda de logs/: ${#viejos[@]} ficheros borrados (se conservan los $keep más recientes)"
  fi
  return 0
}

# ─────────────── Unitarias ───────────────────────────────────────────
run_unit() {
  # La cobertura se pide al propio runner de Node (v22+). Si el glob
  # no matchea ningún fichero, `node --test` sale con 0 y sin haber
  # ejecutado nada: por eso el recuento se comprueba después.
  node --test --experimental-test-coverage 'tests/unit/*.test.mjs'
}

summary_unit() {
  # El formato TAP: '# tests N', '# pass N', '# fail N'…
  grep -aE '^# (tests|pass|fail) ' "$1" | sed 's/^# /  /'
  # La tabla de cobertura (la imprime el runner al terminar).
  if grep -aq '^# start of coverage report' "$1"; then
    echo "  ── Cobertura:"
    sed -n '/^# start of coverage report/,/^# end of coverage report/p' "$1" \
      | sed -e 's/^# /  /' \
      | grep -avE '^\s*[-─]{2,}\s*$' \
      | grep -avE 'coverage report$' \
      | grep -avE '^\s*$' | head -80
  fi
}

failures_unit() {
  # Nombre de cada prueba fallida y las líneas de su error.
  grep -aE '^\s*not ok |^\s+(error|expected|actual|location):' "$1" | head -40
}

# ─────────────── Comprobaciones (sintaxis y Rust) ────────────────────
# Lo que no es una prueba pero tiene que estar bien antes de probar
# nada (T-039). Se ejecuta en un objetivo aparte para poder lanzarlo
# sin pagar el E2E, y también dentro de la suite completa.
check_js() {
  # `node --check` sobre TODO el JavaScript que se empaqueta en la app
  # y el de las pruebas y las herramientas. Se excluyen las carpetas
  # que no son código del proyecto: node_modules/ (dependencias),
  # dist/ (la copia del frontend que genera build.rs), releases/,
  # logs/, src-tauri/ (Rust) y .git/.
  local lista total
  lista=$(mktemp)
  find . \
    \( -name node_modules -o -name dist -o -name releases \
       -o -name logs -o -name src-tauri -o -name .git \) -prune \
    -o \( -name '*.js' -o -name '*.mjs' \) -print > "$lista"
  total=$(wc -l < "$lista")
  echo "▸ node --check: $total ficheros JavaScript"

  if [[ "$total" -lt 10 ]]; then
    echo "✗ La lista de ficheros sale demasiado corta ($total): el find está mal escrito" >&2
    rm -f "$lista"
    return 1
  fi

  # Un SOLO proceso de Node para toda la lista: `node --check` solo
  # acepta un fichero, y lanzar uno por fichero desde el shell (78
  # procesos a la vez) es lento y además se cuelga con el error
  # interno de Node "WeakRef: invalid target" cuando hay otros
  # procesos de Node compilando a la vez (p. ej. las unitarias).
  #
  # Aquí se lanza `node --check` de verdad (uno detrás de otro, sin
  # parallelism), pero desde un único proceso: así el fallo sale con
  # el nombre del fichero y su error.
  #
  # Los .js del frontend son MÓDULOS ES (se cargan con
  # <script type="module">), pero `node --check` los trata como
  # CommonJS: así no ve los errores propios de un módulo (un `import`
  # mal escrito, un `export` fuera de sitio...). Por eso cada .js se
  # copia a un .mjs temporal antes de comprobarlo: como módulo, los
  # errores salen.
  #
  # OJO: ni este proceso ni sus hijos pueden tener NODE_V8_COVERAGE.
  # Si lo tienen (p. ej. porque las unitarias corren con
  # --experimental-test-coverage en el mismo árbol), Node peta con
  # "WeakRef: invalid target" al escribir el perfil de cobertura y el
  # fichero parece inválido cuando no lo es.
  if ! env -u NODE_V8_COVERAGE -u NODE_OPTIONS node -e '
    const { spawnSync } = require("node:child_process");
    const { readFileSync, writeFileSync, mkdtempSync, rmSync } = require("node:fs");
    const { join } = require("node:path");
    const { tmpdir } = require("node:os");

    const ficheros = readFileSync(0, "utf8").split("\n").filter(Boolean);
    // Los hijos tampoco heredan el perfil de cobertura.
    const entorno = { ...process.env };
    delete entorno.NODE_V8_COVERAGE;
    delete entorno.NODE_OPTIONS;

    const temporal = mkdtempSync(join(tmpdir(), "planner-check-"));
    const fallos = [];
    for (const f of ficheros) {
      // Los .js se comprueban como módulo ES (copiados a un .mjs).
      let aComprobar = f;
      if (f.endsWith(".js")) {
        aComprobar = join(temporal, "modulo.mjs");
        writeFileSync(aComprobar, readFileSync(f, "utf8"), "utf8");
      }
      const r = spawnSync(process.execPath, ["--check", aComprobar], {
        encoding: "utf8", env: entorno,
      });
      if (r.status !== 0) {
        const salida = ((r.stderr || "") + (r.stdout || "")).trim();
        fallos.push(`${f}\n      ${salida.split("\n").slice(0, 4).join("\n      ")}`);
      }
    }
    rmSync(temporal, { recursive: true, force: true });

    if (fallos.length) {
      console.error("✗ Hay JavaScript que no compila:");
      for (const f of fallos) console.error("    " + f);
      process.exit(1);
    }
  ' < "$lista"; then
    echo "✗ Hay JavaScript que no compila (mira arriba: el fichero y el error)" >&2
    rm -f "$lista"
    return 1
  fi
  rm -f "$lista"
  echo "✓ node --check: $total ficheros compilan"
}

check_rust() {
  local ok=0
  if ! command -v cargo >/dev/null 2>&1; then
    echo "✗ Falta cargo (Rust): https://rustup.rs" >&2
    return 1
  fi

  echo "▸ cargo test"
  if ! cargo test --manifest-path src-tauri/Cargo.toml --locked; then
    echo "✗ cargo test falló" >&2
    ok=1
  fi

  echo "▸ cargo clippy"
  if ! cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings; then
    echo "✗ cargo clippy falló (los avisos se cuentan como errores)" >&2
    ok=1
  fi

  return $ok
}

run_check() {
  check_js || return 1
  check_rust || return 1
  return 0
}

summary_check() {
  grep -aE '^✓ |^✗ |^▸ |test result:|^running [0-9]+ tests?' "$1" | head -40
  # Los ficheros que no compilan (los dice el comprobador, uno por
  # línea, con la ruta del repo delante).
  grep -aE '^\s+\./.*\.(js|mjs)$' "$1" | head -20
}

failures_check() {
  grep -anE '^error(\[|:)|^warning:|error\[E[0-9]+\]|^test .* FAILED|SyntaxError|^\s+\./.*\.(js|mjs)$' "$1" | head -40
}

# ─────────────── E2E ────────────────────────────────────────────────
TAURI_DRIVER="$(command -v tauri-driver || echo "$HOME/.cargo/bin/tauri-driver")"

check_e2e_reqs() {
  local ok=0
  case "$E2E_DISPLAY" in
    wayland) command -v weston   >/dev/null || { echo "✗ Falta weston → sudo apt install -y weston (o PLANNER_E2E_DISPLAY=x11)"; ok=1; } ;;
    x11)     command -v xvfb-run >/dev/null || { echo "✗ Falta xvfb-run → sudo apt install -y xvfb"; ok=1; } ;;
    *)       echo "✗ PLANNER_E2E_DISPLAY debe ser wayland o x11 (es \"$E2E_DISPLAY\")"; ok=1 ;;
  esac
  command -v WebKitWebDriver >/dev/null || { echo "✗ Falta WebKitWebDriver → sudo apt install -y webkit2gtk-driver"; ok=1; }
  [[ -x "$TAURI_DRIVER" ]]              || { echo "✗ Falta tauri-driver → cargo install tauri-driver --version '2.1.0' --locked"; ok=1; }
  cargo tauri --version >/dev/null 2>&1 || { echo "✗ Falta cargo-tauri → cargo install tauri-cli --version '2.12.3' --locked"; ok=1; }
  if (exec 3<>/dev/tcp/127.0.0.1/$E2E_PORT) 2>/dev/null; then
    echo "✗ El puerto $E2E_PORT está ocupado (¿otra ejecución de los E2E?)"; ok=1
  fi
  # El puerto del MCP local también importa: la app de los E2E arranca
  # su servidor MCP en el 41237, y si el puerto está ocupado por otra
  # cosa (o por la app real del usuario) el MCP no arranca y las
  # pruebas de MCP medirían ese fallo en vez de la app.
  if (exec 3<>/dev/tcp/127.0.0.1/$MCP_PORT) 2>/dev/null; then
    echo "✗ El puerto $MCP_PORT (MCP) está ocupado: cierra la app del Planificador"; ok=1
    echo "  (o el servidor MCP que lo esté usando) y vuelve a intentarlo."
  fi
  return $ok
}

run_e2e() {
  # Las capturas de la vuelta anterior no se cuentan: se borran antes
  # de nada, para que el resumen no liste las de un fallo viejo.
  rm -rf "$E2E_TMP/capturas"

  check_e2e_reqs || return 1

  if [[ ! -d tests/e2e/node_modules ]]; then
    echo "▸ Instalando dependencias de tests/e2e (solo la primera vez)"
    (cd tests/e2e && npm ci --no-audit --no-fund) || return 1
  fi

  echo "▸ Compilando el binario de pruebas (debug, sin anuncios)"
  # Variables vacías: build.rs da prioridad al entorno sobre .env, así
  # que el binario de pruebas no lleva claves de anuncios.
  # ALLOW_NO_ADS=1: el build falla si no hay claves de anuncios y no se
  # pide explícitamente (T-034). Las pruebas son una de esas builds.
  GOOGLE_ADSENSE_CLIENT= GOOGLE_ADSENSE_SLOT= \
  GOOGLE_ADMOB_APP_ID= GOOGLE_ADMOB_BANNER_ID= GOOGLE_ADMOB_INTERSTITIAL_ID= \
  ALLOW_NO_ADS=1 \
  CARGO_TARGET_DIR="$E2E_TARGET_DIR" \
    cargo tauri build --debug --no-bundle -- --locked || return 1
  [[ -x "$E2E_BIN" ]] || { echo "✗ No se encontró el binario $E2E_BIN"; return 1; }

  # El guard de build: sin claves de anuncios y sin ALLOW_NO_ADS=1, el
  # build tiene que FALLAR y decir qué hacer; y con claves, no puede
  # imprimir sus valores. Se comprueba con el propio build script.
  check_guard_de_build || return 1

  # Datos, configuración y caché aislados de los del usuario.
  rm -rf "$E2E_TMP"
  export XDG_DATA_HOME="$E2E_TMP/datos"
  export XDG_CONFIG_HOME="$E2E_TMP/config"
  export XDG_CACHE_HOME="$E2E_TMP/cache"
  mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"
  # Lo que exportan las pruebas (JSON, PDF) va a .tmp/descargas, no a
  # la raíz del repo ni a la carpeta Descargas del usuario.
  E2E_DESCARGAS="$E2E_TMP/descargas"
  mkdir -p "$E2E_DESCARGAS"
  echo "XDG_DOWNLOAD_DIR=\"$E2E_DESCARGAS\"" > "$XDG_CONFIG_HOME/user-dirs.dirs"

  export PLANNER_E2E_BIN="$E2E_BIN"
  export PLANNER_E2E_DATOS="$XDG_DATA_HOME"
  export PLANNER_E2E_PORT="$E2E_PORT"
  export TAURI_DRIVER E2E_PORT E2E_NATIVE_PORT SPEC

  # Lo que corre dentro del servidor gráfico invisible.
  local inner='
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

  if [[ "$E2E_DISPLAY" == x11 ]]; then
    # Solo el Xvfb: con Wayland, GTK abriría la ventana en el escritorio.
    unset WAYLAND_DISPLAY WAYLAND_SOCKET
    export GDK_BACKEND=x11 XDG_SESSION_TYPE=x11
    echo "▸ Ejecutando WebdriverIO en Xvfb (tauri-driver en el puerto $E2E_PORT)"
    xvfb-run -a --server-args='-screen 0 1280x800x24' bash -c "$inner"
  else
    run_in_weston "$inner"
  fi
}

# Arranca un weston sin pantalla con un socket propio, ejecuta $1
# dentro de él y lo cierra al terminar. Nada se ve en el escritorio.
run_in_weston() {
  local sock="planner-e2e-$$"
  local wlog="$E2E_TMP/weston.log"
  : "${XDG_RUNTIME_DIR:=/run/user/$(id -u)}"
  export XDG_RUNTIME_DIR

  # Sin X ni el Wayland del escritorio: solo el socket de este weston.
  unset DISPLAY WAYLAND_SOCKET
  WAYLAND_DISPLAY= weston --backend=headless --renderer=pixman --no-config \
    --socket="$sock" --width=1280 --height=800 --idle-time=0 \
    >"$wlog" 2>&1 &
  local wpid=$!

  local i
  for i in $(seq 50); do
    [[ -S "$XDG_RUNTIME_DIR/$sock" ]] && break
    kill -0 "$wpid" 2>/dev/null || break
    sleep 0.1
  done
  if [[ ! -S "$XDG_RUNTIME_DIR/$sock" ]]; then
    echo "✗ weston no arrancó (log en $wlog):"; sed 's/^/    /' "$wlog" | tail -20
    kill "$wpid" 2>/dev/null
    return 1
  fi

  echo "▸ Ejecutando WebdriverIO en un Wayland invisible (weston, socket $sock; tauri-driver en el puerto $E2E_PORT)"
  local rc
  WAYLAND_DISPLAY="$sock" GDK_BACKEND=wayland XDG_SESSION_TYPE=wayland \
    bash -c "$1"
  rc=$?
  kill "$wpid" 2>/dev/null
  wait "$wpid" 2>/dev/null
  return $rc
}

# ── Guard de build (T-034) ───────────────────────────────────────────
# Sin claves de anuncios y sin ALLOW_NO_ADS=1, el build tiene que
# FALLAR: si no, se podría publicar una app sin monetizar (y en Android
# con el App ID de prueba de Google) sin que nadie se entere.
#
# Y con claves, el build NO puede imprimir sus valores: solo el nombre
# de cada variable (los valores no son secretos, pero tampoco tienen
# por qué enseñarse en el log).
#
# Las dos cosas se comprueban con el propio build script del proyecto:
# se ejecuta con un CARGO_MANIFEST_DIR de mentira, para que no encuentre
# el .env de la raíz ni herede las variables de anuncios del entorno.
check_guard_de_build() {
  # El binario del build script lo deja cargo en target/<perfil>/build/.
  # Se busca con find (y no con un glob fijo) porque el nombre lleva un
  # hash que cambia con cada versión de build.rs, y el layout puede
  # variar entre versiones de cargo.
  local script
  script=$(find "$E2E_TARGET_DIR" -path '*/build/planner-*/build-script-build' \
             -type f 2>/dev/null | head -1)

  if [[ -n "$script" && ! -x "$script" ]]; then
    echo "⚠ El build script $script no es ejecutable: no se comprueba el guard" >&2
    return 0
  fi

  if [[ -z "$script" ]]; then
    # Sin el binario no se puede comprobar el guard. NO es un fallo de
    # las pruebas: se avisa y se sigue (el E2E es lo importante). Con
    # el listado de lo que hay, si el layout cambia otra vez se ve.
    echo "⚠ No se encontró el binario del build script en $E2E_TARGET_DIR" >&2
    echo "  (no se puede comprobar el guard de claves de anuncios)" >&2
    ls -la "$E2E_TARGET_DIR"/debug/build/ 2>/dev/null | head -20 >&2
    return 0
  fi
  echo "▸ Comprobando el guard de claves de anuncios con $script"

  local tmp salida rc
  tmp=$(mktemp -d)
  mkdir -p "$tmp/out"

  # 1. Sin claves y sin ALLOW_NO_ADS: el build tiene que fallar y
  #    decir qué hacer.
  salida=$(
    env -u ALLOW_NO_ADS \
        -u GOOGLE_ADSENSE_CLIENT -u GOOGLE_ADSENSE_SLOT \
        -u GOOGLE_ADMOB_APP_ID -u GOOGLE_ADMOB_BANNER_ID \
        -u GOOGLE_ADMOB_INTERSTITIAL_ID \
        CARGO_MANIFEST_DIR="$tmp/src-tauri" OUT_DIR="$tmp/out" \
        "$script" 2>&1
  )
  rc=$?

  if [[ "$rc" -eq 0 ]]; then
    echo "✗ El build sin claves de anuncios NO falló: una build publicable" >&2
    echo "  podría salir sin monetizar y sin aviso." >&2
    rm -rf "$tmp"
    return 1
  fi
  # El fallo tiene que ser el del guard (no cualquier otro error) y
  # tiene que decir cómo arreglarlo.
  if ! grep -q "no tiene claves de anuncios" <<<"$salida"; then
    echo "✗ El build no falló por falta de claves de anuncios:" >&2
    sed 's/^/    /' <<<"$salida" >&2
    rm -rf "$tmp"
    return 1
  fi
  if ! grep -q "ALLOW_NO_ADS" <<<"$salida"; then
    echo "✗ El build falló, pero el error no dice cómo arreglarlo:" >&2
    sed 's/^/    /' <<<"$salida" >&2
    rm -rf "$tmp"
    return 1
  fi
  echo "✓ Sin claves de anuncios y sin ALLOW_NO_ADS=1, el build falla y lo explica"

  # 1b. Con PROFILE=debug (lo que ve `cargo check` y `cargo build
  #     --debug`): el build NO puede fallar. Si fallara, un clon
  #     limpio sin `.env` no compilaria y el flujo de trabajo de
  #     desarrollo se romperia.
  salida=$(
    env -u ALLOW_NO_ADS \
        -u GOOGLE_ADSENSE_CLIENT -u GOOGLE_ADSENSE_SLOT \
        -u GOOGLE_ADMOB_APP_ID -u GOOGLE_ADMOB_BANNER_ID \
        -u GOOGLE_ADMOB_INTERSTITIAL_ID \
        PROFILE=debug \
        CARGO_MANIFEST_DIR="$tmp/src-tauri" OUT_DIR="$tmp/out" \
        "$script" 2>&1
  )
  # Ojo: el script se ejecuta con un CARGO_MANIFEST_DIR de mentira, así
  # que al final falla al buscar el Cargo.toml real. Lo que no puede
  # pasar es que falle POR EL GUARD: en depuración no se exigen claves.
  if grep -q "no tiene claves de anuncios" <<<"$salida"; then
    echo "✗ El build de depuración (PROFILE=debug) exigió claves de anuncios:" >&2
    echo "  en un clon limpio sin .env, `cargo check` tiene que funcionar." >&2
    sed 's/^/    /' <<<"$salida" >&2
    rm -rf "$tmp"
    return 1
  fi
  echo "✓ El build de depuración (cargo check) no exige claves de anuncios"

  # 2. Con claves: el guard deja pasar y el log NO enseña sus valores.
  salida=$(
    env -u ALLOW_NO_ADS \
        GOOGLE_ADSENSE_CLIENT=ca-pub-PRUEBA000000000000 \
        GOOGLE_ADSENSE_SLOT=9999999999 \
        CARGO_MANIFEST_DIR="$tmp/src-tauri" OUT_DIR="$tmp/out" \
        "$script" 2>&1
  )
  rm -rf "$tmp"

  if grep -q "no tiene claves de anuncios" <<<"$salida"; then
    echo "✗ El build con claves de anuncios no pasó el guard:" >&2
    sed 's/^/    /' <<<"$salida" >&2
    return 1
  fi
  if grep -qE "ca-pub-PRUEBA000000000000|9999999999" <<<"$salida"; then
    echo "✗ El build imprimió el valor de una variable de anuncios:" >&2
    sed 's/^/    /' <<<"$salida" >&2
    return 1
  fi
  if ! grep -q "GOOGLE_ADSENSE_CLIENT" <<<"$salida"; then
    echo "✗ El build no dijo ni el nombre de las variables de anuncios:" >&2
    sed 's/^/    /' <<<"$salida" >&2
    return 1
  fi
  echo "✓ Con claves de anuncios, el build dice solo el nombre de las variables"
  return 0
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

# Las capturas y las trazas de las pruebas que fallaron (T-039).
resumen_capturas() {
  local dir="$ROOT/tests/e2e/.tmp/capturas"
  [[ -d "$dir" ]] || return 0
  local -a ficheros
  mapfile -t ficheros < <(find "$dir" -maxdepth 1 -type f \( -name '*.png' -o -name '*.traza.txt' \) | sort)
  (( ${#ficheros[@]} == 0 )) && return 0
  echo "  ── Capturas y trazas de las pruebas que fallaron:"
  for f in "${ficheros[@]}"; do
    echo "    ${f#"$ROOT/"}"
  done
}

# ─────────────── Ejecución ──────────────────────────────────────────
declare -a NAMES=() CODES=() LOGS=()

# La versión de Node se comprueba antes de ejecutar nada: con una
# versión anterior a la 22 el glob entrecomillado no se expande, no se
# ejecuta ninguna prueba y el script saldría en verde.
check_node || exit 2

for t in "${TARGETS[@]}"; do
  log="$LOG_DIR/test-${t}-${STAMP}.log"
  echo "════ Pruebas: $t"
  "run_$t" >"$log" 2>&1
  rc=$?
  NAMES+=("$t"); CODES+=("$rc"); LOGS+=("$log")
  "summary_$t" "$log"
  if [[ $rc -ne 0 ]]; then
    echo "  ── Fallos (primeras líneas; el resto en el log):"
    "failures_$t" "$log" | sed 's/^/    /'
    # Las capturas y trazas de un E2E que falla (T-039).
    [[ "$t" == e2e ]] && resumen_capturas
  fi
  echo ""
done

# ── ¿Se ha ejecutado alguna prueba? ────────────────────────────────
# Si el glob de las unitarias no matchea ningún fichero, `node --test`
# sale con 0 y el script se iría en verde sin haber probado nada. Por
# eso se comprueba el recuento que dice el propio runner: si no se ha
# ejecutado ni una prueba, el script sale con código ≠ 0.
#
# Los objetivos que fallan en esta comprobación se apuntan en
# OBJETIVOS_SIN_PRUEBAS, para que el resumen los marque en rojo (y no
# como un verde con un "0 pruebas" debajo).
OBJETIVOS_SIN_PRUEBAS=()

comprobar_pruebas_ejecutadas() {
  local fallo=0

  for i in "${!NAMES[@]}"; do
    local t="${NAMES[$i]}" log="${LOGS[$i]}"

    case "$t" in
      unit)
        # '# tests N' es el recuento del runner (TAP). Con N = 0 no se
        # ejecutó ninguna prueba.
        local ejecutadas
        ejecutadas=$(grep -aoE '^# tests [0-9]+' "$log" | tail -1 | grep -oE '[0-9]+$')
        if [[ -z "$ejecutadas" ]]; then
          echo "✗ No se pudo leer el recuento de pruebas unitarias del log." >&2
          echo "  Si el glob 'tests/unit/*.test.mjs' no matchea nada, el" >&2
          echo "  runner no ejecuta nada y sale con 0: eso NO es un verde." >&2
          fallo=1
        elif [[ "$ejecutadas" -eq 0 ]]; then
          echo "✗ No se ejecutó ninguna prueba unitaria (el glob no matchea ficheros)." >&2
          echo "  Comprueba que tests/unit/ tiene tests .test.mjs." >&2
          fallo=1
        fi
        ;;
      e2e)
        # El runner de WebdriverIO imprime su propio resumen: "N
        # passing" SOLO si hay pruebas que pasan y "N failing" solo si
        # hay alguna que falla. Buscar únicamente "N passing" haría que
        # un E2E que falla (y en el log solo queda "1 failing") pareciera
        # que no se ejecutó ninguna prueba: eso es un diagnóstico falso.
        local pasando fallando ejecutadas
        pasando=$(grep -aoE '[0-9]+ passing' "$log" | tail -1 | grep -oE '[0-9]+')
        fallando=$(grep -aoE '[0-9]+ failing' "$log" | tail -1 | grep -oE '[0-9]+')
        ejecutadas=$(( ${pasando:-0} + ${fallando:-0} ))
        if [[ "$ejecutadas" -eq 0 ]]; then
          echo "✗ No se encontró el recuento de pruebas E2E en el log." >&2
          echo "  Si no se ejecutó ninguna prueba, el script no puede salir en verde." >&2
          fallo=1
        elif [[ "${fallando:-0}" -gt 0 ]]; then
          # Sí se ejecutaron pruebas y algunas fallaron: el fallo ya lo
          # marca el código de salida del objetivo; aquí solo se dice la
          # verdad (no es el caso de "no se ejecutó ninguna prueba").
          echo "✗ Se ejecutaron $ejecutadas pruebas E2E y $fallando fallaron." >&2
        fi
        ;;
      check)
        # Las comprobaciones no son pruebas: si no llegaron a ejecutarse
        # (falta cargo, p. ej.), tampoco pueden salir en verde.
        if ! grep -aq '^✓ node --check' "$log"; then
          echo "✗ Las comprobaciones de sintaxis (node --check) no llegaron a ejecutarse." >&2
          fallo=1
        fi
        if ! grep -aq 'cargo test' "$log"; then
          echo "✗ cargo test no llegó a ejecutarse." >&2
          fallo=1
        fi
        if ! grep -aq 'cargo clippy' "$log"; then
          echo "✗ cargo clippy no llegó a ejecutarse." >&2
          fallo=1
        fi
        ;;
    esac

    # Si este objetivo no ha ejecutado nada, se marca como fallido.
    if [[ $fallo -ne 0 ]]; then
      OBJETIVOS_SIN_PRUEBAS+=("$t")
      fallo=0
    fi
  done

  # Si la comprobación dejó algún objetivo sin pruebas, se falla.
  (( ${#OBJETIVOS_SIN_PRUEBAS[@]} > 0 )) && return 1
  return 0
}

any_fail=0
if ! comprobar_pruebas_ejecutadas; then
  any_fail=1
fi
for i in "${!NAMES[@]}"; do
  if [[ "${CODES[$i]}" -ne 0 ]]; then any_fail=1; fi
done

# Poda de logs/: se conservan los N más recientes.
podar_logs

echo "════ Resumen"
for i in "${!NAMES[@]}"; do
  mark="✓"
  if [[ "${CODES[$i]}" -ne 0 ]]; then
    mark="✗"
  else
    # Un objetivo que no ha ejecutado ninguna prueba tampoco es un
    # verde: se marca en rojo aunque su código sea 0.
    for sin in "${OBJETIVOS_SIN_PRUEBAS[@]:-}"; do
      [[ "$sin" == "${NAMES[$i]}" ]] && mark="✗"
    done
  fi
  printf "  %s  %-5s  código %s · log: %s\n" "$mark" "${NAMES[$i]}" "${CODES[$i]}" "${LOGS[$i]#"$ROOT"/}"
done
exit "$any_fail"
