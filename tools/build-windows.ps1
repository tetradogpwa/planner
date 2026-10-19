# ─────────────────────────────────────────────────────────────────────
# build-windows.ps1 — Construye el instalador NSIS (.exe) en Windows
# ─────────────────────────────────────────────────────────────────────
# Requisitos:
#   * Rust toolchain stable (rustup.rs)
#   * Visual Studio 2022 Build Tools con el workload "Desktop development
#     with C++" y el componente "Windows 10/11 SDK".
#   * WebView2 SDK (instalado automáticamente por Tauri la primera vez).
#
# Uso (PowerShell):
#   .\tools\build-windows.ps1                       → release
#   .\tools\build-windows.ps1 -Debug                → debug
#   .\tools\build-windows.ps1 -SkipSign             → sin firma de código
# ─────────────────────────────────────────────────────────────────────
[CmdletBinding()]
param(
  [switch]$Debug,
  [switch]$SkipSign
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$bundles = "nsis"

if (-not $SkipSign) {
  Write-Host "▸ Usando certificado de NSIS desde .env (THUMBPRINT)"
  if (-not (Test-Path ".env")) {
    Write-Warning "No existe .env; los binarios no se firmarán."
    Write-Warning "Crea .env con MSIX_CERT_THUMBPRINT=... o usa -SkipSign."
    $SkipSign = $true
  }
}

& cargo tauri build --bundles $bundles $(if ($Debug) { "--debug" })

$OutputDir = "src-tauri\target\release\bundle"
if ($Debug) { $OutputDir = "src-tauri\target\debug\bundle" }

Write-Host ""
Write-Host "✓ Instalador NSIS en:"
Get-ChildItem -Path $OutputDir -Filter "*.exe" | ForEach-Object {
  "    {0}  ({1} MB)" -f $_.FullName, [math]::Round($_.Length / 1MB, 2)
}