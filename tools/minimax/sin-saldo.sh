# shellcheck shell=bash
# ────────────────────────────────────────────────────────────────────
# sin-saldo.sh — ¿MiniMax ha fallado por falta de saldo, cuota o límite
# de peticiones? Lo usan run-task.sh y revisar.sh (con `source`).
#
# Solo se mira el FINAL del registro (donde OpenCode escribe el error
# fatal del proveedor) y solo frases de error concretas, para no
# confundir con un corte de saldo el texto de una prueba o un fichero
# que hable de "429" o de "quota". La frase tiene que estar en una
# línea de error (error, status o fail).
#
# Código de salida acordado cuando falta saldo: 75 (EX_TEMPFAIL). cola.sh
# no lo cuenta como intento: espera y repite el mismo paso.
# ────────────────────────────────────────────────────────────────────
SIN_SALDO_CODIGO=75

sin_saldo() {  # sin_saldo <registro> → 0 si el fallo es por saldo o cuota
  tail -n 80 "$1" 2>/dev/null | grep -aiE 'error|status|fail' | grep -qaiE \
    'insufficient[ _]balance|insufficient[ _]quota|quota[ _]exceeded|exceeded[^.]{0,40}quota|usage[ _]limit|rate[ _]limit(ed)?[ _]?(exceeded|reached)?|too many requests|status_code"?[: ]+(1002|1008|1039|2056)|status(code)?"?[: ]+429|\b429 too many|out of credits'
}

# ── Cuánta cuota queda (opcional) ───────────────────────────────────
# Si el equipo tiene `cuota-ias` (el script de la barra del usuario, que
# consulta https://www.minimax.io/v1/token_plan/remains con la clave de
# OpenCode y guarda la respuesta 10 min en caché), se usa para no lanzar
# nada sin cuota y para esperar justo hasta que se renueve. Si no lo
# tiene, todo sigue funcionando con las esperas escalonadas de cola.sh.
CUOTA_IAS="${CUOTA_IAS:-$(command -v cuota-ias || echo "$HOME/.local/bin/cuota-ias")}"
CUOTA_MINIMA="${MINIMAX_CUOTA_MINIMA:-2}"   # % que tiene que quedar para lanzar algo

# segundos_hasta_cuota → imprime 0 si hay cuota (o no se sabe), o los
# segundos que faltan para que se renueve la ventana que está agotada.
segundos_hasta_cuota() {
  [[ -x "$CUOTA_IAS" ]] || { echo 0; return; }
  "$CUOTA_IAS" --json 2>/dev/null | python3 -c '
import json, sys, time
try:
    m = json.load(sys.stdin)["minimax"]
except Exception:
    print(0); sys.exit()
if "error" in m:
    print(0); sys.exit()
minimo = float(sys.argv[1]); ahora = time.time(); espera = 0
for queda, vuelve in (("ventana", "ventana_vuelve"), ("semana", "semana_vuelve")):
    if m.get(queda, 100) <= minimo and m.get(vuelve) and m[vuelve] > ahora:
        espera = max(espera, m[vuelve] - ahora + 60)   # un minuto de margen
print(int(espera))
' "$CUOTA_MINIMA" 2>/dev/null || echo 0
}
