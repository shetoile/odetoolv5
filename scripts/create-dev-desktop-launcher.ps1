$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DevLauncherScript = Resolve-Path (Join-Path $ScriptDir "start-dev-desktop.ps1")
$Desktop = [Environment]::GetFolderPath("Desktop")
$LauncherPath = Join-Path $Desktop "Start ODETool Dev.cmd"

$LauncherContent = @"
@echo off
title Start ODETool Dev
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$DevLauncherScript"
echo.
echo ODETool dev mode stopped. Press any key to close this window.
pause >nul
"@

Set-Content -LiteralPath $LauncherPath -Value $LauncherContent -Encoding ASCII
Write-Host "Created Desktop dev launcher:" -ForegroundColor Green
Write-Host $LauncherPath
