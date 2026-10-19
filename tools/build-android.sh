#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# build-android.sh — Construye el APK firmado (debug o release) para
#                    Android.
# ─────────────────────────────────────────────────────────────────────
# Requisitos:
#   1. Instalar el módulo de Tauri para Android:
#        cargo install tauri-cli --version "^2.0" --locked
#        cargo tauri android init   # solo la primera vez
#
#   2. SDK de Android (API 24+) y NDK r25+.
#      Recomendado instalar Android Studio y dejar las rutas por defecto:
#        ANDROID_HOME   = ~/Android/Sdk
#        ANDROID_NDK_HOME = ~/Android/Sdk/ndk/<version>
#
#   3. Java 17 (Temurin o el incluido en Android Studio).
#
#   4. Generar un keystore para release:
#        keytool -genkey -v \
#          -keystore ~/keys/planner-release.jks \
#          -keyalg RSA -keysize 2048 -validity 10000 \
#          -alias planner
#
# Uso:
#   ./tools/build-android.sh                     → release (APK firmado)
#   ./tools/build-android.sh --debug            → debug APK
#   ./tools/build-android.sh --aab              → AAB para Play Store
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

MODE=release
OUT=apk
if [[ "${1:-}" == "--debug" ]]; then MODE=debug; fi
if [[ "${1:-}" == "--aab"   ]]; then MODE=release; OUT=aab; fi

echo "▸▸ Construyendo APK (${MODE}, ${OUT})"

# Exportar keystore si está en .env
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

cargo tauri android build --apk $([[ "$MODE" == "debug" ]] && echo "--debug")

# Tauri deja el APK en:
APK_DIR="src-tauri/gen/android/app/build/outputs/apk/${MODE}"
AAB_DIR="src-tauri/gen/android/app/build/outputs/bundle/${MODE}"

if [[ "$OUT" == "apk" ]]; then
  echo
  echo "✓ APK en: $APK_DIR"
  ls -lh "$APK_DIR"/*.apk 2>/dev/null || true
else
  echo
  echo "✓ AAB en: $AAB_DIR"
  ls -lh "$AAB_DIR"/*.aab 2>/dev/null || true
fi