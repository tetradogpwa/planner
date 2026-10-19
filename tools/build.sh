#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# build.sh — Script de build unificado para Planificador Semanal.
#            Por defecto genera solo el AppImage de Linux. Los
#            binarios se copian a releases/ (en la raíz, ignorada por
#            git).
# ─────────────────────────────────────────────────────────────────────
# Uso:
#   ./tools/build.sh                  → solo AppImage (Linux, release)
#   ./tools/build.sh linux            → igual que sin argumentos
#   ./tools/build.sh windows          → instalador NSIS (.exe, xwin)
#   ./tools/build.sh android          → APK de Android
#   ./tools/build.sh linux android    → varios objetivos a la vez
#   ./tools/build.sh all              → AppImage + .exe NSIS + APK
#   ./tools/build.sh all --debug      → los tres objetivos en debug
#   ./tools/build.sh --help           → muestra esta ayuda
#   (--all equivale a all, por compatibilidad)
#
# Requisitos generales (comunes a todos los objetivos):
#   * Rust toolchain estable (rustup.rs) y cargo-tauri:
#       cargo install tauri-cli --version "^2.0" --locked
#
# Requisitos para compilar el AppImage de Linux (build-linux.sh):
#   * Debian/Ubuntu: sudo apt install -y \
#       libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
#       librsvg2-dev libssl-dev libsoup-3.0-dev \
#       libjavascriptcoregtk-4.1-dev build-essential curl wget file \
#       pkg-config
#
# Requisitos para compilar el instalador NSIS de Windows desde Linux
# (compilación cruzada con cargo-xwin). El script lo detecta y, si
# falta algo, imprime exactamente qué instalar:
#   * cargo install --locked cargo-xwin
#   * rustup target add x86_64-pc-windows-msvc
#   * Debian/Ubuntu: sudo apt install -y nsis lld llvm clang
#       (lld-link, llvm-rc)
#
# Requisitos para compilar el APK de Android. El script lo detecta y,
# si falta algo, imprime exactamente qué instalar:
#   * SDK de Android (API 24+) y NDK r25+:
#       export ANDROID_HOME=~/Android/Sdk
#       export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/<version>
#   * Java 17 (Temurin o el de Android Studio).
#   * Targets de Android para rustup (los añade el propio script de
#     Tauri al hacer `cargo tauri android init`).
#   * Inicialización del módulo Android (solo la primera vez):
#       cargo tauri android init
#
# Variables de entorno:
#   .env (si existe) se carga automáticamente para que build.rs y la
#   firma de Android reciban las variables sin imprimir sus valores.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─────────────── Localización: raíz del repo ─────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."
REPO_ROOT="$(pwd)"

# ─────────────── Argumentos ──────────────────────────────────────────
MODE="release"
PRINT_HELP=0
TARGETS=()

add_target() {
  local t
  for t in "${TARGETS[@]}"; do [[ "$t" == "$1" ]] && return 0; done
  TARGETS+=("$1")
}

for arg in "$@"; do
  case "$arg" in
    --debug) MODE="debug" ;;
    all|--all) add_target linux; add_target windows; add_target android ;;
    linux|windows|android) add_target "$arg" ;;
    --help|-h) PRINT_HELP=1 ;;
    *)
      echo "✗ Argumento desconocido: $arg" >&2
      echo "" >&2
      echo "   Uso: ./tools/build.sh [linux|windows|android|all]... [--debug]" >&2
      echo "        ./tools/build.sh --help   para más información" >&2
      exit 2
      ;;
  esac
done

if [[ "$PRINT_HELP" -eq 1 ]]; then
  # Imprime la cabecera de este script (líneas que empiezan por "#"),
  # quitando el shebang y las líneas puramente decorativas de guiones.
  awk '
    /^#!/ {next}
    /^# ─+/ {next}
    /^#/   {sub(/^# ?/,""); print; next}
    {exit}
  ' "$0"
  echo ""
  echo "Códigos de salida:"
  echo "  0  → todos los objetivos solicitados se generaron correctamente."
  echo "  2  → argumentos incorrectos."
  echo "  1  → al menos un objetivo falló (ver resumen final)."
  exit 0
fi

