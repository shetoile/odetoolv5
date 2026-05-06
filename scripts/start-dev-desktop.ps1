param(
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")

Write-Host "ODETool Pro desktop dev launcher" -ForegroundColor Green
Write-Host "Project: $ProjectRoot"
Write-Host ""
Write-Host "This starts ODETool in Tauri dev mode with hot reload." -ForegroundColor DarkCyan
Write-Host "Use this for daily testing instead of rebuilding the installer." -ForegroundColor DarkCyan
Write-Host ""

Set-Location -LiteralPath $ProjectRoot

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  $npm = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $npm) {
  throw "npm was not found. Install Node.js first, then run this again."
}

if ($CheckOnly) {
  Write-Host "Check complete. Double-click the Desktop launcher to start dev mode." -ForegroundColor Green
  exit 0
}

$runningApp = Get-Process -Name "odetool-pro" -ErrorAction SilentlyContinue
if ($runningApp) {
  Write-Host "ODETool is already running. Close the installed app if you want to test only the dev build." -ForegroundColor Yellow
  Write-Host ""
}

Write-Host "Starting: npm run tauri:dev" -ForegroundColor Cyan
Write-Host "Keep this window open while testing. Close it to stop dev mode." -ForegroundColor Cyan
Write-Host ""

& $npm.Source run tauri:dev

if ($LASTEXITCODE -ne 0) {
  throw "npm run tauri:dev failed with exit code $LASTEXITCODE."
}
