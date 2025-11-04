<#
clean-and-build.ps1

Stops known processes that can lock build artifacts (TodoApi, dotnet, node) and runs a clean build of the solution.
Usage (PowerShell):
  .\scripts\clean-and-build.ps1

This script is safe to run locally in development. It does not remove source files.
#>

Write-Host "Stopping TodoApi and dotnet processes that may lock DLLs..." -ForegroundColor Cyan
Get-Process -Name TodoApi -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping TodoApi PID $($_.Id)" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Get-Process -Name dotnet -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping dotnet PID $($_.Id)" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Optional: stop node (frontend) if it is running and you want a completely fresh start
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping node PID $($_.Id)" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 300

$solution = "${PSScriptRoot}\..\LAPR5.sln"
if (-not (Test-Path $solution)) {
    # fallback to workspace root
    $solution = Join-Path (Resolve-Path "${PSScriptRoot}\.." ) "LAPR5.sln"
}

Write-Host "Building solution: $solution" -ForegroundColor Cyan
dotnet build "$solution" -c Debug

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build succeeded." -ForegroundColor Green
} else {
    Write-Host "Build failed with exit code $LASTEXITCODE." -ForegroundColor Red
}

Write-Host "Done." -ForegroundColor Cyan