[[ ${#TARGETS[@]} -eq 0 ]] && TARGETS=(linux)

# ─────────────── Cargar .env (sin imprimir valores) ──────────────────
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# ─────────────── Funciones auxiliares ───────────────────────────────
have_cmd() { command -v "$1" >/dev/null 2>&1; }

# Comprueba un requisito concreto; si falla imprime cómo instalarlo.
# Uso: require <comando|ruta|variable> <mensaje de cómo instalar>
require() {
  local what="$1"; shift
  local install_hint="$*"
  if [[ "$what" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
    # Variable de entorno
    if [[ -z "${!what:-}" ]]; then
      echo "   ✗ Falta variable de entorno: $what" >&2
      echo "     → $install_hint" >&2
      return 1
    fi
  elif [[ -d "$what" ]]; then
    : # Ruta existente
  elif have_cmd "$what"; then
    :
  else
    echo "   ✗ No se encontró '$what' en PATH" >&2
    echo "     → $install_hint" >&2
    return 1
  fi
  return 0
}

# ─────────────── Comprobaciones de requisitos ───────────────────────
check_linux_reqs() {
  local ok=1
  if ! have_cmd cargo-tauri && ! cargo tauri --version >/dev/null 2>&1; then
    echo "   ✗ Falta cargo-tauri (CLI de Tauri 2)" >&2
    echo "     → cargo install tauri-cli --version \"^2.0\" --locked" >&2
    ok=0
  fi
  return $((1 - ok))
}

check_windows_reqs() {
  local ok=1
  if ! have_cmd cargo-xwin; then
    echo "   ✗ Falta cargo-xwin (compilación cruzada a Windows)" >&2
    echo "     → cargo install --locked cargo-xwin" >&2
    ok=0
  fi
  if ! rustup target list --installed 2>/dev/null | grep -q '^x86_64-pc-windows-msvc$'; then
    echo "   ✗ Falta el target rustup x86_64-pc-windows-msvc" >&2
    echo "     → rustup target add x86_64-pc-windows-msvc" >&2
    ok=0
  fi
  if ! have_cmd makensis; then
    echo "   ✗ Falta makensis (NSIS)" >&2
    echo "     → sudo apt install -y nsis   (Debian/Ubuntu)" >&2
    ok=0
  fi
  if ! have_cmd lld-link && ! have_cmd lld; then
    echo "   ✗ Falta lld/lld-link (enlazador LLVM)" >&2
    echo "     → sudo apt install -y lld     (Debian/Ubuntu)" >&2
    ok=0
  fi
  if ! have_cmd llvm-rc && ! have_cmd llvm; then
    echo "   ✗ Falta llvm-rc (compilador de recursos Windows)" >&2
    echo "     → sudo apt install -y llvm    (Debian/Ubuntu)" >&2
    ok=0
  fi
  return $((1 - ok))
}

check_android_reqs() {
  local ok=1
  if [[ -z "${ANDROID_HOME:-}" ]] && [[ -z "${ANDROID_SDK_ROOT:-}" ]]; then
    echo "   ✗ Falta ANDROID_HOME (o ANDROID_SDK_ROOT)" >&2
    echo "     → export ANDROID_HOME=\$HOME/Android/Sdk" >&2
    ok=0
  fi
  if [[ -z "${ANDROID_NDK_HOME:-}" ]] && [[ -z "${NDK_HOME:-}" ]]; then
    echo "   ✗ Falta NDK_HOME (o ANDROID_NDK_HOME). El NDK debe estar instalado" >&2
    echo "     en \$ANDROID_HOME/ndk/<version> (recomendado: r25+)." >&2
    ok=0
  fi
  if ! have_cmd java; then
    echo "   ✗ Falta java (necesario para Gradle/AGP)" >&2
    echo "     → instala JDK 17 (Temurin o el de Android Studio)" >&2
    ok=0
  elif ! java -version 2>&1 | grep -q '"17\.'; then
    echo "   ⚠ java encontrado pero no es 17+. AGP puede fallar." >&2
    # No fallamos por esto: en este sistema se ha visto que java apunta
    # a una versión distinta; lo advertimos pero no abortamos para no
    # bloquear builds que sí funcionan.
  fi
  if [[ ! -d src-tauri/gen/android ]]; then
    echo "   ✗ Falta inicializar el módulo Android (src-tauri/gen/android)" >&2
    echo "     → cargo tauri android init   (solo la primera vez)" >&2
    ok=0
  fi
  # Targets de Android: los añade `cargo tauri android init`, no los
  # comprobamos aquí uno a uno para no acoplar el script a la lista
  # exacta que Tauri mantiene en cada versión.
  return $((1 - ok))
}

# ─────────────── Builders ───────────────────────────────────────────
build_linux() {
  echo "▸▸ Construyendo AppImage Linux (${MODE})"
  if ! check_linux_reqs; then
    echo "✗ Requisitos Linux no cumplidos. Abortando este objetivo." >&2
    return 1
  fi

  local debug_flag=()
  if [[ "$MODE" == "debug" ]]; then debug_flag=(--debug); fi

  cargo tauri build \
    --bundles appimage \
    "${debug_flag[@]}"
}

build_windows() {
  echo "▸▸ Construyendo instalador NSIS Windows (${MODE}, xwin)"
  if ! check_windows_reqs; then
    echo "✗ Requisitos Windows no cumplidos. Abortando este objetivo." >&2
    return 1
  fi

  local debug_flag=()
  if [[ "$MODE" == "debug" ]]; then debug_flag=(--debug); fi

  cargo tauri build \
    --runner cargo-xwin \
    --target x86_64-pc-windows-msvc \
    --bundles nsis \
    "${debug_flag[@]}"
}

build_android() {
  echo "▸▸ Construyendo APK Android (${MODE})"
  if ! check_android_reqs; then
    echo "✗ Requisitos Android no cumplidos. Abortando este objetivo." >&2
    return 1
  fi

  local debug_flag=()
  if [[ "$MODE" == "debug" ]]; then debug_flag=(--debug); fi

  cargo tauri android build --apk "${debug_flag[@]}"
}

# ─────────────── Recolección de artefactos ──────────────────────────
RELEASES_DIR="${REPO_ROOT}/releases"

# Copia a releases/ los binarios que genera cada objetivo y los lista.
# Devuelve 1 si no encontró ninguno (el build "funcionó" pero no hay
# nada que entregar).
collect_artifacts() {
  local target="$1"
  local -a files=()
  case "$target" in
    linux)
      files=(src-tauri/target/"${MODE}"/bundle/appimage/*.AppImage) ;;
    windows)
      files=(src-tauri/target/x86_64-pc-windows-msvc/"${MODE}"/bundle/nsis/*-setup.exe) ;;
    android)
      mapfile -t files < <(find src-tauri/gen/android/app/build/outputs/apk \
        -path "*/${MODE}/*" -name '*.apk' 2>/dev/null) ;;
  esac
  local f copied=0
  for f in "${files[@]}"; do
    [[ -f "$f" ]] || continue
    cp -f "$f" "${RELEASES_DIR}/"
    echo "   → releases/$(basename "$f")"
    copied=$((copied + 1))
  done
  [[ "$copied" -gt 0 ]]
}

# ─────────────── Ejecución ──────────────────────────────────────────
mkdir -p "${RELEASES_DIR}"
shopt -s nullglob

declare -a STATUS=()
declare -a REASON=()

for t in "${TARGETS[@]}"; do
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "Objetivo: $t (${MODE})"
  echo "════════════════════════════════════════════════════════════"
  if ! "build_${t}"; then
    STATUS+=("✗"); REASON+=("falló el build (revisa los mensajes de arriba)")
  elif ! collect_artifacts "$t"; then
    STATUS+=("✗"); REASON+=("el build terminó pero no se encontró el binario")
  else
    STATUS+=("✓"); REASON+=("OK")
  fi
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Resumen"
echo "════════════════════════════════════════════════════════════"
any_fail=0
for i in "${!TARGETS[@]}"; do
  printf "  %s  %-8s  %s\n" "${STATUS[$i]}" "${TARGETS[$i]}" "${REASON[$i]}"
  [[ "${STATUS[$i]}" == "✓" ]] || any_fail=1
done

if compgen -G "${RELEASES_DIR}/*" >/dev/null; then
  echo ""
  echo "📦 Contenido de releases/:"
  ls -lh "$RELEASES_DIR" | tail -n +2 | sed 's/^/    /'
fi

exit "$any_fail"
