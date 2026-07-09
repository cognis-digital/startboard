# Install the `startboard` CLI on Windows (PowerShell).
# Prefers `npm link`; falls back to a .cmd shim in %LOCALAPPDATA%\startboard\bin.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bin  = Join-Path $root "bin\startboard.js"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "node is required (v20+)."
  exit 1
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
  Write-Host "Linking via npm..."
  try {
    Push-Location $root
    npm link
    Pop-Location
    Write-Host "Installed. Try: startboard help"
    exit 0
  } catch {
    Write-Warning "npm link failed; falling back to a shim."
  }
}

$target = Join-Path $env:LOCALAPPDATA "startboard\bin"
New-Item -ItemType Directory -Force -Path $target | Out-Null
$shim = Join-Path $target "startboard.cmd"
"@echo off`r`nnode `"$bin`" %*" | Out-File -FilePath $shim -Encoding ascii
Write-Host "Installed shim at $shim"

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$target*") {
  Write-Host "note: add $target to your PATH (or run:"
  Write-Host "  setx PATH `"$env:Path;$target`" )"
}
Write-Host "Try: startboard help"
