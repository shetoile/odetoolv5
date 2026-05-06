param(
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$Desktop = [Environment]::GetFolderPath("Desktop")
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogPath = Join-Path $Desktop "ODETool installer build $Timestamp.log"
$NsisDir = Join-Path $ProjectRoot "src-tauri\target\release\bundle\nsis"
$StableInstallerName = "ODETool Pro Installer - Latest.exe"
$StableInstallerPath = Join-Path $Desktop $StableInstallerName

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "== $Message" -ForegroundColor Cyan
}

function Run-Command {
  param(
    [string]$Command,
    [string[]]$Arguments
  )

  Write-Step "$Command $($Arguments -join ' ')"
  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Command @Arguments 2>&1 | Tee-Object -FilePath $LogPath -Append
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE. See log: $LogPath"
  }
}

Write-Host "ODETool Pro installer builder" -ForegroundColor Green
Write-Host "Project: $ProjectRoot"
Write-Host "Desktop: $Desktop"
Write-Host "Log: $LogPath"

Set-Location -LiteralPath $ProjectRoot

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  $npm = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $npm) {
  throw "npm was not found. Install Node.js first, then run this again."
}

$runningApp = Get-Process -Name "odetool-pro" -ErrorAction SilentlyContinue
if ($runningApp) {
  Write-Host ""
  Write-Host "ODETool is currently running. The build can continue, but close ODETool before installing the new installer." -ForegroundColor Yellow
}

if ($CheckOnly) {
  Write-Step "Check complete"
  Write-Host "Double-click the Desktop launcher without -CheckOnly to build the installer."
  exit 0
}

try {
  Run-Command $npm.Source @("run", "tauri:build")
} catch {
  $existingInstaller = $null
  if (Test-Path -LiteralPath $NsisDir) {
    $existingInstaller = Get-ChildItem -LiteralPath $NsisDir -Filter "*.exe" -File |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
  }

  if (-not $existingInstaller) {
    throw
  }

  Write-Host ""
  Write-Host "Build command returned an error after creating an installer." -ForegroundColor Yellow
  Write-Host "Continuing with the newest installer for local testing:" -ForegroundColor Yellow
  Write-Host $existingInstaller.FullName
}

if (-not (Test-Path -LiteralPath $NsisDir)) {
  throw "Installer output folder was not found: $NsisDir"
}

$installer = Get-ChildItem -LiteralPath $NsisDir -Filter "*.exe" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $installer) {
  throw "No NSIS installer .exe was found in: $NsisDir"
}

Write-Step "Copy installer to Desktop"
Copy-Item -LiteralPath $installer.FullName -Destination $StableInstallerPath -Force

Write-Host ""
Write-Host "Installer created successfully:" -ForegroundColor Green
Write-Host $StableInstallerPath
Write-Host ""
Write-Host "Build log:" -ForegroundColor DarkCyan
Write-Host $LogPath

Start-Process explorer.exe -ArgumentList "/select,`"$StableInstallerPath`""
