$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BuilderPath = Resolve-Path (Join-Path $ScriptDir "build-installer-to-desktop.ps1")
$Desktop = [Environment]::GetFolderPath("Desktop")
$LauncherPath = Join-Path $Desktop "Build ODETool Installer.cmd"

$LauncherContent = @"
@echo off
title Build ODETool Installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$BuilderPath"
echo.
echo Press any key to close this window.
pause >nul
"@

Set-Content -LiteralPath $LauncherPath -Value $LauncherContent -Encoding ASCII
Write-Host "Created Desktop launcher:" -ForegroundColor Green
Write-Host $LauncherPath
