# Smart Building Management System Startup Script
# Copies files to local directory to bypass OneDrive path issues on Windows.

$ErrorActionPreference = "Stop"

# Define directories using environment variables and standard paths
$localAppDir = "$env:USERPROFILE\building-management-app"
$workspaceDir = $PSScriptRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Smart Building Management System starting..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Create local workspace
if (!(Test-Path -Path $localAppDir)) {
    Write-Host "[SETUP] Creating local app directory: $localAppDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $localAppDir | Out-Null
}

# 2. Sync files (OneDrive -> Local)
Write-Host "[SYNC] Syncing code files to local directory..." -ForegroundColor Yellow
Copy-Item -Path "$workspaceDir\package.json" -Destination $localAppDir -Force
Copy-Item -Path "$workspaceDir\server.js" -Destination $localAppDir -Force

# Copy public folder (Exclude uploads to avoid slow copying of heavy images)
if (Test-Path -Path "$workspaceDir\public") {
    $localPublicDir = Join-Path $localAppDir "public"
    if (!(Test-Path -Path $localPublicDir)) {
        New-Item -ItemType Directory -Force -Path $localPublicDir | Out-Null
    }
    
    Get-ChildItem -Path "$workspaceDir\public" | Where-Object { $_.Name -ne "uploads" } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $localPublicDir -Recurse -Force
    }
}

# 3. Navigate to local folder, install and start
Set-Location -Path $localAppDir

if (!(Test-Path -Path "node_modules")) {
    Write-Host "[SETUP] Installing dependencies (this may take a few seconds)..." -ForegroundColor Yellow
    npm install
}

Write-Host "[SERVER] Starting Node.js server..." -ForegroundColor Green
node server.js
