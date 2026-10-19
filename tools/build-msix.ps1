# ─────────────────────────────────────────────────────────────────────
# build-msix.ps1 — Envuelve el .exe (NSIS) en un .msix firmado para
#                  Microsoft Store.
# ─────────────────────────────────────────────────────────────────────
# Tauri 2 todavía no incluye MSIX como target nativo. El flujo oficial
# para publicar en Microsoft Store desde Tauri es:
#
#   1. Construir el binario .exe con Tauri (NSIS).
#      → .\tools\build-windows.ps1
#
#   2. Instalar la herramienta `cargo-msix` (wrapper MSIX):
#        cargo install cargo-msix --locked
#
#   3. Generar el manifiesto MSIX y firmar el paquete:
#        .\tools\build-msix.ps1 -ExePath src-tauri\target\release\bundle\*.exe
#
# La firma debe hacerse con un certificado emitido por una CA reconocida
# por Microsoft (DigiCert, Sectigo, etc.) y el nombre `Publisher` debe
# coincidir exactamente con el `PublisherDisplayName` declarado en
# Partner Center.
#
# Salida:
#   dist\<productName>_<version>_x64.msix
#   dist\<productName>_<version>_x64.msixsym  ← para crash analytics
# ─────────────────────────────────────────────────────────────────────
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,

  [string]$Publisher = "CN=Gabriel Cat Developer",

  [string]$IdentityName = "gabriel.cat.developer.planner",

  [string]$PublisherDisplayName = "Gabriel Cat Developer",

  [string]$OutDir = "dist",

  [string]$CertThumbprint = $env:MSIX_CERT_THUMBPRINT,

  [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

# 1. Comprobar prerrequisitos.
if (-not (Get-Command cargo-msix -ErrorAction SilentlyContinue)) {
  Write-Error "No se encuentra 'cargo-msix'. Instálalo con: cargo install cargo-msix --locked"
  exit 1
}
if (-not (Test-Path $ExePath)) {
  Write-Error "No se encontró el binario: $ExePath"
  exit 1
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# 2. Construir el MSIX a partir del .exe.
Write-Host "▸ Empaquetando $ExePath → MSIX"

# cargo-msix recibe los datos del .exe y genera un manifest.
# Aquí se muestra el patrón: ajusta los flags a la versión instalada
# (`cargo msix --help`).
$productName  = "Planificador Semanal"
$version      = "0.1.0"
$msixFile     = Join-Path $OutDir ("{0}_{1}_x64.msix" -f $productName, $version)

# NOTA: la API exacta de cargo-msix cambia entre versiones. El comando
# siguiente es un esquema razonable; reemplázalo por el equivalente de
# tu versión instalada.
#
#  cargo msix build `
#    --exe $ExePath `
#    --name $productName `
#    --publisher $Publisher `
#    --identity $IdentityName `
#    --version $version `
#    --out $msixFile

Write-Host "  TODO: descomentar el bloque 'cargo msix build' tras instalar la herramienta."

if (Test-Path $msixFile) {
  # 3. Firma con signtool (Windows SDK).
  if ($CertThumbprint) {
    Write-Host "▸ Firmando con certificado $CertThumbprint"
    $signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe" |
      Sort-Object FullName -Descending | Select-Object -First 1
    & $signTool sign `
      /fd SHA256 `
      /sha1 $CertThumbprint `
      /td SHA256 `
      /tr $TimestampUrl `
      $msixFile
  } else {
    Write-Warning "MSIX_CERT_THUMBPRINT no definido; no se ha firmado el MSIX."
    Write-Warning "Microsoft Store rechazará el paquete sin firma."
  }

  Write-Host ""
  Write-Host "✓ MSIX generado: $msixFile"
}