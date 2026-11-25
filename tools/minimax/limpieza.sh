# ────────────────────────────────────────────────────────────────────
# limpieza.sh — Los temporales de MiniMax se borran al acabar cada
# ejecución (tarea, revisión o evaluación).
#
# Petición del usuario (2026-11-25): «necesito que minimax limpie los
# archivos que ya no necesite de testing cuando acaba cada task».
#
# MiniMax no puede hacer `rm -rf` (opencode.json se lo prohíbe) y dejaba
# en /tmp y /tmp/opencode copias .bak, logs de e2e, sondas y árboles
# enteros para pruebas de mutación (650 MB en dos días). Ahora:
#   1. Durante la ejecución, TMPDIR apunta a /tmp/minimax-<ID>-XXXXXX
#      (lo usan mktemp, tools/test.sh, Node y Python).
#   2. Al salir (también si falla o se agota el tiempo) se borra esa
#      carpeta y todo lo que se haya **creado** desde que empezó en
#      /tmp/opencode y en /tmp, salvo:
#        - lo que no es del usuario, los sockets y los enlaces;
#        - lo que algún proceso tiene abierto o usa como carpeta;
#        - las carpetas de otros programas (Claude, VS Code, MCP…).
#      Se mira la fecha de creación, no la de modificación: lo que ya
#      existía antes no se toca aunque se haya escrito dentro.
#   3. Lo borrado queda apuntado al final del registro de la ejecución.
#
# Uso (después de definir OPENCODE_CMD=(env -i …) y LOG):
#   source tools/minimax/limpieza.sh
#   limpieza_empezar "$ID" "$LOG"     # crea la carpeta, mete TMPDIR en
#                                     # OPENCODE_CMD y deja el trap EXIT
# Para probarlo sin MiniMax: MINIMAX_LIMPIEZA_TMP=<carpeta> hace de /tmp.
# ────────────────────────────────────────────────────────────────────

LIMPIEZA_RAIZ="${MINIMAX_LIMPIEZA_TMP:-/tmp}"

limpieza_empezar() {
  local id="$1"
  LIMPIEZA_LOG="$2"
  LIMPIEZA_INICIO="$(date +%s)"
  TAREA_TMP="$(mktemp -d "$LIMPIEZA_RAIZ/minimax-$id-XXXXXX")" || return 1
  # OPENCODE_CMD empieza por `env -i`: TMPDIR va justo detrás para que
  # llegue a OpenCode y a todo lo que lance.
  if [[ "${OPENCODE_CMD[0]:-}" == env && "${OPENCODE_CMD[1]:-}" == -i ]]; then
    OPENCODE_CMD=("${OPENCODE_CMD[@]:0:2}" TMPDIR="$TAREA_TMP" "${OPENCODE_CMD[@]:2}")
  fi
  trap limpieza_acabar EXIT
}

limpieza_acabar() {
  local e nombre nacido abiertos borrado=()
  [[ -n "${TAREA_TMP:-}" && -d "$TAREA_TMP" ]] && rm -rf -- "$TAREA_TMP"

  # Rutas de /tmp que algún proceso tiene abiertas o usa como carpeta.
  abiertos="$(for p in /proc/[0-9]*; do
      readlink "$p/cwd"; readlink "$p"/fd/*
    done 2>/dev/null | grep -F "$LIMPIEZA_RAIZ/" | sort -u)"

  while IFS= read -r -d '' e; do
    nombre="${e##*/}"
    case "$nombre" in
      opencode|claude-*|mcp-*|vscode-*|hsperfdata_*|pytest-of-*|node-compile-cache|jiti|.bun-*|.X*|.ICE-unix|.font-unix|.XIM-unix|systemd-private-*|snap-private-tmp|tracker-*|ssh-*|gpg-*|*.sock|*.lock)
        continue ;;
    esac
    [[ -S "$e" || -L "$e" || -p "$e" ]] && continue
    [[ -O "$e" ]] || continue
    # Solo lo creado durante la ejecución (GNU find no sabe filtrar por
    # fecha de creación; stat sí). 0 = el sistema no la da: no se toca.
    nacido="$(stat -c %W -- "$e" 2>/dev/null)"
    [[ "$nacido" =~ ^[0-9]+$ ]] && (( nacido >= LIMPIEZA_INICIO )) || continue
    # Coincidencia por texto: ante la duda (p. ej. /tmp/a y /tmp/ab) se deja.
    [[ -n "$abiertos" ]] && grep -qF -- "$e" <<<"$abiertos" && continue
    rm -rf -- "$e" && borrado+=("$e")
  done < <(
    find "$LIMPIEZA_RAIZ" -mindepth 1 -maxdepth 1 -print0 2>/dev/null
    [[ -d "$LIMPIEZA_RAIZ/opencode" ]] &&
      find "$LIMPIEZA_RAIZ/opencode" -mindepth 1 -maxdepth 1 -print0 2>/dev/null
  )

  if [[ -n "${LIMPIEZA_LOG:-}" && -f "$LIMPIEZA_LOG" ]]; then
    {
      echo
      if (( ${#borrado[@]} )); then
        echo "── Limpieza: borrados ${#borrado[@]} temporales que dejó MiniMax:"
        printf '   %s\n' "${borrado[@]}"
      else
        echo "── Limpieza: MiniMax no dejó temporales fuera de su carpeta."
      fi
    } >> "$LIMPIEZA_LOG"
  fi
}
