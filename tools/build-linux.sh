#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# build-linux.sh — Construye el AppImage y .deb para Linux
# ────────────────────────────────────────────────────────────────────
# Requisitos del sistema (Ubuntu 22.04+ / Debian 12+):
#   sudo apt install -y \
#     libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
#     librsvg2-dev libssl-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
#     build-essential curl wget file pkg-config
#
# Uso:
#   ./tools/build-linux.sh            → release con AppImage + .deb
#   ./tools/build-linux.sh --debug    → debug
# ────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

MODE=release
if [[ "${1:-}" == "--debug" ]]; then
  MODE=debug
fi

echo "▸▸ Construyendo target Linux (${MODE})"

cargo tauri build \
  --bundles appimage,deb \
  $([[ "$MODE" == "debug" ]] && echo "--debug")

OUTPUT_DIR="src-tauri/target/${MODE}/bundle"
echo
echo "✓ Binarios en:"
ls -lh "$OUTPUT_DIR"/*.{AppImage,deb} 2>/dev/null || true